// WASM 遊戲引擎加載和調用

let wasmReady = false;
let retryCount = 0;
const maxRetries = 20;

export async function initWasm(): Promise<boolean> {
  try {
    // 檢查 Go 運行時是否已載入
    if (typeof (window as any).Go === 'undefined') {
      console.error('Go 運行時未找到');
      return false;
    }

    console.log('✓ 正在加載 WASM...');

    // 加載 WASM 二進位
    const response = await fetch('/game.wasm');
    if (!response.ok) {
      console.error(`無法加載 WASM，狀態碼: ${response.status}`);
      return false;
    }

    const buffer = await response.arrayBuffer();
    console.log(`✓ WASM 大小: ${buffer.byteLength} bytes`);

    // 實例化 WASM
    const go = new (window as any).Go();
    const result = await WebAssembly.instantiate(buffer, go.importObject);

    console.log('✓ 運行 Go 程序...');
    
    // 運行 Go（不等待）
    go.run(result.instance).catch(() => {
      console.log('✓ Go 程序運行完成');
    });

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
      console.error('❌ WASM 函數未暴露，等待超時');
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ WASM 加載失敗:', error);
    return false;
  }
}

// 調用 Go 暴露的全局函數
export function callWasmFunction(funcName: string, ...args: any[]): any {
  // 等等看函數是否已準備好
  const func = (window as any)[funcName];
  
  if (typeof func !== 'function') {
    console.error(`❌ 函數 ${funcName} 未找到`);
    console.log('可用的 Go 函數:', Object.keys(window).filter(k => k.startsWith('Go')));
    return null;
  }

  try {
    const result = func(...args);
    return result;
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

  static generateTiles() {
    return callWasmFunction('GoGenerateTiles');
  }

  static drawTile() {
    return callWasmFunction('GoDrawTile');
  }

  static checkWin() {
    return callWasmFunction('GoCheckWin');
  }

  static calculateScore(fans: number) {
    return callWasmFunction('GoCalculateScore', fans);
  }

  static resetGame() {
    return callWasmFunction('GoResetGame');
  }
}
