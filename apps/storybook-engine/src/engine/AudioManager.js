class AudioManager {
  constructor() {
    this.sounds = {}
    this.bgm = null
    this.muted = false
    this.volume = 1
  }

  async preload(soundMap) {
    // soundMap: { key: 'url' }
    const promises = Object.entries(soundMap).map(([key, url]) => {
      return new Promise((resolve) => {
        const audio = new Audio(url)
        audio.preload = 'auto'
        audio.oncanplaythrough = () => {
          this.sounds[key] = audio
          resolve()
        }
        audio.onerror = () => resolve() // 失败不阻塞
      })
    })
    await Promise.all(promises)
  }

  play(key, options = {}) {
    if (this.muted) return
    const sound = this.sounds[key]
    if (!sound) return
    sound.volume = (options.volume ?? 1) * this.volume
    sound.currentTime = 0
    sound.play().catch(() => {})
  }

  // 背景音乐、静音、全局音量等方法 ...
}

export const audioManager = new AudioManager()