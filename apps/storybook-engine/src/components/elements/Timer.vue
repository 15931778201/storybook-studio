<template>
  <v-group ref="groupRef" :config="groupConfig" @click="handleClick">
    <!-- 编辑模式占位 -->
    <template v-if="editMode">
      <v-rect :config="placeholderRect" />
    </template>

    <!-- 播放模式：进度条样式 -->
    <template v-else-if="displayStyle === 'bar'">
      <v-rect :config="progressBg" />
      <v-rect :config="progressBar" />
    </template>

    <!-- 播放模式：文字倒计时 -->
    <v-text v-if="!editMode && displayStyle === 'text'" :config="timerText" />
  </v-group>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { globalState } from '../../engine/GlobalState.js'
import { elementRegistry } from '../../engine/ElementRegistry.js'
import { actionRunner } from '../../engine/ActionRunner.js'

const props = defineProps({
  id: String,
  duration: Number,           // 毫秒
  onTimeout: Array,           // 超时动作
  display: Object,            // { style: 'bar'|'text', position?: { x, y } }
  cancelOn: String,
  trigger: { type: String, default: 'auto' },
  editMode: Boolean,
  x: { type: Number, default: 0.5 },
  y: { type: Number, default: 0.5 },
  width: { type: Number, default: 0.3 },
  height: { type: Number, default: 0.03 }
})

const emit = defineEmits(['click', 'dragend'])
const groupRef = ref(null)
const remaining = ref(0)
let timerInterval = null

// 计时器是否正在运行
const isActive = ref(false)

// 显示样式
const displayStyle = computed(() => props.display?.style || 'bar')

// 舞台位置和尺寸
const groupConfig = computed(() => ({
  x: (props.x ?? 0.5) * globalState.stageWidth,
  y: (props.y ?? 0.5) * globalState.stageHeight,
  width: (props.width ?? 0.3) * globalState.stageWidth,
  height: (props.height ?? 0.03) * globalState.stageHeight,
  visible: !props.editMode ? isActive.value : true,   // 播放模式非活跃时自动隐藏
  listening: true,
  name: props.id
}))

// 编辑模式占位矩形
const placeholderRect = computed(() => ({
  width: (props.width ?? 0.3) * globalState.stageWidth,
  height: (props.height ?? 0.03) * globalState.stageHeight,
  fill: 'rgba(0, 180, 216, 0.4)',
  stroke: '#00b4d8',
  strokeWidth: 2,
  dash: [6, 4],
}))

// 进度条背景
const progressBg = computed(() => ({
  width: (props.width ?? 0.3) * globalState.stageWidth,
  height: (props.height ?? 0.03) * globalState.stageHeight,
  fill: '#e0e0e0',
  cornerRadius: 4
}))

// 进度条前景（随时间变短）
const progressBar = computed(() => ({
  width: ((props.width ?? 0.3) * globalState.stageWidth) * Math.max(0, remaining.value / props.duration),
  height: (props.height ?? 0.03) * globalState.stageHeight,
  fill: '#e63946',
  cornerRadius: 4
}))

// 文字倒计时
const timerText = computed(() => ({
  text: Math.ceil(remaining.value / 1000).toString(),
  fontSize: 24,
  fill: '#e63946',
  x: 0, y: 0
}))

// 启动倒计时
function startTimer() {
  if (isActive.value) return
  // 重置剩余时间
  remaining.value = props.duration
  isActive.value = true

  const intervalMs = 50
  timerInterval = setInterval(() => {
    remaining.value = Math.max(0, remaining.value - intervalMs)
    if (remaining.value <= 0) {
      clearInterval(timerInterval)
      timerInterval = null
      timeout()
    }
  }, intervalMs)
}

// 超时处理：执行动作并销毁自身
async function timeout() {
  // 先执行用户配置的超时动作
  if (props.onTimeout && props.onTimeout.length > 0) {
    await actionRunner.run(props.onTimeout)
  }
  // 然后自动销毁自己（从舞台消失）
  isActive.value = false
  // 调用注册表移除并销毁节点
  elementRegistry.remove(props.id)
}

// 点击处理（编辑模式选中）
function handleClick() {
  if (props.editMode) {
    emit('click', props.id)
  }
}

// 生命周期：自动触发或等待手动启动
onMounted(() => {
  elementRegistry.register(props.id, {
    getNode: () => groupRef.value?.getNode(),
    remove: () => {
      const node = groupRef.value?.getNode()
      if (node) node.destroy()
      if (timerInterval) clearInterval(timerInterval)
    }
  })

  if (props.trigger === 'auto' && !props.editMode) {
    startTimer()
  }
})

// 组件卸载时清理定时器
onBeforeUnmount(() => {
  if (timerInterval) clearInterval(timerInterval)
})
</script>