// 自动翻页调度
import { ref } from 'vue'
import type { BookPage } from '@/types/book'

export function useAutoPageTurn() {
  const autoPlay = ref(false)
  let autoTurnTimer: ReturnType<typeof setTimeout> | null = null
  let autoPageTurnPending = false

  function clearTimer() {
    if (autoTurnTimer) {
      clearTimeout(autoTurnTimer)
      autoTurnTimer = null
    }
  }

  /**
   * 安排当前页的自动翻页（由组件在页面变更后调用）
   * @param currentPage 当前页数据
   * @param playFn 播放音频的函数，接受 url, onEnd, onError
   * @param onTurn 实际执行翻页的回调
   */
  function scheduleTurn(
    currentPage: BookPage | null,
    playFn: (
      url: string,
      onEnd: () => void,
      onError: (err: any) => void
    ) => void,
    onTurn: () => void
  ) {
    // 防止重复安排
    if (!autoPlay.value || autoPageTurnPending) return

    // 清除之前的定时器和 pending
    clearTimer()
    autoPageTurnPending = true

    const audioUrl = currentPage?.narrationAudioUrl

    if (audioUrl) {
      // 播放音频，结束后翻页
      playFn(
        audioUrl,
        () => {
          // 音频自然结束
          if (autoPlay.value) {
            onTurn()
          } else {
            autoPageTurnPending = false
          }
        },
        (_err) => {
          // 播放失败：关闭自动播放，重置 pending
          autoPlay.value = false
          autoPageTurnPending = false
        }
      )
    } else {
      // 无音频：短暂延迟后翻页
      autoTurnTimer = setTimeout(() => {
        autoTurnTimer = null
        if (autoPlay.value) {
          onTurn()
        } else {
          autoPageTurnPending = false
        }
      }, 100)
    }
  }

  /** 翻页执行后，需要调用此函数清理 pending（由组件在完成翻页后调用） */
  function onTurnCompleted() {
    autoPageTurnPending = false
  }

  function start() {
    autoPlay.value = true
  }

  function stop() {
    autoPlay.value = false
    clearTimer()
    autoPageTurnPending = false
  }

  function toggle() {
    if (autoPlay.value) stop()
    else start()
  }

  return {
    autoPlay,
    scheduleTurn,
    onTurnCompleted,
    start,
    stop,
    toggle
  }
}