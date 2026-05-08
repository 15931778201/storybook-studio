import { reactive } from 'vue'

export const bubbleManager = reactive({
  // targetId → { text, position, duration }
  active: {},

  show(targetId, text, options = {}) {
    this.active[targetId] = {
      text,
      position: options.position || 'top',
      duration: options.duration || 0,
      targetId
    }
  },

  hide(targetId) {
    delete this.active[targetId]
  },

  clear() {
    Object.keys(this.active).forEach(key => delete this.active[key])
  }
})