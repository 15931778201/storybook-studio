// setup.js
const fs = require('fs');
const path = require('path');

const files = {};

// ========== 根目录文件 ==========
files['package.json'] = `{
  "name": "storybook-engine",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "konva": "^9.2.0",
    "vue": "^3.4.0",
    "vue-konva": "^3.0.2"
  },
  "devDependencies": {
    "@vitejs/plugin-legacy": "^5.3.0",
    "@vitejs/plugin-vue": "^5.0.0",
    "vite": "^5.0.0",
    "vite-plugin-pwa": "^0.19.0"
  }
}`;

files['vite.config.js'] = `import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import legacy from '@vitejs/plugin-legacy'

export default defineConfig({
  plugins: [
    vue(),
    legacy({ targets: ['chrome >= 90'] }),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '交互式绘本引擎',
        short_name: '绘本',
        start_url: '.',
        display: 'standalone',
        background_color: '#f0ead6',
        theme_color: '#ff9f1c',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ]
})`;

files['index.html'] = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <meta name="theme-color" content="#ff9f1c" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <title>交互式绘本引擎</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>`;

// ========== src 文件 ==========
files['src/main.js'] = `import { createApp } from 'vue'
import VueKonva from 'vue-konva'
import App from './App.vue'
import './style.css'

const app = createApp(App)
app.use(VueKonva)
app.mount('#app')`;

files['src/style.css'] = `body {
  margin: 0;
  padding: 0;
  background: #f0ead6;
  font-family: 'KaiTi', serif;
  overflow: hidden;
}
.app {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  height: 100dvh;
}
.controls {
  margin-top: 8px;
  display: flex;
  gap: 12px;
  align-items: center;
}
.controls button {
  background: #ff9f1c;
  border: none;
  color: white;
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 14px;
  cursor: pointer;
  touch-action: manipulation;
}
.controls button:disabled {
  opacity: 0.4;
  cursor: default;
}`;

files['src/App.vue'] = `<template>
  <div class="app">
    <StoryPage :page="currentPage" />
    <div class="controls">
      <button @click="prevPage" :disabled="pageIndex <= 0">← 上一页</button>
      <span> {{ pageIndex + 1 }} / {{ story.pages.length }} </span>
      <button @click="nextPage" :disabled="pageIndex >= story.pages.length - 1">下一页 →</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import StoryPage from './components/StoryPage.vue'
import { useStageSize } from './composables/useStageSize.js'
import { globalState } from './engine/GlobalState.js'
import { actionRunner } from './engine/ActionRunner.js'
import story from './data/story-001.js'

const { stageWidth, stageHeight } = useStageSize()

onMounted(() => {
  globalState.stageWidth = stageWidth.value
  globalState.stageHeight = stageHeight.value

  actionRunner.on('nextPage', () => {
    if (pageIndex.value < story.pages.length - 1) pageIndex.value++
  })
  actionRunner.on('prevPage', () => {
    if (pageIndex.value > 0) pageIndex.value--
  })
  actionRunner.on('goToPage', (p) => {
    if (p >= 0 && p < story.pages.length) pageIndex.value = p
  })
})

const pageIndex = ref(0)
const currentPage = computed(() => story.pages[pageIndex.value])

function nextPage() {
  if (pageIndex.value < story.pages.length - 1) pageIndex.value++
}
function prevPage() {
  if (pageIndex.value > 0) pageIndex.value--
}
</script>`;

files['src/composables/useStageSize.js'] = `import { ref, onMounted, onBeforeUnmount } from 'vue'

export function useStageSize() {
  const ASPECT_RATIO = 4 / 5.6       // 竖版绘本比例
  const MAX_WIDTH = 800
  const PADDING = 20

  const stageWidth = ref(0)
  const stageHeight = ref(0)

  function updateSize() {
    const winWidth = window.innerWidth - PADDING
    const winHeight = window.innerHeight - PADDING
    let w = Math.min(winWidth, MAX_WIDTH)
    let h = w / ASPECT_RATIO

    if (h > winHeight) {
      h = winHeight
      w = h * ASPECT_RATIO
    }

    stageWidth.value = Math.floor(w)
    stageHeight.value = Math.floor(h)
  }

  onMounted(() => {
    updateSize()
    window.addEventListener('resize', updateSize)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('resize', updateSize)
  })

  return { stageWidth, stageHeight }
}`;

files['src/engine/GlobalState.js'] = `import { reactive } from 'vue'

