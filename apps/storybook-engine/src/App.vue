<template>
  <div class="app">
    <!-- 编辑工具栏 -->
    <div v-if="editMode" class="editor-toolbar">
      <button @click="enterCropMode" :disabled="!selectedElementId">✂️ 裁剪</button>
      <button @click="exportCurrentPage">📋 复制当前页 JSON</button>
      <button @click="exportAllPages">📦 导出整本绘本</button>
      <button @click="disableEdit">退出编辑</button>
      <span style="color:white; margin-left: 12px;">选中: {{ selectedElementId || '无' }}</span>
    </div>

    <StoryPage
      :page="currentPage"
      :edit-mode="editMode"
      :selected-element-id="selectedElementId"
      @update:element="updateElement"
      @select="onElementSelect"
      @crop-save="saveCrop"
    />

    <!-- 属性检查器 -->
    <InspectorPanel
      v-if="editMode && selectedElement"
      :visible="showConfigDialog"
      :element="selectedElement"
      @update="handleInspectorUpdate"
      @close="showConfigDialog = false"
    />

    <!-- 底部对话框 -->
    <BottomDialog
      :visible="globalState.ui.bottomDialog"
      title="📖 使用帮助"
      @close="globalState.ui.bottomDialog = false"
    >
      <!-- 对话框内容：可以根据模式动态更换 -->
      <div v-if="editMode">
        <h4>编辑模式快捷键</h4>
        <ul>
          <li><b>点击元素</b>：选中（显示变换框）</li>
          <li><b>拖动元素</b>：移动位置</li>
          <li><b>拖动四角</b>：等比缩放</li>
          <li><b>按住 Ctrl/⌘ 点击</b>：测试当前元素的 onClick 动作</li>
          <li><b>工具栏 ✂️ 裁剪</b>：进入裁剪模式</li>
          <li><b>复制当前页 JSON</b>：导出配置</li>
        </ul>
      </div>
      <div v-else>
        <h4>欢迎来到森林奇遇记！</h4>
        <p>👉 点击小动物和他们说话</p>
        <p>👉 把糖果拖给大老虎</p>
        <p>👉 帮助狐狸医生拔掉蛀牙</p>
        <p>祝你玩得开心！😊</p>
      </div>
    </BottomDialog>
    <div class="controls">
      <button @click="prevPage" :disabled="pageIndex <= 0">← 上一页</button>
      <span>{{ pageIndex + 1 }} / {{ editablePages.length }}</span>
      <button @click="nextPage" :disabled="pageIndex >= editablePages.length - 1">下一页 →</button>
      <button @click="globalState.ui.bottomDialog = true">❓ 帮助</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watchEffect, watch, reactive, provide } from 'vue'
import StoryPage from './components/StoryPage.vue'
import BottomDialog from './components/BottomDialog.vue'
import InspectorPanel from './components/InspectorPanel.vue'
import { useStageSize } from './composables/useStageSize.js'
import { useEditor } from './composables/useEditor.js'
import { useCrop } from './composables/useCrop.js'
import { globalState } from './engine/GlobalState.js'
import { actionRunner } from './engine/ActionRunner.js'
import storyData from './data/story-001.js'

const { stageWidth, stageHeight } = useStageSize()
const { editMode, disableEdit, selectedElementId, selectElement, clearSelection } = useEditor()
const { isCropping, cropTarget, cropRect, startCrop, stopCrop, updateCropRect } = useCrop()

provide('crop', { isCropping, cropTarget, cropRect, startCrop, stopCrop, updateCropRect })

// 使用可编辑的深拷贝
const editablePages = reactive(
  storyData.pages.map(page => ({
    ...page,
    elements: page.elements.map(el => ({
      ...el,
      props: { ...el.props }
    }))
  }))
)

