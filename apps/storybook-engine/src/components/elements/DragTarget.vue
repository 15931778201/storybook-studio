<template>
  <v-group ref="dragGroup" :config="groupConfig" @click="handleClick" @dragend="onDragEnd">
    <!-- 图片加载失败占位 -->
    <v-rect v-if="!imageLoaded" :config="fallbackRect" />
    <v-image v-if="imageLoaded" :config="imgConfig" />
  </v-group>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { globalState } from '../../engine/GlobalState.js'
import { actionRunner } from '../../engine/ActionRunner.js'
import { elementRegistry } from '../../engine/ElementRegistry.js'

const props = defineProps({
  id: String,
  image: String,
  x: Number,
  y: Number,
  width: Number,
  height: Number,             // 可选，未提供则根据图片比例自动计算
  dropZones: Array,           // 拖拽目标信息
  snapBack: Boolean,
  onClick: Array,             // 播放模式下的点击动作
  editMode: Boolean,          // 编辑模式标记
  crop: Object                // 裁剪比例 { x, y, width, height }
})

const emit = defineEmits(['click', 'dragend'])  // 编辑模式的选中与拖拽结束

const dragGroup = ref(null)
const imageObj = ref(null)
const imageLoaded = ref(false)

// 图片加载
function loadImage(src) {
  if (!src) { imageLoaded.value = false; return }
  const img = new Image()
  img.onload = () => {
    imageObj.value = img
    imageLoaded.value = true
  }
  img.onerror = () => { imageLoaded.value = false }
  img.src = src.startsWith('data:') ? src : `/images/${src}`
}

watch(() => props.image, val => loadImage(val), { immediate: true })

// 图片原始宽高比（用于未提供高度时自动计算）
const imageRatio = computed(() => {
  const img = imageObj.value
  if (!img || !img.naturalWidth || !img.naturalHeight) return 1
  return img.naturalHeight / img.naturalWidth
})

// 外层 Group 配置（编辑模式下禁用原生拖拽，统一由 Transformer 控制）
const groupConfig = computed(() => {
  const w = (props.width ?? 0.1) * globalState.stageWidth
  // 高度：优先使用 props.height，否则根据图片比例自动计算
  const baseH = props.height
    ? props.height * globalState.stageHeight
    : w * imageRatio.value

  return {
    x: (props.x ?? 0) * globalState.stageWidth,
    y: (props.y ?? 0) * globalState.stageHeight,
    width: w,
    height: baseH,
    draggable: props.editMode ? false : true,   // 编辑模式下由 Transformer 接管移动
    name: props.id,
    listening: true
  }
})

// 占位矩形（图片未加载时显示）
const fallbackRect = computed(() => ({
  width: (props.width ?? 0.1) * globalState.stageWidth,
  height: (props.height ?? (props.width ?? 0.1)) * globalState.stageWidth,
  fill: '#a0c4ff', stroke: '#3a7bd5', strokeWidth: 2, cornerRadius: 4
}))

// 图片渲染配置（等比缩放 + 可选裁剪）
const imgConfig = computed(() => {
  const img = imageObj.value
  if (!img) return {}

  const baseW = props.width ? props.width * globalState.stageWidth : undefined
  const baseH = props.height ? props.height * globalState.stageHeight : undefined

  let finalW = baseW || (baseH ? (baseH * img.naturalWidth / img.naturalHeight) : undefined)
  let finalH = baseH || (baseW ? (baseW * img.naturalHeight / img.naturalWidth) : undefined)

  const config = { image: img, width: finalW, height: finalH }

  // 裁剪支持
  if (props.crop && img.naturalWidth && img.naturalHeight) {
    config.crop = {
      x: props.crop.x * img.naturalWidth,
      y: props.crop.y * img.naturalHeight,
      width: props.crop.width * img.naturalWidth,
      height: props.crop.height * img.naturalHeight,
    }
  }
  return config
})

// 点击处理：编辑模式发送选中事件，播放模式运行动作（支持修饰键测试）
function handleClick(e) {
  if (props.editMode) {
    // 按住 Ctrl/⌘ 测试动作
    if ((e?.evt?.ctrlKey || e?.evt?.metaKey) && props.onClick) {
      actionRunner.run(props.onClick)
      return
    }
    emit('click', props.id)       // 选中元素
  } else if (props.onClick) {
    actionRunner.run(props.onClick)
  }
}

// 原生拖拽结束（非编辑模式下自动触发，编辑模式不会触发）
function onDragEnd(e) {
  const node = dragGroup.value.getNode()
  const pos = { x: node.x(), y: node.y() }
  let dropped = false  
  // 编辑模式：由 StoryPage 的 Transformer 处理移动，不在这里修改坐标
  if (props.editMode) return
  // 播放模式：这里可以调用 dropZones 检查逻辑，或保留原有行为
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
  // 如果你已经在 StoryPage 统一处理了 dragend，此处可以留空或触发预览
  // if (!dropped) {
  //   // 弹回原位
  //   node.to({ x: originalPos.value.x, y: originalPos.value.y, duration: 0.3 })
  // } else {
  //   // 留在当前位置或移除
  // }
}

// 注册表：提供节点供 Transformer 使用
onMounted(() => {
  elementRegistry.register(props.id, {
    getNode: () => dragGroup.value?.getNode(),
    applyState: () => {},
    remove: () => {
      const node = groupRef.value?.getNode()
      if (node) node.destroy()
    }
  })
})
onBeforeUnmount(() => elementRegistry.unregister(props.id))

// 暴露 getNode 方法
function getNode() { return dragGroup.value?.getNode() }
defineExpose({ getNode })
</script>