// WASM 遊戲引擎加載和調用

let wasmReady = false;
const maxRetries = 20;

export let lastWasmError = '';

export async function initWasm(): Promise<boolean> {
  try {
    // 檢查 Go 運行時是否已載入
    if (typeof (window as any).Go === 'undefined') {
      lastWasmError = 'Go runtime not found (wasm_exec.js 未載入)';
      console.error(lastWasmError);
      return false;
    }

    const wasmUrl = `${import.meta.env.BASE_URL}game.wasm`;
    console.log('✓ 正在加載 WASM...', wasmUrl);

    // 加載 WASM 二進位（使用 Vite base URL，相容 GitHub Pages）
    const response = await fetch(wasmUrl);
    if (!response.ok) {
      lastWasmError = `fetch 失敗: HTTP ${response.status} → ${wasmUrl}`;
      console.error(lastWasmError);
      return false;
    }

    const buffer = await response.arrayBuffer();
    console.log(`✓ WASM 大小: ${buffer.byteLength} bytes`);

    // 實例化 WASM
    let result: WebAssembly.WebAssemblyInstantiatedSource;
    try {
      const go = new (window as any).Go();
      result = await WebAssembly.instantiate(buffer, go.importObject);

      console.log('✓ 運行 Go 程序...');

      // 運行 Go（不等待）
      go.run(result.instance).catch((e: any) => {
        console.log('Go 程序結束:', e);
      });
    } catch (e: any) {
      lastWasmError = `WebAssembly.instantiate 失敗: ${e?.message ?? e}`;
      console.error(lastWasmError);
      return false;
    }

    // 等待函數暴露（Go 程序需要時間初始化）
    let ready = false;
    for (let i = 0; i < maxRetries; i++) {
      await new Promise(resolve => setTimeout(resolve, 100));

      if (typeof (window as any).GoInitGame === 'function') {
        console.log(`✅ WASM 已就位（${i * 100}ms）`);
        wasmReady = true;
        ready = true;
        break;
      }
    }

    if (!ready) {
      lastWasmError = `GoInitGame 未暴露，等待 ${maxRetries * 100}ms 超時`;
      console.error(lastWasmError);
      return false;
    }

    return true;
  } catch (error: any) {
    lastWasmError = `未知錯誤: ${error?.message ?? error}`;
    console.error('❌ WASM 加載失敗:', error);
    return false;
  }
}

// 調用 Go 暴露的全局函數
export function callWasmFunction(funcName: string, ...args: any[]): any {
  const func = (window as any)[funcName];

  if (typeof func !== 'function') {
    console.error(`❌ 函數 ${funcName} 未找到`);
    console.log('可用的 Go 函數:', Object.keys(window).filter(k => k.startsWith('Go')));
    return null;
  }

  try {
    return func(...args);
  } catch (error) {
    console.error(`❌ 調用 ${funcName} 失敗:`, error);
    return null;
  }
}

// 遊戲 API（前端介面）
export class GameEngine {
  static initGame() {
    const result = callWasmFunction('GoInitGame');
    console.log('✓ GoInitGame 結果:', result);
    return result;
  }

  static generateTiles() { return callWasmFunction('GoGenerateTiles'); }
  static drawTile() { return callWasmFunction('GoDrawTile'); }
  static removeTile(tile: string) { return callWasmFunction('GoRemoveTile', tile); }
  static checkWin() { return callWasmFunction('GoCheckWin'); }
  static calculateScore(fans: number) { return callWasmFunction('GoCalculateScore', fans); }
  static resetGame() { return callWasmFunction('GoResetGame'); }
}