const pageIndex = ref(0)
const currentPage = computed(() => editablePages[pageIndex.value])
const selectedElement = computed(() => {
  if (!selectedElementId.value) return null
  return currentPage.value.elements.find(e => e.id === selectedElementId.value)
})
// 旁白相关
let currentNarrationQueue = []          // 当前页待读的句子
let narrationIndex = 0
let isNarrating = false

// 开始播放当前页旁白
async function startNarration(page) {
  if (!page.narration || !globalState.ttsEnabled) return
  // 准备句子队列
  const raw = page.narration
  currentNarrationQueue = typeof raw === 'string' ? [raw] : raw
  narrationIndex = 0
  isNarrating = true

  // 朗读队列中的所有句子
  while (narrationIndex < currentNarrationQueue.length && isNarrating) {
    const text = currentNarrationQueue[narrationIndex]
    await speakText(text)
    narrationIndex++
  }

  // 本页旁白播放完毕，自动翻页（如果还有下一页）
  if (isNarrating) {
    if (pageIndex.value < editablePages.length - 1) {
      // 隔3秒自动翻页
      setTimeout(() => {
        nextPage()
      }, 3000)
    }
  }
  isNarrating = false
}

// 朗读单句，返回 Promise
function speakText(text) {
  return new Promise((resolve) => {
    if (!globalState.ttsEnabled) {
      resolve()
      return
    }
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'zh-CN'
    utterance.rate = 1
    utterance.onend = resolve
    utterance.onerror = resolve   // 失败也继续，避免卡住
    speechSynthesis.speak(utterance)
  })
}

// 监听页面切换
watch(pageIndex, async (newIdx) => {
  // 停止正在进行的旁白
  if (isNarrating) {
    speechSynthesis.cancel()
    isNarrating = false
  }
  // 编辑模式不自动旁白
  if (editMode.value) return
  // 开始新页旁白
  const page = editablePages[newIdx]
  if (page) {
    startNarration(page)
  }
}, { immediate: true })

// 元素更新（拖拽/缩放/裁剪参数）
function updateElement({ elementId, x, y, width, height, ...others }) {
  const page = editablePages[pageIndex.value]
  const el = page.elements.find(e => e.id === elementId)
  if (!el) return

  // 针对点击操作的更新（hitArea）
  if (el.props.hitArea) {
    if (x !== undefined) el.props.hitArea.x = x
    if (y !== undefined) el.props.hitArea.y = y
    if (width !== undefined) el.props.hitArea.width = width
    if (height !== undefined) el.props.hitArea.height = height
  } else {
    if (x !== undefined) el.props.x = x
    if (y !== undefined) el.props.y = y
    if (width !== undefined) el.props.width = width
    if (height !== undefined) el.props.height = height
  }
  // 其他自定义字段直接合并
  Object.keys(others).forEach(key => {
    if (typeof others[key] === 'object' && el.props[key]) {
      Object.assign(el.props[key], others[key])
    } else {
      el.props[key] = others[key]
    }
  })
}

// Inspector 发来的更新 (props 对象)
function handleInspectorUpdate({ elementId, props: patch }) {
  const page = editablePages[pageIndex.value]
  const el = page.elements.find(e => e.id === elementId)
  if (!el) return
  if (patch.hitArea && el.props.hitArea) {
    Object.assign(el.props.hitArea, patch.hitArea)
  } else if (patch.x !== undefined || patch.y !== undefined || patch.width !== undefined || patch.height !== undefined) {
    if (el.props.hitArea) {
      if (patch.x !== undefined) el.props.hitArea.x = patch.x
      // ...
    } else {
      Object.assign(el.props, patch)
    }
  } else {
    // 动作更新
    Object.keys(patch).forEach(key => {
      el.props[key] = patch[key]
    })
  }
}

// 裁剪保存
function saveCrop(elementId, rect) {
  updateElement({ elementId, crop: { ...rect } })
}

