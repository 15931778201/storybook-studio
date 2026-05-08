import { globalState } from './GlobalState.js'
import { elementRegistry } from './ElementRegistry.js'
import { soundManager } from './SoundManager.js'
import { bubbleManager } from './BubbleManager.js'

class ActionRunner {
  constructor() {
    this.queue = []
    this.running = false
    this.customActions = {}
    this.events = {}
  }

  // 注册自定义动作
  registerAction(type, handler) {
    this.customActions[type] = handler
  }

  // 事件系统
  on(event, fn) {
    (this.events[event] = this.events[event] || []).push(fn)
  }
  emit(event, ...args) {
    (this.events[event] || []).forEach(fn => fn(...args))
  }
  async run(actions) {
    console.log('actions', actions)
    // 防御性处理：确保 actions 是数组
    if (!actions) return
    if (!Array.isArray(actions)) {
      actions = [actions]   // 单个动作对象包装为数组
    }
    this.queue.push(...actions)
    if (!this.running) await this.process()
  }
  async process() {
    this.running = true
    while (this.queue.length > 0) {
      const action = this.queue.shift()
      await this.execute(action)
    }
    this.running = false
  }

  async execute(action) {
    const { type } = action
    if (!type) return
    try {
      // 先尝试自定义动作
      if (this.customActions[type]) {
        await this.customActions[type](action)
        return
      }

      switch (type) {
        case 'playSound':
          soundManager.play(action.sound, action.volume)
          break
        case 'playBGM':
          soundManager.playBGM(action.sound)
          break
        case 'stopBGM':
          soundManager.stopBGM()
          break
        case 'showBubble':
          const dur = action.duration ?? 3000
          bubbleManager.show(action.target, action.text, {
            position: action.position || 'top',
            duration: 0
          })
          const shouldSpeak = (action.tts !== undefined) ? action.tts : globalState.ttsEnabled

          // 如果启用 TTS 并提供了文本，朗读结束后自动关闭气泡
          if (shouldSpeak && action.text) {
            const utterance = new SpeechSynthesisUtterance(action.text)
            utterance.lang = action.lang || 'zh-CN'
            utterance.rate = action.rate || 1
            utterance.pitch = action.pitch || 1
            utterance.volume = action.volume ?? 1

            utterance.onend = () => {
              bubbleManager.hide(action.target)
            }
            // 出错或中断时也隐藏，防止气泡卡住
            utterance.onerror = () => {
              bubbleManager.hide(action.target)
            }

            speechSynthesis.speak(utterance)
          } else {
            // 未启用 TTS，则使用原有的 duration 控制隐藏
            if (dur > 0) {
              setTimeout(() => {
                bubbleManager.hide(action.target)
              }, dur)
            }
          }
          break
        case 'hideBubble':
          bubbleManager.hide(action.target)
          break
        case 'setState':
          elementRegistry.setState(action.target, action.state)
          break
        case 'setImage':
          elementRegistry.setImage(action.target, action.image)
          break
        case 'removeElement':
          elementRegistry.remove(action.target)
          break
        case 'playAnimation':
          elementRegistry.playAnimation(action.target, action.animation)
          break
        case 'addCollectible':
          globalState.collectibles[action.item] = (globalState.collectibles[action.item] || 0) + (action.count || 1)
          break
        case 'setCollectible':
          globalState.collectibles[action.item] = action.count
          break
        case 'checkCollectible': {
          const cur = globalState.collectibles[action.item] || 0
          if (cur >= (action.count || 1) && action.onTrue) {
            await this.run(action.onTrue)
          } else if (action.onFalse) {
            await this.run(action.onFalse)
          }
          break
        }
        case 'nextPage':
          this.emit('nextPage')
          break
        case 'prevPage':
          this.emit('prevPage')
          break
        case 'goToPage':
          this.emit('goToPage', action.page)
          break
        case 'wait':
          await new Promise(resolve => setTimeout(resolve, action.duration))
          break
        case 'if': {
          const cond = this.evaluateExpression(action.condition)
          if (cond && action.then) await this.run(action.then)
          else if (!cond && action.else) await this.run(action.else)
          break
        }
        case 'persist':
          localStorage.setItem(action.key, JSON.stringify(action.value))
          break
        case 'showUI':
          globalState.ui[action.uiName] = true
          break
        case 'hideUI':
          globalState.ui[action.uiName] = false
          break
        case 'setFlag':
          globalState.flags[action.key] = action.value
          break
        case 'checkFlag': {
          const match = globalState.flags[action.key] === action.value
          if (match && action.onTrue) await this.run(action.onTrue)
          else if (!match && action.onFalse) await this.run(action.onFalse)
          break
        }
        case 'loop': {
          for (let i = 0; i < (action.count ?? 1); i++) {
            await this.run(action.actions)
          }
          break
        }
        case 'vibrate':
          if (window.navigator?.vibrate) {
            window.navigator.vibrate(action.pattern || 200)
          }
          break 
        case 'speak': {
          const utterance = new SpeechSynthesisUtterance(action.text)
          utterance.lang = action.lang || 'zh-CN'
          utterance.rate = action.rate || 1
          utterance.pitch = action.pitch || 1
          utterance.volume = action.volume ?? 1
          if (action.voice) {
            // 通过名称查找语音
            const voices = speechSynthesis.getVoices()
            const match = voices.find(v => v.name.includes(action.voice))
            if (match) utterance.voice = match
          }
          speechSynthesis.speak(utterance)
          break
        }
        case 'listenFor': {
          const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
          if (!SpeechRecognition) break
          const recognition = new SpeechRecognition()
          recognition.lang = action.lang || 'zh-CN'
          recognition.continuous = false
          recognition.interimResults = false
          recognition.maxAlternatives = 1

          recognition.onresult = async (event) => {
            const transcript = event.results[0][0].transcript
            if (action.expected && transcript.includes(action.expected)) {
              if (action.onMatch) await actionRunner.run(action.onMatch)
            } else {
              if (action.onNoMatch) await actionRunner.run(action.onNoMatch)
            }
          }
          recognition.onerror = async () => {
            if (action.onError) await actionRunner.run(action.onError)
          }
          recognition.start()
          break
        }         
        default:
          console.warn(`未知动作类型: ${type}`)
      }
    } catch (err) {
      console.error(`执行动作 ${type} 失败:`, err)
    }
  }

  evaluateExpression(expr) {
    const ctx = {
      collectibles: globalState.collectibles,
      state: (id) => elementRegistry.getState(id),
      flag: globalState.flags
    }
    try {
      const fn = new Function(...Object.keys(ctx), `return ${expr}`)
      return fn(...Object.values(ctx))
    } catch {
      return false
    }
  }
}

export const actionRunner = new ActionRunner()