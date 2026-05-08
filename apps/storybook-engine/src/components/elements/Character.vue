<template>
  <v-group ref="groupRef" :config="groupConfig" @click="handleClick">
    <v-rect v-if="!imageLoaded" :config="fallbackRect" />
    <v-image v-if="imageLoaded" ref="imgNodeRef" :config="imgConfig" />
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
  height: Number,
  onClick: Array,
  animations: Array,
  draggable: Boolean,
  crop: Object,
  editMode: Boolean
})

const emit = defineEmits(['click', 'dragend'])   // 用于编辑点击

const groupRef = ref(null)
const imgNodeRef = ref(null)          // 图片节点引用
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

const groupConfig = computed(() => ({
  x: (props.x ?? 0) * globalState.stageWidth,
  y: (props.y ?? 0) * globalState.stageHeight,
  draggable: props.editMode || props.draggable,  // 编辑模式可拖拽（移动）
  name: props.id,
}))

const fallbackRect = computed(() => ({
  width: (props.width ?? 0.1) * globalState.stageWidth,
  height: (props.height ?? (props.width ?? 0.1)) * globalState.stageWidth,
  fill: '#FFD166', stroke: '#333', strokeWidth: 2, cornerRadius: 4
}))

const imgConfig = computed(() => {
  const img = imageObj.value
  if (!img) return {}
  const baseW = props.width ? props.width * globalState.stageWidth : undefined
  const baseH = props.height ? props.height * globalState.stageHeight : undefined

  let finalW = baseW || (baseH ? (baseH * img.naturalWidth / img.naturalHeight) : undefined)
  let finalH = baseH || (baseW ? (baseW * img.naturalHeight / img.naturalWidth) : undefined)

  const config = { image: img, width: finalW, height: finalH }

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

function handleClick() {
  if (props.editMode) {
    emit('click', props.id)
  } else if (props.onClick && props.onClick.length > 0) {
    actionRunner.run(props.onClick)
  }
}

// 注册表暴露两个节点：用于拖拽的 Group，用于缩放的 Image
onMounted(() => {
  elementRegistry.register(props.id, {
    getNode: () => groupRef.value?.getNode(),          // 用于移动
    getNodeForEdit: () => imgNodeRef.value?.getNode(), // 用于缩放
    applyState: () => {},
    remove: () => {
      const node = groupRef.value?.getNode()
      if (node) node.destroy()
    }
  })
})
onBeforeUnmount(() => elementRegistry.unregister(props.id))

// 对外暴露的方法（供其他组件可能使用）
function getNode() { return groupRef.value?.getNode() }
function getImageNode() { return imgNodeRef.value?.getNode() }
defineExpose({ getNode, getImageNode })
</script>