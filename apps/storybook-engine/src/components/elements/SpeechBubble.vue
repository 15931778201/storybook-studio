<template>
  <v-group ref="groupRef" :config="groupConfig" @click="handleClick">
    <v-rect :config="bgConfig" />
    <v-text :config="textConfig" />
  </v-group>
</template>

<script setup>
import { computed, watch, onBeforeUnmount, onMounted, ref, inject } from 'vue'
import { bubbleManager } from '../../engine/BubbleManager.js'
import { elementRegistry } from '../../engine/ElementRegistry.js'
import { globalState } from '../../engine/GlobalState.js'

const props = defineProps({
  id: String,
  target: String,
  x: Number,
  y: Number,
  position: { type: String, default: 'top' },
  showTrigger: String,
  text: String,
  duration: Number,
  autoShow: Boolean,
  editMode: Boolean
})

const emit = defineEmits(['click', 'dragend'])
const groupRef = ref(null)

const bubbleData = computed(() => bubbleManager.active[props.id])

const groupConfig = computed(() => {
  if (!bubbleData.value && !props.autoShow && !props.editMode) return { visible: false }
  let bx, by
  if (props.x !== undefined && props.y !== undefined) {
    bx = props.x * globalState.stageWidth
    by = props.y * globalState.stageHeight
  } else if (props.target) {
    const targetNode = elementRegistry.get(props.target)?.getNode?.()
    if (targetNode) {
      const pos = targetNode.getAbsolutePosition()
      bx = pos.x
      by = pos.y
      if (props.position === 'top') by -= 60
      else by += 60
    } else {
      bx = globalState.stageWidth * 0.5
      by = globalState.stageHeight * 0.3
    }
  } else {
    bx = globalState.stageWidth * 0.5
    by = globalState.stageHeight * 0.3
  }

  return {
    x: bx, y: by,
    visible: props.editMode ? true : (!!bubbleData.value || props.autoShow),
    zIndex: 20,
    width: 220,
    height: 50,
    draggable: false,
    name: props.id
  }
})

const bgConfig = computed(() => ({
  fill: '#ffffff',
  stroke: '#f4a261',
  strokeWidth: 2,
  cornerRadius: 8,
  width: 220,
  height: 50,
}))

const textConfig = computed(() => ({
  text: bubbleData.value?.text || props.text || '',
  fontSize: 14,
  fontFamily: 'sans-serif',
  fill: '#333',
  padding: 8,
  width: 210,
  height: 50,
  verticalAlign: 'middle',
}))

let hideTimer = null
watch(bubbleData, (val) => {
  clearTimeout(hideTimer)
  if (val?.duration) {
    hideTimer = setTimeout(() => {
      bubbleManager.hide(props.id)
    }, val.duration)
  }
})
onBeforeUnmount(() => clearTimeout(hideTimer))

function handleClick() {
  if (props.editMode) {
    emit('click', props.id)
  }
}

onMounted(() => {
  elementRegistry.register(props.id, {
    getNode: () => groupRef.value?.getNode(),
    remove: () => {
      const node = groupRef.value?.getNode()
      if (node) node.destroy()
    }
  })
})
onBeforeUnmount(() => elementRegistry.unregister(props.id))
defineExpose({ getNode: () => groupRef.value?.getNode() })
</script>