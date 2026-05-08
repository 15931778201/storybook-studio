<template>
  <v-group ref="clickGroup" :config="groupConfig" @click="handleClick">
    <!-- visual 图片加载失败或未配置时，显示半透明色块（方便编辑） -->
    <v-rect v-if="!props.editMode && !visualImageLoaded && !visualColor" :config="fallbackRect" />
    <!-- 如果 visual 配置了图片，则显示图片 -->
    <v-image v-if="visualImageLoaded" :config="visualImgConfig" />
    <!-- 如果 visual 配置了纯色，则显示矩形 -->
    <v-rect v-if="props.editMode && !visualImageLoaded && visualColor" :config="colorRectConfig" />
  </v-group>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { globalState } from '../../engine/GlobalState.js'
import { actionRunner } from '../../engine/ActionRunner.js'
import { elementRegistry } from '../../engine/ElementRegistry.js'

const props = defineProps({
  id: String,
  hitArea: Object,            // { x, y, width, height } 比例值，定义了可点击区域和基础大小
  visual: Object,             // { image?: string, color?: string, opacity?: number }
  onClick: Array,             // 点击动作序列
  editMode: Boolean,
  // 支持裁剪（如果 visual 使用了图片）
  crop: Object
})

const emit = defineEmits(['click', 'dragend'])  // 编辑模式选中事件

const clickGroup = ref(null)

// 获取基础尺寸：优先使用 hitArea 中的宽高，否则给一个默认比例
const baseWidth = computed(() => props.hitArea?.width ?? 0.1)
const baseHeight = computed(() => props.hitArea?.height ?? 0.1)

// 图片加载相关（如果 visual.image 存在）
const visualImage = ref(null)
const visualImageLoaded = ref(false)

// visual 颜色或图片
const visualColor = computed(() => props.visual?.color || null)
const visualOpacity = computed(() => props.visual?.opacity ?? 0.3)

function loadVisualImage(src) {
  if (!src) {
    visualImageLoaded.value = false
    return
  }
  const img = new Image()
  img.onload = () => {
    visualImage.value = img
    visualImageLoaded.value = true
  }
  img.onerror = () => {
    visualImageLoaded.value = false
  }
  img.src = src.startsWith('data:') ? src : `/images/${src}`
}

watch(() => props.visual?.image, (val) => loadVisualImage(val), { immediate: true })

// 图片原始比例
const imageRatio = computed(() => {
  const img = visualImage.value
  if (!img || !img.naturalWidth || !img.naturalHeight) return 1
  return img.naturalHeight / img.naturalWidth
})

// Group 配置（编辑模式不可原生拖拽，由 Transformer 接管）
const groupConfig = computed(() => {
  const w = baseWidth.value * globalState.stageWidth
  // 高度：如果 visual 使用了图片，则按图片比例自动计算；否则用 baseHeight
  let h = baseHeight.value * globalState.stageHeight
  if (props.visual?.image && visualImageLoaded.value) {
    h = w * imageRatio.value
  }
  return {
    x: (props.hitArea?.x ?? 0) * globalState.stageWidth,
    y: (props.hitArea?.y ?? 0) * globalState.stageHeight,
    width: w,
    height: h,
    draggable: props.editMode ? false : false,   // 编辑模式和播放模式都不允许原生拖拽（点击区域不需要拖拽移动）
    name: props.id,
    listening: true
  }
})

// 占位矩形（无图片无颜色时显示）
const fallbackRect = computed(() => ({
  width: baseWidth.value * globalState.stageWidth,
  height: baseHeight.value * globalState.stageHeight,
  fill: 'rgba(255,200,0,0.4)',
  stroke: '#f0a500',
  strokeWidth: 2,
  dash: [4, 4],
  cornerRadius: 4
}))

// 纯色矩形
const colorRectConfig = computed(() => ({
  width: baseWidth.value * globalState.stageWidth,
  height: baseHeight.value * globalState.stageHeight,
  fill: visualColor.value,
  opacity: visualOpacity.value,
  cornerRadius: 4
}))

// 图片渲染配置（支持裁剪和等比缩放）
const visualImgConfig = computed(() => {
  const img = visualImage.value
  if (!img) return {}
  const w = baseWidth.value * globalState.stageWidth
  const h = w * imageRatio.value   // 默认等比高度

  const config = { image: img, width: w, height: h }

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

// 点击处理
function handleClick(e) {
  if (props.editMode) {
    // 按住 Ctrl/⌘ 测试动作
    if ((e?.evt?.ctrlKey || e?.evt?.metaKey) && props.onClick) {
      actionRunner.run(props.onClick)
      return
    }
    emit('click', props.id)
  } else if (props.onClick) {
    actionRunner.run(props.onClick)
  }
}

// 注册节点
onMounted(() => {
  elementRegistry.register(props.id, {
    getNode: () => clickGroup.value?.getNode(),
    applyState: () => {},
    remove: () => {
      const node = groupRef.value?.getNode()
      if (node) node.destroy()
    }    
  })
})
onBeforeUnmount(() => elementRegistry.unregister(props.id))

defineExpose({ getNode: () => clickGroup.value?.getNode() })
</script>