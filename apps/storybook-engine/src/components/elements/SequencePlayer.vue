<template>
  <v-group ref="groupRef" :config="groupConfig" @click="handleClick">
    <!-- 编辑模式下显示紫色圆点占位 -->
    <v-circle v-if="editMode" :config="placeholder" />
  </v-group>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { globalState } from '../../engine/GlobalState.js'
import { elementRegistry } from '../../engine/ElementRegistry.js'

const props = defineProps({
  id: String,
  steps: Array,
  trigger: String,
  loop: Boolean,
  editMode: Boolean,
  x: { type: Number, default: 0.5 },
  y: { type: Number, default: 0.5 }
})

const emit = defineEmits(['click', 'dragend'])
const groupRef = ref(null)

const PLACEHOLDER_SIZE = 20

const groupConfig = computed(() => ({
  x: (props.x ?? 0.5) * globalState.stageWidth - PLACEHOLDER_SIZE / 2,
  y: (props.y ?? 0.5) * globalState.stageHeight - PLACEHOLDER_SIZE / 2,
  width: PLACEHOLDER_SIZE,
  height: PLACEHOLDER_SIZE,
  draggable: false,
  name: props.id
}))

const placeholder = computed(() => ({
  radius: PLACEHOLDER_SIZE / 2,
  fill: 'rgba(138, 43, 226, 0.6)',
  stroke: '#8a2be2',
  strokeWidth: 2
}))

function handleClick() {
  if (props.editMode) {
    emit('click', props.id)
  }
  // 播放模式下由 StoryPage 触发自动播放，不处理点击
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