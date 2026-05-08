<template>
  <div class="story-page" :style="{ width: globalState.stageWidth + 'px', height: globalState.stageHeight + 'px' }">
    <v-stage ref="stageRef" :config="stageConfig">
      <!-- 背景层 -->
      <v-layer :config="{ listening: false, zIndex: 0 }">
        <v-image :config="bgConfig" />
      </v-layer>

      <!-- 交互层 -->
      <v-layer :config="{ zIndex: 1 }">
        <component
          v-for="el in page.elements"
          :key="el.id"
          :is="componentMap[el.type]"
          v-bind="el.props"
          :id="el.id"
          :edit-mode="editMode"
          @click="onElementClick(el.id, $event)"
          @dragend="handleDragEnd(el.id, $event)" 
        />
        <!-- -->
      </v-layer>

      <!-- 编辑模式：元素变换器（缩放/移动） -->
      <v-layer v-if="editMode && selectedElement && showTransformer" :config="{ zIndex: 5 }">
        <v-transformer
          v-if="selectedNode"
          :config="transformerConfig"
          @transformend="handleTransformEnd"
        />
      </v-layer>

      <!-- 裁剪模式：遮罩 + 裁剪框 + 确定/取消按钮 -->
      <v-layer v-if="editMode && isCropping" :config="{ zIndex: 10 }">
        <v-rect :config="cropMaskConfig" />
        <v-rect
          ref="cropBoxRef"
          :config="cropBoxConfig"
          draggable
          @dragend="onCropBoxChanged"
          @transformend="onCropBoxChanged"
        />
        <v-transformer
          v-if="cropBoxRef"
          :config="cropTransformerConfig"
        />
      </v-layer>

      <!-- 裁剪模式下的按钮（独立层，最高层级） -->
      <v-layer v-if="editMode && isCropping" :config="{ zIndex: 15 }">
        <!-- 确定按钮 -->
        <v-group :config="confirmBtnGroup" @click="confirmCrop">
          <v-rect :config="confirmBtnBg" />
          <v-text :config="{ text: '✓ 确定', fontSize: 16, fill: '#fff', x: 10, y: 8 }" />
        </v-group>
        <!-- 取消按钮 -->
        <v-group :config="cancelBtnGroup" @click="cancelCrop">
          <v-rect :config="cancelBtnBg" />
          <v-text :config="{ text: '✕ 取消', fontSize: 16, fill: '#fff', x: 10, y: 8 }" />
        </v-group>
      </v-layer>
    </v-stage>
  </div>
</template>

<script setup>
import { ref, computed, inject } from 'vue'
import { globalState } from '../engine/GlobalState.js'
import { elementRegistry } from '../engine/ElementRegistry.js'
import Character from './elements/Character.vue'
import SpeechBubble from './elements/SpeechBubble.vue'
import Clickable from './elements/Clickable.vue'
import DragTarget from './elements/DragTarget.vue'
import Collectible from './elements/Collectible.vue'
import Toggle from './elements/Toggle.vue'
import SequencePlayer from './elements/SequencePlayer.vue'
import Timer from './elements/Timer.vue'

const componentMap = {
  character: Character, bubble: SpeechBubble, clickable: Clickable,
  draggable: DragTarget, collectible: Collectible, toggle: Toggle,
  sequence: SequencePlayer, timer: Timer
}

const props = defineProps({
  page: Object,
  editMode: Boolean,
  selectedElementId: String
})

const emit = defineEmits(['update:element', 'select', 'crop-save'])

const stageRef = ref(null)
const cropBoxRef = ref(null)

// 注入裁剪状态
const { isCropping, cropTarget, cropRect, updateCropRect, stopCrop } = inject('crop', { isCropping: ref(false) })

const stageConfig = computed(() => ({
  width: globalState.stageWidth, height: globalState.stageHeight
}))

// 背景
const imageCache = new Map()
function getImage(src) {
  if (!imageCache.has(src)) {
    const img = new Image()
    img.src = `/images/${src}`
    imageCache.set(src, img)
  }
  return imageCache.get(src)
}
const bgConfig = computed(() => ({
  image: getImage(props.page.background),
  x: 0, y: 0, width: globalState.stageWidth, height: globalState.stageHeight
}))

// 选择逻辑
function onElementClick(id, event) {
  if (!props.editMode) return
  emit('select', id)
  event?.stopPropagation?.()
}

// ========== 编辑器节点获取 ==========
// 优先使用 getNodeForEdit（Image），不存在则回退到 getNode（Group）
function getEditNode(id) {
  const comp = elementRegistry.get(id)
  if (comp?.getNodeForEdit) return comp.getNodeForEdit()
  return comp?.getNode?.()
}

const selectedElement = computed(() => {
  if (!props.selectedElementId) return null
  return props.page.elements.find(e => e.id === props.selectedElementId)
})

const selectedNode = computed(() => {
  if (!selectedElement.value || isCropping.value) return null
  return elementRegistry.get(selectedElement.value.id)?.getNode?.()
})

// 根据元素类型决定是否显示缩放锚点
const showTransformer = computed(() => {
  const type = selectedElement.value?.type
  return type !== 'sequence' && type !== 'timer'  // sequence/timer 仅移动不缩放，但为了可移动，仍需 transformer
})

