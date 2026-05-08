class ElementRegistry {
  constructor() {
    this.map = new Map()   // id → { applyState, setImage, playAnimation, remove }
    this.states = new Map() // id → currentState
  }

  register(id, component) {
    this.map.set(id, component)
  }

  unregister(id) {
    this.map.delete(id)
  }

  get(id) {
    return this.map.get(id)
  }

  setState(id, state) {
    this.states.set(id, state)
    const comp = this.map.get(id)
    if (comp && comp.applyState) {
      comp.applyState(state)
    }
  }

  getState(id) {
    return this.states.get(id)
  }

  setImage(id, imageUrl) {
    const comp = this.map.get(id)
    if (comp && comp.setImage) {
      comp.setImage(imageUrl)
    }
  }

  remove(id) {
    const comp = this.map.get(id)
    if (comp) {
      // 优先使用组件自定义的 remove 方法
      if (comp.remove) {
        comp.remove()
      } else if (comp.getNode) {
        // 如果未提供 remove，尝试直接获取节点并销毁
        const node = comp.getNode()
        if (node) node.destroy()
      }
      this.map.delete(id)
      this.states.delete(id)
    }
  }

  /**
   * 播放指定ID组件的动画
   * @param {string|number} id - 组件的唯一标识符
   * @param {string} name - 要播放的动画名称
   */
  playAnimation(id, name) {
    // 从map中获取对应ID的组件
    const comp = this.map.get(id)
    // 检查组件是否存在且具有playAnimation方法
    if (comp && comp.playAnimation) {
      // 调用组件的playAnimation方法播放指定动画
      comp.playAnimation(name)
    }
  }
}

export const elementRegistry = new ElementRegistry()