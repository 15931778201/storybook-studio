<template>
  <div v-if="element&&visible" class="inspector-panel">
    <h3>属性检查器</h3>

    <!-- 基本属性 -->
    <div class="section">
      <div class="field">
        <label>ID</label>
        <span>{{ element.id }}</span>
      </div>
      <div class="field">
        <label>类型</label>
        <span>{{ element.type }}</span>
      </div>
      <div class="field">
        <label>X (比例)</label>
        <input type="number" step="0.001" v-model.number="localX" @input="emitBasicUpdate" />
      </div>
      <div class="field">
        <label>Y (比例)</label>
        <input type="number" step="0.001" v-model.number="localY" @input="emitBasicUpdate" />
      </div>
      <div class="field" v-if="supportsSize">
        <label>宽 (比例)</label>
        <input type="number" step="0.001" v-model.number="localWidth" @input="emitBasicUpdate" />
      </div>
      <div class="field" v-if="supportsSize">
        <label>高 (比例)</label>
        <input type="number" step="0.001" v-model.number="localHeight" @input="emitBasicUpdate" />
      </div>
    </div>

    <!-- 动作编辑区 -->
    <div class="section">
      <div class="mode-switch">
        <label>动作编辑模式：</label>
        <select v-model="actionEditMode">
          <option value="visual">可视化编辑</option>
          <option value="json">原始 JSON</option>
        </select>
      </div>

      <!-- 可视化动作编辑器 -->
      <div v-if="actionEditMode === 'visual'">
        <div v-for="group in actionGroups" :key="group.name" class="action-group">
          <h4>{{ group.label }}</h4>
          <div v-for="(action, idx) in group.actions" :key="idx" class="action-card">
            <div class="action-header">
              <select v-model="action.type" @change="onActionTypeChange(group, idx)">
                <option value="">选择动作类型</option>
                <option v-for="def in actionTypes" :key="def.type" :value="def.type">{{ def.label }}</option>
              </select>
              <button class="btn-remove" @click="removeAction(group.name, idx)">✕</button>
            </div>
            <div class="action-params" v-if="action.type">
              <div v-for="param in getActionDef(action.type).params" :key="param.key" class="param-field">
                <label>{{ param.label }}</label>
                <input
                  v-if="param.type === 'text' || param.type === 'number'"
                  :type="param.type"
                  v-model="action[param.key]"
                  @input="emitActionsUpdate"
                />
                <select v-else-if="param.type === 'select'" v-model="action[param.key]" @change="emitActionsUpdate">
                  <option v-for="opt in param.options" :key="opt.value" :value="opt.value">{{ opt.text }}</option>
                </select>
                <textarea
                  v-else-if="param.type === 'json'"
                  v-model="action[param.key]"
                  @input="emitActionsUpdate"
                  rows="3"
                ></textarea>
              </div>
            </div>
          </div>
          <button class="btn-add-action" @click="addAction(group.name)">+ 添加动作</button>
        </div>
      </div>

      <!-- 原始 JSON 编辑 -->
      <div v-else>
        <textarea v-model="rawActionsJson" rows="12" @blur="parseJsonActions"></textarea>
      </div>
      <button @click="copyElementConfig">复制JSON</button>
      <button @click="emit('close')">关闭</button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue'

const props = defineProps({
  element: Object,
  visible: Boolean
})
const emit = defineEmits(['update', 'close'])

// 基本属性
const localX = ref(0)
const localY = ref(0)
const localWidth = ref(0)
const localHeight = ref(0)

const supportsSize = computed(() => {
  const t = props.element?.type
  return ['character','clickable','draggable','collectible','toggle','timer','bubble'].includes(t)
})

// 动作组定义（根据元素类型可能需要调整）
const actionGroupNames = ['onClick', 'onCollect', 'onDrop', 'onToggle', 'onTimeout']
const actionGroups = computed(() => {
  const groups = []
  if (!props.element) return groups
  for (const name of actionGroupNames) {
    if (Array.isArray(props.element.props[name])) {
      groups.push({
        name,
        label: name,
        actions: props.element.props[name]  // 直接引用 reactive 数组
      })
    }
  }
  return groups
})

// 动作类型元数据定义（可扩展）
const actionTypes = [
  { type: 'playSound', label: '播放音效', params: [
    { key: 'sound', label: '音效文件名', type: 'text' }
  ]},
  { type: 'showBubble', label: '显示气泡', params: [
    { key: 'target', label: '气泡ID', type: 'text' },
    { key: 'text', label: '文字内容', type: 'text' },
    { key: 'duration', label: '显示时长(ms)', type: 'number' },
    { key: 'tts', label: '朗读文字', type: 'select', options: [
        { value: false, text: '否' },
        { value: true, text: '是' }
    ], default: true}
  ]},
  { type: 'hideBubble', label: '隐藏气泡', params: [
    { key: 'target', label: '气泡ID', type: 'text' }
  ]},
  { type: 'setState', label: '设置状态', params: [
    { key: 'target', label: '元素ID', type: 'text' },
    { key: 'state', label: '状态名', type: 'text' }
  ]},
  { type: 'setImage', label: '切换图片', params: [
    { key: 'target', label: '元素ID', type: 'text' },
    { key: 'image', label: '图片文件名', type: 'text' }
  ]},
  { type: 'removeElement', label: '移除元素', params: [
    { key: 'target', label: '元素ID', type: 'text' }
  ]},
  { type: 'addCollectible', label: '增加收集品', params: [
    { key: 'item', label: '收集品ID', type: 'text' },
    { key: 'count', label: '数量', type: 'number' }
  ]},
  { type: 'nextPage', label: '下一页', params: [] },
  { type: 'prevPage', label: '上一页', params: [] },
  { type: 'wait', label: '等待', params: [
    { key: 'duration', label: '毫秒', type: 'number' }
  ]},
  { type: 'speak', label: '语音朗读', params: [
    { key: 'text', label: '文本', type: 'text' },
    { key: 'rate', label: '语速', type: 'number' }
  ]},
  { type: 'listenFor', label: '语音识别', params: [
    { key: 'expected', label: '期望词语', type: 'text' },
    { key: 'onMatch', label: '匹配后动作 (JSON)', type: 'json' },
    { key: 'onNoMatch', label: '未匹配动作 (JSON)', type: 'json' }
  ]}
]

