// 音频播放与停止
import { ref } from 'vue'

export function useAudioPlayer() {
  const isPlaying = ref(false)
  let currentAudio: HTMLAudioElement | null = null

  function play(
    url: string,
    onEnd?: () => void,
    onError?: (err: any) => void
  ) {
    // 停止当前播放
    stop()

    const audio = new Audio(url)
    currentAudio = audio
    isPlaying.value = true

    audio.onended = () => {
      if (currentAudio === audio) {
        currentAudio = null
        isPlaying.value = false
      }
      onEnd?.()
    }

    audio.onerror = (e) => {
      if (currentAudio === audio) {
        currentAudio = null
        isPlaying.value = false
      }
      onError?.(e)
    }

    audio.play().catch((err) => {
      if (currentAudio === audio) {
        currentAudio = null
        isPlaying.value = false
      }
      onError?.(err)
    })
  }

  function stop() {
    if (currentAudio) {
      currentAudio.pause()
      currentAudio.onended = null
      currentAudio.onerror = null
      currentAudio = null
      isPlaying.value = false
    }
  }

  return { isPlaying, play, stop }
}