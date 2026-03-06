#!/usr/bin/env python3
"""
麻將牌 YOLOv8 模型訓練與匯出腳本

使用 Roboflow 上 CC BY 4.0 的麻將牌資料集（34 類）訓練 YOLOv8n，
然後匯出為 TensorFlow.js 格式供瀏覽器推論。

前置需求：
    pip install ultralytics roboflow

使用方式：
    # 方式 A：訓練新模型（需 Roboflow API key）
    ROBOFLOW_API_KEY=your_key python scripts/setup-model.py --train

    # 方式 B：從現有 .pt 檔匯出
    python scripts/setup-model.py --export path/to/best.pt

    # 方式 C：僅匯出為 ONNX（不需 tfjs 轉換環境）
    python scripts/setup-model.py --export path/to/best.pt --format onnx

輸出：
    public/models/mahjong/model.json + shard 檔案（TFJS）
    或 public/models/mahjong/model.onnx（ONNX）
"""

import argparse
import os
import shutil
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
MODEL_OUTPUT_DIR = PROJECT_ROOT / "public" / "models" / "mahjong"


def train_model(api_key: str, epochs: int = 50, imgsz: int = 640):
    """用 Roboflow 麻將資料集訓練 YOLOv8n"""
    from roboflow import Roboflow
    from ultralytics import YOLO

    # 下載資料集 — Roboflow Universe: mahjong_yolo (34 classes, CC BY 4.0)
    rf = Roboflow(api_key=api_key)
    project = rf.workspace("test-wmo8i").project("mahjong_yolo")
    version = project.version(1)
    dataset = version.download("yolov8", location=str(PROJECT_ROOT / "datasets" / "mahjong"))

    # 訓練 YOLOv8n（nano — 適合瀏覽器推論，約 6MB）
    model = YOLO("yolov8n.pt")
    results = model.train(
        data=os.path.join(dataset.location, "data.yaml"),
        epochs=epochs,
        imgsz=imgsz,
        batch=16,
        name="mahjong-yolov8n",
        project=str(PROJECT_ROOT / "runs"),
    )

    best_pt = Path(results.save_dir) / "weights" / "best.pt"
    print(f"\n[OK] 訓練完成: {best_pt}")
    return str(best_pt)


def export_model(pt_path: str, fmt: str = "tfjs", imgsz: int = 640):
    """將 .pt 模型匯出為 TFJS 或 ONNX 格式"""
    from ultralytics import YOLO

    model = YOLO(pt_path)
    export_path = model.export(format=fmt, imgsz=imgsz)
    export_path = Path(export_path)

    # 清空目標目錄
    MODEL_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for f in MODEL_OUTPUT_DIR.iterdir():
        f.unlink()

    if fmt == "tfjs":
        # TFJS 匯出產生資料夾，複製內容到 public/models/mahjong/
        if export_path.is_dir():
            for f in export_path.iterdir():
                shutil.copy2(f, MODEL_OUTPUT_DIR / f.name)
        else:
            print(f"[WARN] 預期資料夾但得到: {export_path}", file=sys.stderr)
    elif fmt == "onnx":
        shutil.copy2(export_path, MODEL_OUTPUT_DIR / "model.onnx")
    else:
        print(f"[WARN] 未處理的格式: {fmt}", file=sys.stderr)

    # 寫入 metadata（前端用來偵測模型類型）
    meta_path = MODEL_OUTPUT_DIR / "metadata.json"
    import json
    metadata = {
        "format": fmt,
        "source": pt_path,
        "imgsz": imgsz,
        "numClasses": 34,
        "classNames": [
            "1m","2m","3m","4m","5m","6m","7m","8m","9m",
            "1p","2p","3p","4p","5p","6p","7p","8p","9p",
            "1s","2s","3s","4s","5s","6s","7s","8s","9s",
            "E","S","W","N","B","F","Z",
        ],
    }
    meta_path.write_text(json.dumps(metadata, indent=2, ensure_ascii=False))

    print(f"\n[OK] 模型已匯出至: {MODEL_OUTPUT_DIR}")
    print(f"     格式: {fmt}")
    for f in sorted(MODEL_OUTPUT_DIR.iterdir()):
        size = f.stat().st_size
        unit = "KB" if size < 1_000_000 else "MB"
        val = size / 1024 if unit == "KB" else size / (1024 * 1024)
        print(f"     {f.name} ({val:.1f} {unit})")


def main():
    parser = argparse.ArgumentParser(description="麻將牌 YOLOv8 模型設定")
    parser.add_argument("--train", action="store_true", help="訓練新模型（需 ROBOFLOW_API_KEY）")
    parser.add_argument("--export", type=str, metavar="PT_PATH", help="匯出現有 .pt 模型")
    parser.add_argument("--format", type=str, default="tfjs", choices=["tfjs", "onnx"], help="匯出格式（預設 tfjs）")
    parser.add_argument("--epochs", type=int, default=50, help="訓練 epoch 數")
    parser.add_argument("--imgsz", type=int, default=640, help="輸入圖片大小")
    args = parser.parse_args()

    if not args.train and not args.export:
        parser.print_help()
        print("\n請指定 --train 或 --export <path>")
        sys.exit(1)

    pt_path = args.export
    if args.train:
        api_key = os.environ.get("ROBOFLOW_API_KEY")
        if not api_key:
            print("[ERROR] 需設定 ROBOFLOW_API_KEY 環境變數", file=sys.stderr)
            print("        免費註冊: https://app.roboflow.com/", file=sys.stderr)
            sys.exit(1)
        pt_path = train_model(api_key, epochs=args.epochs, imgsz=args.imgsz)

    export_model(pt_path, fmt=args.format, imgsz=args.imgsz)


if __name__ == "__main__":
    main()
