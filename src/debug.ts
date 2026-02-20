/**
 * Mobile Console Debug Tool
 * 手機端 Console 除錯工具
 * 
 * 功能：
 * 1. 攔截所有 console.log/error/warn
 * 2. 顯示浮動按鍵
 * 3. 點擊複製所有 console 輸出
 */

interface LogEntry {
  type: 'log' | 'error' | 'warn'
  timestamp: string
  msg: string
}

class MobileDebugger {
  private logs: LogEntry[] = []
  private originalConsole: {
    log: typeof console.log
    error: typeof console.error
    warn: typeof console.warn
  }
  private button: HTMLButtonElement | null = null
  
  constructor() {
    // 保存原始 console 方法
    this.originalConsole = {
      log: console.log.bind(console),
      error: console.error.bind(console),
      warn: console.warn.bind(console)
    }
    
    this.init()
  }
  
  private init() {
    // 攔截 console
    this.interceptConsole()
    
    // 建立浮動按鍵
    this.createButton()
  }
  
  private interceptConsole() {
    const methods: ('log' | 'error' | 'warn')[] = ['log', 'error', 'warn']
    
    methods.forEach(method => {
      console[method] = (...args: any[]) => {
        // 記錄
        this.logs.push({
          type: method,
          timestamp: new Date().toISOString().split('T')[1].slice(0, 12),
          msg: args.map(a => {
            if (typeof a === 'object') {
              try {
                return JSON.stringify(a, null, 2)
              } catch {
                return String(a)
              }
            }
            return String(a)
          }).join(' ')
        })
        
        // 保持原始輸出
        this.originalConsole[method].apply(console, args)
      }
    })
  }
  
  private createButton() {
    this.button = document.createElement('button')
    this.button.textContent = '📋'
    this.button.style.cssText = `
      position: fixed;
      bottom: 80px;
      right: 20px;
      z-index: 99999;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      border: none;
      font-size: 28px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      cursor: pointer;
      transition: all 0.3s ease;
      -webkit-tap-highlight-color: transparent;
    `
    
    this.button.addEventListener('click', () => this.copyLogs())
    
    // 懸停效果
    this.button.addEventListener('mouseenter', () => {
      if (this.button) {
        this.button.style.transform = 'scale(1.1)'
      }
    })
    
    this.button.addEventListener('mouseleave', () => {
      if (this.button) {
        this.button.style.transform = 'scale(1)'
      }
    })
    
    document.body.appendChild(this.button)
  }
  
  private async copyLogs() {
    if (this.logs.length === 0) {
      this.showFeedback('❌', '#f44336')
      return
    }
    
    // 格式化日誌
    const text = this.logs.map(log => {
      const icon = log.type === 'error' ? '❌' : log.type === 'warn' ? '⚠️' : 'ℹ️'
      return `[${log.timestamp}] ${icon} ${log.msg}`
    }).join('\n\n')
    
    try {
      // 複製到剪貼簿
      await navigator.clipboard.writeText(text)
      
      // 顯示成功回饋
      this.showFeedback('✓', '#4CAF50')
      
      // 同時在 console 輸出（方便手動複製）
      console.log('=== Console Logs Copied ===')
      console.log(text)
      console.log('=== End of Logs ===')
    } catch (error) {
      // Fallback：使用舊式 execCommand
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.top = '-9999px'
      document.body.appendChild(textarea)
      textarea.select()
      
      try {
        document.execCommand('copy')
        this.showFeedback('✓', '#4CAF50')
      } catch {
        this.showFeedback('❌', '#f44336')
      }
      
      document.body.removeChild(textarea)
    }
  }
  
  private showFeedback(icon: string, color: string) {
    if (!this.button) return
    
    const originalText = this.button.textContent
    const originalBg = this.button.style.background
    
    this.button.textContent = icon
    this.button.style.background = color
    
    setTimeout(() => {
      if (this.button) {
        this.button.textContent = originalText
        this.button.style.background = originalBg
      }
    }, 1000)
  }
  
  // 清空日誌
  public clear() {
    this.logs = []
  }
  
  // 獲取日誌數量
  public getLogCount() {
    return this.logs.length
  }
}

// 只在開發環境啟用
if ((import.meta as any).env?.DEV) {
  const mobileDebugger = new MobileDebugger()
  
  // 暴露到全局（方便手動控制）
  ;(window as any).__mobileDebugger = mobileDebugger
  
  console.log('🐛 Mobile Debugger 已啟用')
  console.log('📋 點擊右下角按鍵複製所有 console 輸出')
}

export {}
