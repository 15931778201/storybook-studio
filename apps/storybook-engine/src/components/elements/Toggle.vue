<template>
  <v-group ref="groupRef" :config="groupConfig" @click="handleClick">
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
  states: Array,           // [{ image, text }]
  initialState: { type: Number, default: 0 },
  cycle: Boolean,
  onToggle: Array,
  editMode: Boolean,
  crop: Object,
  x: Number, y: Number, width: Number, height: Number
})

const emit = defineEmits(['click', 'dragend'])
const groupRef = ref(null)
const currentIndex = ref(props.initialState)
const imageObj = ref(null)
const imageLoaded = ref(false)

const currentImage = computed(() => props.states[currentIndex.value]?.image)

function loadImage(src) {
  if (!src) { imageLoaded.value = false; return }
  const img = new Image()
  img.onload = () => { imageObj.value = img; imageLoaded.value = true }
  img.onerror = () => { imageLoaded.value = false }
  img.src = src.startsWith('data:') ? src : `/images/${src}`
}
watch(currentImage, val => loadImage(val), { immediate: true })

const imageRatio = computed(() => {
  const img = imageObj.value
  if (!img?.naturalWidth || !img?.naturalHeight) return 1
  return img.naturalHeight / img.naturalWidth
})

const groupConfig = computed(() => {
  const w = (props.width ?? 0.1) * globalState.stageWidth
  const h = props.height
    ? props.height * globalState.stageHeight
    : w * imageRatio.value
  return {
    x: (props.x ?? 0) * globalState.stageWidth,
    y: (props.y ?? 0) * globalState.stageHeight,
    width: w, height: h,
    draggable: props.editMode ? false : false,
    name: props.id
  }
})

const fallbackRect = computed(() => ({
  width: (props.width ?? 0.1) * globalState.stageWidth,
  height: (props.height ?? (props.width ?? 0.1)) * globalState.stageWidth,
  fill: '#a0c4ff', stroke: '#3a7bd5', strokeWidth: 2
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

function handleClick(e) {
  if (props.editMode) {
    if ((e?.evt?.ctrlKey || e?.evt?.metaKey) && props.onToggle) {
      actionRunner.run(props.onToggle)
      return
    }
    emit('click', props.id)
  } else {
    // 切换状态
    if (props.cycle) {
      currentIndex.value = (currentIndex.value + 1) % props.states.length
    } else {
      currentIndex.value = currentIndex.value === 0 ? 1 : 0
    }
    if (props.onToggle) actionRunner.run(props.onToggle)
  }
}

onMounted(() => {
  elementRegistry.register(props.id, {
    getNode: () => groupRef.value?.getNode()
  })
})
onBeforeUnmount(() => elementRegistry.unregister(props.id))
defineExpose({ getNode: () => groupRef.value?.getNode() })
</script>