export const globalState = reactive({
  collectibles: {},   // 收集品计数，如 { candy: 2, star: 5 }
  flags: {},          // 任意标记，如 { doorOpened: true }
  ui: {               // 全局UI面板显隐
    collectionPanel: false,
    settingsPanel: false
  },
  stageWidth: 0,
  stageHeight: 0
})`;

files['src/engine/ElementRegistry.js'] = `class ElementRegistry {
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
    if (comp && comp.remove) {
      comp.remove()
    }
    this.map.delete(id)
    this.states.delete(id)
  }

  playAnimation(id, name) {
    const comp = this.map.get(id)
    if (comp && comp.playAnimation) {
      comp.playAnimation(name)
    }
  }
}

export const elementRegistry = new ElementRegistry()`;

files['src/engine/SoundManager.js'] = `class SoundManager {
  constructor() {
    this.sounds = {}
    this.bgm = null
  }

  play(key, volume = 1) {
    if (!this.sounds[key]) {
      const audio = new Audio(\`/audio/\${key}\`)
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
    this.bgm = new Audio(\`/audio/\${key}\`)
    this.bgm.loop = true
    this.bgm.play().catch(() => {})
  }
}

export const soundManager = new SoundManager()`;

files['src/engine/BubbleManager.js'] = `import { reactive } from 'vue'

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
})`;

files['src/engine/ActionRunner.js'] = `import { globalState } from './GlobalState.js'
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

  // 执行动作序列
  async run(actions) {
    if (!actions || actions.length === 0) return
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
          bubbleManager.show(action.target, action.text, {
            position: action.position,
            duration: action.duration
          })
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
        default:
          console.warn(\`未知动作类型: \${type}\`)
      }
    } catch (err) {
      console.error(\`执行动作 \${type} 失败:\`, err)
    }
  }

  evaluateExpression(expr) {
    const ctx = {
      collectibles: globalState.collectibles,
      state: (id) => elementRegistry.getState(id),
      flag: globalState.flags
    }
    try {
      const fn = new Function(...Object.keys(ctx), \`return \${expr}\`)
      return fn(...Object.values(ctx))
    } catch {
      return false
    }
  }
}

export const actionRunner = new ActionRunner()`;

// ========== 通用元素组件 ==========

files['src/components/elements/Character.vue'] = `<template>
  <v-image
    ref="imgNode"
    :config="imgConfig"
    @click="handleClick"
    @touchend="handleClick"
  />
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { elementRegistry } from '../../engine/ElementRegistry.js'
import { actionRunner } from '../../engine/ActionRunner.js'
import { globalState } from '../../engine/GlobalState.js'

const props = defineProps({
  id: String,
  image: String,
  x: Number,
  y: Number,
  width: Number,
  height: Number,
  onClick: Array,
  animations: Array,
  draggable: Boolean
})

const imgNode = ref(null)
const loadedImage = ref(null)

// 预加载图片
const imageCache = new Map()
function getImage(src) {
  if (!imageCache.has(src)) {
    const img = new Image()
    img.src = \`/images/\${src}\`
    imageCache.set(src, img)
  }
  return imageCache.get(src)
}

const imgConfig = computed(() => {
  const img = getImage(props.image)
  loadedImage.value = img
  return {
    image: img,
    x: props.x * globalState.stageWidth,
    y: props.y * globalState.stageHeight,
    width: props.width ? props.width * globalState.stageWidth : undefined,
    height: props.height ? props.height * globalState.stageHeight : undefined,
    draggable: props.draggable || false,
    name: props.id
  }
})

function handleClick() {
  if (props.onClick) {
    actionRunner.run(props.onClick)
  }
}

// 暴露给注册表的方法
function applyState(state) {
  // 可在此根据状态切换图片等，目前留空可由子类定制
}

onMounted(() => {
  elementRegistry.register(props.id, { applyState, remove: () => {} })
})
onBeforeUnmount(() => {
  elementRegistry.unregister(props.id)
})

defineExpose({ applyState })
</script>`;

files['src/components/elements/SpeechBubble.vue'] = `<template>
  <v-group v-if="bubbleData" :config="groupConfig">
    <v-rect :config="bgConfig" />
    <v-text :config="textConfig" />
  </v-group>
</template>

<script setup>
import { computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { bubbleManager } from '../../engine/BubbleManager.js'
import { globalState } from '../../engine/GlobalState.js'

const props = defineProps({
  id: String,
  target: String,
  text: String,
  position: { type: String, default: 'top' },
  duration: { type: Number, default: 0 },
  autoShow: Boolean
})

const bubbleData = computed(() => {
  // 若绑定自身id或target，从bubbleManager获取气泡文本
  const data = bubbleManager.active[props.target || props.id]
  if (data) return data
  // 如果是自动显示模式，返回本地配置
  if (props.autoShow && props.text) return { text: props.text, position: props.position, duration: props.duration }
  return null
})

const groupConfig = computed(() => {
  // 简单定位在目标元素上方，此处需要获取目标元素位置
  // 生产环境中应通过elementRegistry.get(target).getNode()获取实际坐标
  // 这里只做粗略演示，实际使用需增强
  return {
    x: globalState.stageWidth * 0.2, // 占位
    y: globalState.stageHeight * 0.1,
    visible: !!bubbleData.value
  }
})

const bgConfig = computed(() => ({
  fill: 'white',
  stroke: '#ff9f1c',
  strokeWidth: 2,
  cornerRadius: 8,
  width: 200,
  height: 60
}))

const textConfig = computed(() => ({
  text: bubbleData.value?.text || '',
  fontSize: 14,
  fontFamily: 'sans-serif',
  fill: '#333',
  padding: 8,
  width: 190,
  align: 'center'
}))

// 监听 duration 自动隐藏
let hideTimer = null
watch(bubbleData, (val) => {
  if (hideTimer) clearTimeout(hideTimer)
  if (val && val.duration > 0) {
    hideTimer = setTimeout(() => {
      bubbleManager.hide(val.targetId)
    }, val.duration)
  }
})

onBeforeUnmount(() => {
  if (hideTimer) clearTimeout(hideTimer)
})
</script>`;

files['src/components/elements/Clickable.vue'] = `<template>
  <v-group :config="groupConfig" @click="handleClick" @touchend="handleClick">
    <v-rect v-if="visual" :config="rectConfig" />
  </v-group>
</template>

<script setup>
import { computed } from 'vue'
import { actionRunner } from '../../engine/ActionRunner.js'
import { globalState } from '../../engine/GlobalState.js'

const props = defineProps({
  id: String,
  hitArea: Object,    // { x, y, width, height }
  visual: Object,     // { image?, color?, opacity? }
  onClick: Array,
  cursor: { type: String, default: 'pointer' }
})

const groupConfig = computed(() => ({
  x: (props.hitArea?.x || 0) * globalState.stageWidth,
  y: (props.hitArea?.y || 0) * globalState.stageHeight,
  width: props.hitArea?.width * globalState.stageWidth,
  height: props.hitArea?.height * globalState.stageHeight,
  listening: true
}))

const rectConfig = computed(() => ({
  width: props.hitArea.width * globalState.stageWidth,
  height: props.hitArea.height * globalState.stageHeight,
  fill: props.visual?.color || 'transparent',
  opacity: props.visual?.opacity ?? 0.3,
  stroke: props.visual?.color ? 'transparent' : 'rgba(255,255,255,0)'
}))

function handleClick() {
  if (props.onClick) {
    actionRunner.run(props.onClick)
  }
}
</script>`;

files['src/components/elements/DragTarget.vue'] = `<template>
  <v-image
    ref="dragNode"
    :config="imgConfig"
    @dragstart="onDragStart"
    @dragend="onDragEnd"
  />
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { elementRegistry } from '../../engine/ElementRegistry.js'
import { actionRunner } from '../../engine/ActionRunner.js'
import { globalState } from '../../engine/GlobalState.js'

const props = defineProps({
  id: String,
  image: String,
  x: Number,
  y: Number,
  width: Number,
  dropZones: Array,  // [{ targetId, onDrop }]
  dragConstraints: Object
})

const dragNode = ref(null)
const originalPos = ref({ x: 0, y: 0 })

const imgConfig = computed(() => {
  const img = new Image()
  img.src = \`/images/\${props.image}\`
  return {
    image: img,
    x: props.x * globalState.stageWidth,
    y: props.y * globalState.stageHeight,
    width: props.width * globalState.stageWidth,
    draggable: true,
    dragBoundFunc: props.dragConstraints ? (pos) => {
      // 简单约束
      return pos
    } : undefined
  }
})

function onDragStart(e) {
  const node = dragNode.value.getNode()
  originalPos.value = { x: node.x(), y: node.y() }
}

function onDragEnd(e) {
  const node = dragNode.value.getNode()
  const pos = { x: node.x(), y: node.y() }
  let dropped = false

  // 检查是否有匹配的 dropZone
  if (props.dropZones) {
    for (const zone of props.dropZones) {
      const targetComp = elementRegistry.get(zone.targetId)
      if (targetComp && targetComp.getNode) {
        const targetNode = targetComp.getNode()
        const targetPos = targetNode.getAbsolutePosition()
        // 简单碰撞检测
        if (Math.abs(pos.x - targetPos.x) < 50 && Math.abs(pos.y - targetPos.y) < 50) {
          actionRunner.run(zone.onDrop)
          dropped = true
          break
        }
      }
    }
  }

  if (!dropped) {
    // 弹回原位
    node.to({ x: originalPos.value.x, y: originalPos.value.y, duration: 0.3 })
  } else {
    // 留在当前位置或移除
  }
}

onMounted(() => {
  elementRegistry.register(props.id, { getNode: () => dragNode.value?.getNode() })
})
onBeforeUnmount(() => {
  elementRegistry.unregister(props.id)
})
</script>`;

files['src/components/elements/Collectible.vue'] = `<template>
  <v-image
    ref="collectNode"
    :config="imgConfig"
    @click="collect"
  />
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { actionRunner } from '../../engine/ActionRunner.js'
import { globalState } from '../../engine/GlobalState.js'

const props = defineProps({
  id: String,
  image: String,
  x: Number,
  y: Number,
  width: Number,
  count: { type: Number, default: 1 },
  onCollect: Array,
  animateTo: Object,
  respawn: Boolean
})

const collectNode = ref(null)
const collected = ref(false)

const imgConfig = computed(() => {
  const img = new Image()
  img.src = \`/images/\${props.image}\`
  return {
    image: img,
    x: props.x * globalState.stageWidth,
    y: props.y * globalState.stageHeight,
    width: props.width * globalState.stageWidth,
    opacity: collected.value ? 0 : 1,
    listening: !collected.value
  }
})

function collect() {
  if (collected.value && !props.respawn) return
  collected.value = true
  // 执行收集动作
  const actions = props.onCollect || []
  // 自动添加计数增加动作
  actions.unshift({ type: 'addCollectible', item: props.id, count: props.count })
  actionRunner.run(actions)
  // 可选飞向目标
}
</script>`;

files['src/components/elements/Toggle.vue'] = `<template>
  <v-image
    ref="toggleNode"
    :config="imgConfig"
    @click="toggle"
  />
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { actionRunner } from '../../engine/ActionRunner.js'
import { globalState } from '../../engine/GlobalState.js'

const props = defineProps({
  id: String,
  states: Array,       // [{ image, text }]
  initialState: { type: Number, default: 0 },
  cycle: Boolean,
  onToggle: Array
})

const toggleNode = ref(null)
const currentIndex = ref(props.initialState)

const imgConfig = computed(() => {
  const state = props.states[currentIndex.value]
  const img = new Image()
  if (state?.image) img.src = \`/images/\${state.image}\`
  return {
    image: img,
    x: (props.x ?? 0) * globalState.stageWidth,
    y: (props.y ?? 0) * globalState.stageHeight,
    width: props.width ? props.width * globalState.stageWidth : undefined,
  }
})

function toggle() {
  if (props.cycle) {
    currentIndex.value = (currentIndex.value + 1) % props.states.length
  } else {
    if (currentIndex.value === 0) currentIndex.value = 1
    else currentIndex.value = 0
  }
  if (props.onToggle) {
    actionRunner.run(props.onToggle)
  }
}
</script>`;

files['src/components/elements/SequencePlayer.vue'] = `<template>
  <div></div>
</template>

<script setup>
import { onMounted } from 'vue'
import { actionRunner } from '../../engine/ActionRunner.js'

const props = defineProps({
  id: String,
  steps: Array,         // [{ action, delay }]
  trigger: { type: String, default: 'auto' },
  loop: Boolean,
  interruptible: Boolean
})

onMounted(() => {
  if (props.trigger === 'auto') {
    playSequence()
  }
})

async function playSequence() {
  do {
    for (const step of props.steps) {
      if (step.delay) {
        await new Promise(resolve => setTimeout(resolve, step.delay))
      }
      await actionRunner.run([step.action])
    }
  } while (props.loop)
}

// 可供外部调用
function start() {
  playSequence()
}

defineExpose({ start })
</script>`;

files['src/components/elements/Timer.vue'] = `<template>
  <v-group v-if="display" :config="posConfig">
    <v-text :config="timerText" />
  </v-group>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { actionRunner } from '../../engine/ActionRunner.js'
import { globalState } from '../../engine/GlobalState.js'

const props = defineProps({
  id: String,
  duration: Number,
  onTimeout: Array,
  display: Object,      // { style: 'text'|'bar', position: { x, y } }
  cancelOn: String,
  trigger: { type: String, default: 'auto' }
})

const remaining = ref(props.duration)
let timer = null

const posConfig = computed(() => ({
  x: props.display?.position?.x * globalState.stageWidth || 0,
  y: props.display?.position?.y * globalState.stageHeight || 0,
  visible: remaining.value > 0
}))

const timerText = computed(() => ({
  text: Math.ceil(remaining.value / 1000).toString(),
  fontSize: 24,
  fill: '#e63946'
}))

function startTimer() {
  const interval = 100
  timer = setInterval(() => {
    remaining.value -= interval
    if (remaining.value <= 0) {
      clearInterval(timer)
      actionRunner.run(props.onTimeout)
    }
  }, interval)
}

onMounted(() => {
  if (props.trigger === 'auto') startTimer()
})
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})

defineExpose({ start: startTimer })
</script>`;

// ========== StoryPage 渲染页面 ==========
files['src/components/StoryPage.vue'] = `<template>
  <div class="story-page" :style="{ width: globalState.stageWidth + 'px', height: globalState.stageHeight + 'px' }">
    <v-stage :config="stageConfig">
      <v-layer :config="{ listening: false }">
        <v-image :config="bgConfig" />
      </v-layer>
      <v-layer>
        <component
          v-for="el in page.elements"
          :key="el.id"
          :is="componentMap[el.type]"
          v-bind="el.props"
          :id="el.id"
        />
      </v-layer>
    </v-stage>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { globalState } from '../engine/GlobalState.js'
import Character from './elements/Character.vue'
import SpeechBubble from './elements/SpeechBubble.vue'
import Clickable from './elements/Clickable.vue'
import DragTarget from './elements/DragTarget.vue'
import Collectible from './elements/Collectible.vue'
import Toggle from './elements/Toggle.vue'
import SequencePlayer from './elements/SequencePlayer.vue'
import Timer from './elements/Timer.vue'

const componentMap = {
  character: Character,
  bubble: SpeechBubble,
  clickable: Clickable,
  draggable: DragTarget,
  collectible: Collectible,
  toggle: Toggle,
  sequence: SequencePlayer,
  timer: Timer
}

const props = defineProps({
  page: Object
})

const stageConfig = computed(() => ({
  width: globalState.stageWidth,
  height: globalState.stageHeight
}))

const imageCache = new Map()
function getImage(src) {
  if (!imageCache.has(src)) {
    const img = new Image()
    img.src = \`/images/\${src}\`
    imageCache.set(src, img)
  }
  return imageCache.get(src)
}

const bgConfig = computed(() => ({
  image: getImage(props.page.background),
  x: 0,
  y: 0,
  width: globalState.stageWidth,
  height: globalState.stageHeight
}))
</script>`;

// ========== 示例故事 ==========
files['src/data/story-001.js'] = `export default {
  meta: { title: '没有牙齿的大老虎' },
  pages: [
    {
      id: 1,
      background: 'bg-forest.png',
      elements: [
        {
          id: 'monkey',
          type: 'character',
          props: {
            image: 'monkey.png',
            x: 0.25, y: 0.6, width: 0.15,
            animations: [{ type: 'float', duration: 1500 }],
            onClick: [
              { type: 'showBubble', target: 'monkey', text: '嗬，比柱子还粗的树，大老虎只要用尖牙一啃就断！', duration: 3000 }
            ]
          }
        },
        {
          id: 'rabbit',
          type: 'character',
          props: {
            image: 'rabbit.png',
            x: 0.75, y: 0.65, width: 0.12,
            onClick: [
              { type: 'showBubble', target: 'rabbit', text: '大老虎嚼起铁杆来，跟吃面条一样……', duration: 3000 }
            ]
          }
        }
      ]
    }
    // 更多页面可继续添加
  ]
}`;

// ========== 公共资源占位 ==========
files['public/favicon.svg'] = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <text x="10" y="80" font-size="80">📖</text>
</svg>`;

files['public/icon-192.png'] = Buffer.alloc(0); // 占位，需替换
files['public/icon-512.png'] = Buffer.alloc(0); // 占位，需替换

// ========== 生成文件函数 ==========
function createFiles(baseDir, structure) {
  for (const [filePath, content] of Object.entries(structure)) {
    const fullPath = path.join(baseDir, filePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, content);
    console.log(`✅ ${filePath}`);
  }
}

// ========== 执行生成 ==========
const projectDir = process.cwd();
createFiles(projectDir, files);

console.log('\n🚀 脚手架已生成！');
console.log('请运行:  npm install && npm run dev');
console.log('⚠️  public/icon-192.png 和 icon-512.png 为占位文件，请替换为真实图标。');
console.log('📁 图片放入 public/images/，音效放入 public/audio/。');