function getActionDef(type) {
  return actionTypes.find(d => d.type === type) || { params: [] }
}

// 添加动作：弹出下拉选择类型，然后插入默认值
function addAction(groupName) {
  const group = actionGroups.value.find(g => g.name === groupName)
  if (!group) return
  // 简单起见，直接添加一个空类型，用户在下拉框中选择
  group.actions.push({ type: '' })
  emitActionsUpdate()
}

function removeAction(groupName, index) {
  const group = actionGroups.value.find(g => g.name === groupName)
  if (group) {
    group.actions.splice(index, 1)
    emitActionsUpdate()
  }
}

// 当动作类型改变时，重置该动作的参数为默认值（基于定义）
function onActionTypeChange(group, index) {
  const action = group.actions[index]
  const def = getActionDef(action.type)
  // 清除旧属性，设置默认值
  for (const key in action) {
    if (key !== 'type') delete action[key]
  }
  def.params.forEach(param => {
    action[param.key] = ''
  })
  emitActionsUpdate()
}

// 提交动作更新（完全替换 props 中的动作组）
function emitActionsUpdate() {
  const patch = {}
  actionGroupNames.forEach(name => {
    const group = actionGroups.value.find(g => g.name === name)
    patch[name] = group ? [...group.actions] : undefined
  })
  emit('update', { elementId: props.element.id, props: patch })
}

// 基本属性变更
function emitBasicUpdate() {
  const el = props.element
  if (!el) return
  const patch = {}
  if (el.props.hitArea) {
    patch.hitArea = {
      x: localX.value,
      y: localY.value,
      width: localWidth.value,
      height: localHeight.value
    }
  } else {
    patch.x = localX.value
    patch.y = localY.value
    patch.width = localWidth.value
    patch.height = localHeight.value
  }
  emit('update', { elementId: el.id, props: patch })
}

// 原始 JSON 编辑
const actionEditMode = ref('visual')
const rawActionsJson = ref('')

watch(() => props.element, (el) => {
  if (!el) return
  const p = el.props
  // 同步基本属性
  localX.value = p.hitArea?.x ?? p.x ?? 0
  localY.value = p.hitArea?.y ?? p.y ?? 0
  if (p.hitArea) {
    localWidth.value = p.hitArea.width ?? 0.1
    localHeight.value = p.hitArea.height ?? 0.1
  } else {
    localWidth.value = p.width
    localHeight.value = p.height
  }
  // 原始 JSON 显示
  updateRawJson()
}, { immediate: true })

function updateRawJson() {
  const actions = {}
  actionGroupNames.forEach(name => {
    if (Array.isArray(props.element.props[name])) {
      actions[name] = props.element.props[name]
    }
  })
  rawActionsJson.value = JSON.stringify(actions, null, 2)
}

function parseJsonActions() {
  try {
    const actions = JSON.parse(rawActionsJson.value)
    emit('update', { elementId: props.element.id, props: actions })
  } catch (e) { /* ignore */ }
}

// 复制元素 JSON
function copyElementConfig() {
  navigator.clipboard.writeText(rawActionsJson.value)
    .then(() => alert('元素配置已复制到剪贴板'))
    .catch(() => alert('复制失败，请手动复制'))
}

// 用于模板引用
function emitUpdate() {}
</script>

<style scoped>
.inspector-panel {
  position: fixed;
  right: 10px;
  top: 60px;
  width: 320px;
  max-height: 80vh;
  overflow-y: auto;
  background: #1e1e2f;
  color: #eee;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.4);
  z-index: 1500;
  font-size: 14px;
}
h3 { margin: 0 0 12px 0; color: #ff9f1c; }
.section { margin-bottom: 18px; border-bottom: 1px solid #333; padding-bottom: 12px; }
.field { margin-bottom: 10px; }
label { display: block; color: #aaa; margin-bottom: 4px; }
input, textarea, select {
  width: 100%;
  background: #2a2a3d;
  border: 1px solid #555;
  color: white;
  padding: 6px;
  border-radius: 4px;
}
textarea { resize: vertical; }
.mode-switch { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.action-group { margin-bottom: 16px; }
.action-card {
  background: #2a2a3d;
  border-radius: 8px;
  padding: 10px;
  margin-bottom: 8px;
}
.action-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.action-params .param-field { margin-bottom: 8px; }
.btn-remove { background: #e63946; border: none; color: white; padding: 4px 8px; border-radius: 4px; cursor: pointer; }
.btn-add-action { background: #00b4d8; border: none; color: white; padding: 4px 10px; border-radius: 4px; cursor: pointer; margin-top: 6px; }
</style>