/**
 * 相機辨識頁面
 *
 * 整合相機擷取、辨識服務、校正 UI 的完整流程。
 */

import type { CameraStatus, CorrectedTiles } from './types'
import { isCameraSupported, startCamera, captureFrame, stopCamera, readFileAsDataURL } from './cameraCapture'
import { recognizeTiles } from './recognitionService'
import { renderCorrectionUI } from './correctionUI'

export interface CameraPageCallbacks {
  onConfirm: (result: CorrectedTiles) => void
  onCancel: () => void
}

export function mountCameraPage(container: HTMLElement, callbacks: CameraPageCallbacks): void {
  let status: CameraStatus = { state: 'idle' }
  let videoEl: HTMLVideoElement | null = null
  let canvasEl: HTMLCanvasElement | null = null
  let recognitionTaskId = 0
  let lastCapturedImageDataUrl: string | null = null
  let currentRecognitionAbort: AbortController | null = null

  function render() {
    switch (status.state) {
      case 'idle':
        renderIdlePage()
        break
      case 'requesting':
        container.innerHTML = `
          <div class="camera-page camera-page--center">
            <div class="camera-spinner"></div>
            <p>正在請求相機權限...</p>
          </div>
        `
        break
      case 'streaming':
        // video 元素已掛載，不重新渲染
        break
      case 'captured':
        renderCapturedPage(status.imageDataUrl)
        break
      case 'recognizing':
        container.innerHTML = `
          <div class="camera-page camera-page--center">
            <div class="camera-spinner"></div>
            <p>辨識中...</p>
            <div class="camera-correction__actions" style="margin-top: 12px;">
              <button type="button" class="camera-btn camera-btn--cancel" id="cam-recognizing-back">返回上一步</button>
            </div>
          </div>
        `
        document.getElementById('cam-recognizing-back')?.addEventListener('click', () => {
          recognitionTaskId++
          currentRecognitionAbort?.abort()
          currentRecognitionAbort = null
          if (lastCapturedImageDataUrl) {
            status = { state: 'captured', imageDataUrl: lastCapturedImageDataUrl }
          } else {
            status = { state: 'idle' }
          }
          render()
        })
        break
      case 'result':
        renderResultPage()
        break
      case 'error':
        container.innerHTML = `
          <div class="camera-page camera-page--center">
            <p style="color: #f44336; font-size: 1.1em; margin-bottom: 16px;">${status.message}</p>
            <div class="camera-correction__actions">
              <button type="button" class="camera-btn camera-btn--confirm" id="cam-retry">重試</button>
              <button type="button" class="camera-btn camera-btn--cancel" id="cam-back">返回</button>
            </div>
          </div>
        `
        document.getElementById('cam-retry')?.addEventListener('click', () => {
          status = { state: 'idle' }
          render()
        })
        document.getElementById('cam-back')?.addEventListener('click', () => {
          cleanup()
          callbacks.onCancel()
        })
        break
    }
  }

  function renderIdlePage() {
    const hasCamera = isCameraSupported()
    container.innerHTML = `
      <div class="camera-page">
        <h2 style="text-align: center; margin-bottom: 20px;">📷 拍攝麻將牌</h2>
        <p style="text-align: center; color: #666; margin-bottom: 24px; font-size: 0.9em;">
          將手牌排好，用手機相機拍攝，自動辨識牌型
        </p>
        <div class="camera-correction__actions" style="flex-direction: column; gap: 12px;">
          ${hasCamera ? `<button type="button" class="camera-btn camera-btn--confirm" id="cam-start">開啟相機</button>` : ''}
          <label class="camera-btn camera-btn--confirm" style="cursor: pointer;">
            選擇照片
            <input type="file" accept="image/*" capture="environment" id="cam-file" style="display: none;">
          </label>
          <button type="button" class="camera-btn camera-btn--cancel" id="cam-cancel">返回</button>
        </div>
      </div>
    `

    document.getElementById('cam-start')?.addEventListener('click', handleStartCamera)
    document.getElementById('cam-file')?.addEventListener('change', handleFileSelect)
    document.getElementById('cam-cancel')?.addEventListener('click', () => {
      cleanup()
      callbacks.onCancel()
    })
  }

  async function handleStartCamera() {
    status = { state: 'requesting' }
    render()

    try {
      container.innerHTML = `
        <div class="camera-page">
          <div class="camera-viewfinder">
            <video id="cam-video" autoplay playsinline muted></video>
            <div class="camera-guide-frame"></div>
            <canvas id="cam-canvas" style="display: none;"></canvas>
          </div>
          <div class="camera-correction__actions" style="margin-top: 12px;">
            <button type="button" class="camera-btn camera-btn--confirm" id="cam-capture">拍照</button>
            <button type="button" class="camera-btn camera-btn--cancel" id="cam-stop">取消</button>
          </div>
        </div>
      `

      videoEl = document.getElementById('cam-video') as HTMLVideoElement
      canvasEl = document.getElementById('cam-canvas') as HTMLCanvasElement

      await startCamera(videoEl)
      status = { state: 'streaming' }

      document.getElementById('cam-capture')?.addEventListener('click', handleCapture)
      document.getElementById('cam-stop')?.addEventListener('click', () => {
        cleanup()
        status = { state: 'idle' }
        render()
      })
    } catch (err: any) {
      status = { state: 'error', message: err.message || '無法開啟相機' }
      render()
    }
  }

  async function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return

    try {
      const dataUrl = await readFileAsDataURL(file)
      lastCapturedImageDataUrl = dataUrl
      status = { state: 'captured', imageDataUrl: dataUrl }
      render()
    } catch {
      status = { state: 'error', message: '檔案讀取失敗' }
      render()
    }
  }

  function handleCapture() {
    if (!videoEl || !canvasEl) return
    const dataUrl = captureFrame(videoEl, canvasEl)
    stopCamera()
    lastCapturedImageDataUrl = dataUrl
    status = { state: 'captured', imageDataUrl: dataUrl }
    render()
  }

  function renderCapturedPage(imageDataUrl: string) {
    container.innerHTML = `
      <div class="camera-page">
        <h3 style="text-align: center; margin-bottom: 12px;">預覽</h3>
        <img src="${imageDataUrl}" style="max-width: 100%; border-radius: 8px; margin-bottom: 12px;" alt="captured">
        <div class="camera-correction__actions">
          <button type="button" class="camera-btn camera-btn--confirm" id="cam-recognize">開始辨識</button>
          <button type="button" class="camera-btn camera-btn--cancel" id="cam-retake">重拍</button>
        </div>
      </div>
    `
    document.getElementById('cam-recognize')?.addEventListener('click', () => doRecognize(imageDataUrl))
    document.getElementById('cam-retake')?.addEventListener('click', () => {
      status = { state: 'idle' }
      render()
    })
  }

  async function doRecognize(imageDataUrl: string) {
    const taskId = ++recognitionTaskId
    const abortController = new AbortController()
    currentRecognitionAbort = abortController
    status = { state: 'recognizing' }
    render()

    // 先讓畫面有機會渲染，避免 UI 卡住導致「返回上一步」按不到
    await new Promise(resolve => setTimeout(resolve, 0))

    try {
      const result = await recognizeTiles(imageDataUrl, { signal: abortController.signal })
      if (taskId !== recognitionTaskId || abortController.signal.aborted) return
      status = { state: 'result', result }
      render()
    } catch (err: any) {
      if (taskId !== recognitionTaskId || abortController.signal.aborted || err?.name === 'AbortError') return
      status = { state: 'error', message: err.message || '辨識失敗' }
      render()
    } finally {
      if (currentRecognitionAbort === abortController) {
        currentRecognitionAbort = null
      }
    }
  }

  async function renderResultPage() {
    if (status.state !== 'result') return
    const result = status.result

    container.innerHTML = '<div id="correction-root"></div>'
    const root = document.getElementById('correction-root')!

    const corrected = await renderCorrectionUI(root, result)
    if (corrected) {
      cleanup()
      callbacks.onConfirm(corrected)
    } else {
      status = { state: 'idle' }
      render()
    }
  }

  function cleanup() {
    stopCamera()
    videoEl = null
    canvasEl = null
  }

  // 初始渲染
  render()
}