// ========== Transformer 配置（作用于 Image 节点） ==========
const transformerConfig = computed(() => {
  const type = selectedElement.value?.type
  // 可缩放类型列表
  const scalableTypes = ['character', 'clickable', 'draggable', 'collectible', 'toggle']
  const canScale = scalableTypes.includes(type)
  return {
    node: selectedNode.value,
    enabledAnchors: canScale
      ? ['top-left', 'top-right', 'bottom-left', 'bottom-right']
      : ['top-left', 'top-right', 'bottom-left', 'bottom-right'],  // 给所有类型锚点，但非等比缩放类型不强制 keepRatio
    rotateEnabled: false,
    keepRatio: canScale ? true : false,
    boundBoxFunc: (oldBox, newBox) => {
      if (newBox.width < 20 || newBox.height < 20) return oldBox
      return newBox
    }
  }
})

function handleTransformEnd(e) {
  if (!props.selectedElementId) return
  const node = e.target
  const stage = stageRef.value?.getStage()
  const scaleX = node.scaleX()
  const newWidth = (node.width() * scaleX) / stage.width()
  const newHeight = (node.height() * scaleX) / stage.height()
  const newX = node.x() / stage.width()
  const newY = node.y() / stage.height()

  // 重置缩放并固化尺寸
  node.scaleX(1)
  node.scaleY(1)
  node.width(node.width() * scaleX)
  node.height(node.height() * scaleX)

  const elType = selectedElement.value?.type
  const updateData = { elementId: props.selectedElementId }

  if (elType === 'clickable') {
    // 更新 hitArea
    updateData.x = newX
    updateData.y = newY
    updateData.width = newWidth
    updateData.height = newHeight
  } else {
    updateData.x = newX
    updateData.y = newY
    updateData.width = newWidth
    updateData.height = newHeight
  }
  emit('update:element', updateData)
}

// ========== 裁剪功能 ==========
const cropMaskConfig = computed(() => ({
  x: 0, y: 0,
  width: globalState.stageWidth,
  height: globalState.stageHeight,
  fill: 'rgba(0,0,0,0.5)',
  listening: true          // 阻止点击穿透到下层元素
}))

function getElementNode(id) {
  return elementRegistry.get(id)?.getNode?.()   // 获取 Group 节点，用于计算位置
}

const cropBoxConfig = computed(() => {
  if (!isCropping.value || !cropTarget.value) return {}
  const node = getElementNode(cropTarget.value)
  if (!node) return {}
  const box = node.getClientRect()
  const rect = cropRect.value
  return {
    x: box.x + rect.x * box.width,
    y: box.y + rect.y * box.height,
    width: rect.width * box.width,
    height: rect.height * box.height,
    fill: '', stroke: '#00b4d8', strokeWidth: 2, dash: [6, 4],
  }
})

const cropTransformerConfig = computed(() => ({
  node: cropBoxRef.value?.getNode(),
  enabledAnchors: ['top-left','top-right','bottom-left','bottom-right'],
  rotateEnabled: false,
  keepRatio: false,
  boundBoxFunc: (oldBox, newBox) => {
    const node = getElementNode(cropTarget.value)
    if (!node) return oldBox
    const box = node.getClientRect()
    if (newBox.x < box.x) newBox.x = box.x
    if (newBox.y < box.y) newBox.y = box.y
    if (newBox.x + newBox.width > box.x + box.width) newBox.width = box.x + box.width - newBox.x
    if (newBox.y + newBox.height > box.y + box.height) newBox.height = box.y + box.height - newBox.y
    return newBox
  }
}))

function onCropBoxChanged() {
  const boxNode = cropBoxRef.value?.getNode()
  if (!boxNode || !cropTarget.value) return
  const node = getElementNode(cropTarget.value)
  const client = node.getClientRect()
  const newRect = {
    x: (boxNode.x() - client.x) / client.width,
    y: (boxNode.y() - client.y) / client.height,
    width: (boxNode.width() * boxNode.scaleX()) / client.width,
    height: (boxNode.height() * boxNode.scaleY()) / client.height,
  }
  updateCropRect(newRect)
}

// 确定裁剪
function confirmCrop() {
  // 先确保当前裁剪框数据已更新
  onCropBoxChanged()
  if (cropTarget.value) {
    emit('crop-save', { elementId: cropTarget.value, rect: { ...cropRect.value } })
  }
  stopCrop()   // 退出裁剪模式
}

// 取消裁剪
function cancelCrop() {
  stopCrop()   // 直接退出，不保存
}

// 获取节点的绝对位置，除以舞台尺寸得到比例
function handleDragEnd(elementId, e) {
  if (!props.editMode) return
  const node = e.target
  const stage = stageRef.value?.getStage()
  if (!stage) return
  // 获取节点在舞台上的绝对位置
  const pos = node.getAbsolutePosition()
  const newX = pos.x / stage.width()
  const newY = pos.y / stage.height()
  emit('update:element', { elementId, x: newX, y: newY })
}

// 按钮位置（底部居中）
const btnY = computed(() => globalState.stageHeight - 60)
const confirmBtnGroup = computed(() => ({
  x: globalState.stageWidth / 2 - 90,
  y: btnY.value,
  listening: true
}))
const confirmBtnBg = computed(() => ({
  width: 70, height: 36,
  fill: '#00b4d8',
  cornerRadius: 6,
  shadowBlur: 4
}))
const cancelBtnGroup = computed(() => ({
  x: globalState.stageWidth / 2 + 20,
  y: btnY.value,
  listening: true
}))
const cancelBtnBg = computed(() => ({
  width: 70, height: 36,
  fill: '#e63946',
  cornerRadius: 6,
  shadowBlur: 4
}))
</script>

<style scoped>
.story-page {
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>