// 进入裁剪模式
function enterCropMode() {
  if (!selectedElementId.value || isCropping.value) return
  const el = currentPage.value.elements.find(e => e.id === selectedElementId.value)
  startCrop(selectedElementId.value, el.props.crop || null)
}

// 封装元素选择处理，自动处理裁剪模式退出保存
function onElementSelect(id) {
  // 如果正在裁剪，不切换选中（或直接忽略）
  if (isCropping.value) return
  selectElement(id)
  openElementConfig()
}

// 导出当前页 JSON
function exportCurrentPage() {
  const page = JSON.parse(JSON.stringify(editablePages[pageIndex.value]))
  // 清理内部属性（如果有）
  page.elements.forEach(el => {
    // 移除临时添加的 _xxx 属性
    Object.keys(el.props).forEach(key => {
      if (key.startsWith('_')) delete el.props[key]
    })
  })
  navigator.clipboard.writeText(JSON.stringify(page, null, 2))
    .then(() => alert('当前页 JSON 已复制到剪贴板！'))
}

// 翻页
function nextPage() { if (pageIndex.value < editablePages.length - 1) pageIndex.value++ }
function prevPage() { if (pageIndex.value > 0) pageIndex.value-- }

// 新增状态
const showConfigDialog = ref(false)
const elementConfigText = ref('')

// 获取当前选中元素的配置文本
function openElementConfig() {
  if (!selectedElementId.value) return
  const el = currentPage.value.elements.find(e => e.id === selectedElementId.value)
  if (!el) return
  // 生成格式化文本
  const config = {
    id: el.id,
    type: el.type,
    props: { ...el.props }
  }
  elementConfigText.value = JSON.stringify(config, null, 2)
  showConfigDialog.value = true
}

function exportAllPages() {
  const book = {
    meta: storyData.meta,
    pages: editablePages.map(page => {
      const clean = JSON.parse(JSON.stringify(page))
      clean.elements.forEach(el => {
        Object.keys(el.props).forEach(key => {
          if (key.startsWith('_')) delete el.props[key]
        })
      })
      return clean
    })
  }
  const blob = new Blob([JSON.stringify(book, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'story-full.json'
  a.click()
  URL.revokeObjectURL(url)
}

// 尺寸同步
watchEffect(() => {
  globalState.stageWidth = stageWidth.value
  globalState.stageHeight = stageHeight.value
})

// 监听动作翻页
actionRunner.on('nextPage', nextPage)
actionRunner.on('prevPage', prevPage)
actionRunner.on('goToPage', (p) => {
  if (p >= 0 && p < editablePages.length) pageIndex.value = p
})
</script>

<style>
body {
  margin: 0; padding: 0; background: #222; font-family: 'KaiTi', serif;
  overflow: hidden;
}
.app {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  height: 100vh; height: 100dvh;
}
.controls {
  margin-top: 8px; display: flex; gap: 12px; align-items: center; color: white;
}
.controls button {
  background: #ff9f1c; border: none; color: white; padding: 6px 16px;
  border-radius: 20px; cursor: pointer;
}
.controls button:disabled { opacity: 0.4; cursor: default; }
.editor-toolbar {
  position: fixed; top: 10px; right: 10px; background: rgba(0,0,0,0.8);
  color: white; padding: 6px 12px; border-radius: 8px;
  display: flex; gap: 8px; align-items: center; z-index: 999;
}
.editor-toolbar button {
  background: #00b4d8; border: none; color: white; padding: 4px 10px;
  border-radius: 4px; cursor: pointer;
}
.editor-toolbar button:disabled { opacity: 0.5; cursor: default; }
.config-content pre {
  background: #f5f7fa;
  padding: 12px;
  border-radius: 8px;
  font-size: 13px;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0 0 12px 0;
}
.copy-btn {
  background: #00b4d8;
  border: none;
  color: white;
  padding: 6px 14px;
  border-radius: 6px;
  cursor: pointer;
}
</style>