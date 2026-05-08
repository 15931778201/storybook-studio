<template>
  <transition name="dialog-slide">
    <div v-if="visible" class="bottom-dialog-overlay" :class="position" @click.self="close">
      <div class="bottom-dialog">
        <div class="dialog-header">
          <span class="dialog-title">{{ title }}</span>
          <button class="dialog-close" @click="close">✕</button>
        </div>
        <div class="dialog-body">
          <slot>
            <!-- 默认内容 -->
            <p>这里可以放置帮助信息、快捷键列表或任何提示。</p>
          </slot>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
const props = defineProps({
  visible: Boolean,
  title: { type: String, default: '提示' },
  position: { type: String, default: 'center' } // 'center' ｜ 'bottom'
})
const emit = defineEmits(['close'])

function close() {
  emit('close')
}
</script>

<style scoped>
.bottom-dialog-overlay {
  position: fixed;
  left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 2000;
  display: flex;
  justify-content: center;
}
/* 居中位置 */
.dialog-overlay.center {
  align-items: center;
}
/* 底部位置 */
.dialog-overlay.bottom {
  align-items: flex-end;
}
.bottom-dialog {
  background: white;
  border-radius: 16px 16px 0 0;
  width: 100%;
  max-width: 600px;      /* 和绘本宽度近似 */
  max-height: 50vh;
  overflow-y: auto;
  box-shadow: 0 -4px 20px rgba(0,0,0,0.2);
  transform: translateY(0);
}
.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #eee;
}
.dialog-title {
  font-weight: bold;
  font-size: 16px;
}
.dialog-close {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  padding: 4px;
  line-height: 1;
}
.dialog-body {
  padding: 16px;
  font-size: 14px;
  line-height: 1.6;
  color: #333;
}
/* 过渡动画 */
.dialog-slide-enter-active, .dialog-slide-leave-active {
  transition: all 0.3s ease;
}
.dialog-slide-enter-from, .dialog-slide-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>