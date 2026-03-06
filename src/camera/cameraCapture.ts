/**
 * 手機相機擷取模組
 *
 * 封裝 getUserMedia、拍照、停止串流等操作。
 * 不支援相機時降級為檔案上傳。
 */

export interface CaptureElements {
  video: HTMLVideoElement
  canvas: HTMLCanvasElement
}

let activeStream: MediaStream | null = null

/** 檢查瀏覽器是否支援 getUserMedia */
export function isCameraSupported(): boolean {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
}

/** 啟動後鏡頭串流，回傳 video 元素 */
export async function startCamera(video: HTMLVideoElement): Promise<void> {
  if (!isCameraSupported()) {
    throw new Error('此瀏覽器不支援相機功能，請使用檔案上傳')
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  })

  activeStream = stream
  video.srcObject = stream
  await video.play()
}

/** 從 video 擷取一幀到 canvas，回傳 base64 dataURL */
export function captureFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement): string {
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(video, 0, 0)
  return canvas.toDataURL('image/jpeg', 0.85)
}

/** 停止相機串流 */
export function stopCamera(): void {
  if (activeStream) {
    activeStream.getTracks().forEach(t => t.stop())
    activeStream = null
  }
}

/** 從 file input 讀取圖片為 dataURL */
export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('檔案讀取失敗'))
    reader.readAsDataURL(file)
  })
}
