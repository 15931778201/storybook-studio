class SoundManager {
  constructor() {
    this.sounds = {}
    this.bgm = null
  }

  play(key, volume = 1) {
    if (!this.sounds[key]) {
      const audio = new Audio(`/audio/${key}`)
      audio.volume = volume
      this.sounds[key] = audio
    }
    this.sounds[key].currentTime = 0
    this.sounds[key].play().catch(() => {})
  }

  stopBGM() {
    if (this.bgm) {
      this.bgm.pause()
      this.bgm = null
    }
  }

  playBGM(key) {
    this.stopBGM()
    this.bgm = new Audio(`/audio/${key}`)
    this.bgm.loop = true
    this.bgm.play().catch(() => {})
  }
}

export const soundManager = new SoundManager()