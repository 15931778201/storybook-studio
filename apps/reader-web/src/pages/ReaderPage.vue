<template>
  <div
    class="reader-fullscreen"
    :class="{ 'reader-closing': closing }"
  >
    <div class="fullscreen-canvas">
      <!-- 加载状态 -->
      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <p>加载中...</p>
      </div>

      <!-- 错误状态 -->
      <div v-else-if="error" class="error-state">
        <p>❌ {{ error }}</p>
        <button @click="loadBook">重试</button>
      </div>

      <!-- 正常内容 -->
      <div v-else class="canvas-shell">
        <div class="canvas" :style="canvasStyle">
          <Transition
            :name="turnDirection === 'next' ? 'page-next' : 'page-prev'"
            mode="out-in"
          >
            <div v-if="currentPage" :key="currentPage.id" class="page-layer"></div>
          </Transition>
        </div>

        <!-- 左右翻页按钮 -->
        <button
          v-if="pageIndex > 0"
          class="arrow-btn arrow-left"
          @click="goToPrevPage"
          aria-label="上一页"
        >
          ‹
        </button>
        <button
          v-if="pageIndex < pageCount - 1"
          class="arrow-btn arrow-right"
          @click="goToNextPage"
          aria-label="下一页"
        >
          ›
        </button>
      </div>

      <!-- 横屏提示遮罩 -->
      <div v-if="!isLandscape && !loading && !error" class="orientation-tip">
        <div class="tip-card">
          <span>📱➡️</span>
          <p>请横屏使用以获得最佳阅读体验</p>
        </div>
      </div>

      <!-- 底部控制栏 -->
      <div class="navigation-bar">
        <button
          v-if="currentPage?.narrationAudioUrl"
          class="btn audio-btn"
          :class="{ active: audioPlayer.isPlaying.value }"
          @click="playNarration"
        >
          {{ audioPlayer.isPlaying.value ? '🔊 正在播放' : '🎵 播放旁白' }}
        </button>
        <span class="page-progress">{{ pageIndex + 1 }} / {{ pageCount }}</span>
        <button class="btn auto-play-btn" @click="autoPageTurn.toggle()">
          {{ autoPageTurn.autoPlay.value ? '⏸️ 停止' : '▶️ 自动翻页' }}
        </button>
        <button class="btn close-btn" @click="handleClose">✕</button>
      </div>

      <!-- 首次激活遮罩 -->
      <div
        v-if="!autoPageTurn.autoPlay.value && !hasUserActivated && !loading && !error && !isLandscape"
        class="start-overlay"
        @click="handleStartReading"
      >
        <button class="start-btn">✨ 开始阅读 ✨</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { BookPage } from '@/types/book'

import { useBookLoader } from '@/composables/useBookLoader'
import { useAudioPlayer } from '@/composables/useAudioPlayer'
import { useAutoPageTurn } from '@/composables/useAutoPageTurn'
import { useImagePreload } from '@/composables/useImagePreload'
import { useReadingProgress } from '@/composables/useReadingProgress'
import { useScreenOrientation } from '@/composables/useScreenOrientation'

const route = useRoute()
const router = useRouter()
const bookId = computed(() => route.params.id as string)

// ---------- 加载书籍 ----------
const { book, loading, error, load: loadBook } = useBookLoader(bookId)

// ---------- 页面索引与动画方向 ----------
const pageIndex = ref(0)
const turnDirection = ref<'next' | 'prev'>('next')
const hasUserActivated = ref(false)

// ---------- 音频播放器 ----------
const audioPlayer = useAudioPlayer()

// ---------- 自动翻页调度器 ----------
const autoPageTurn = useAutoPageTurn()

// ---------- 图片预加载 ----------
useImagePreload(book, pageIndex)

// ---------- 阅读进度恢复 ----------
const pageCount = computed(() => book.value?.pageCount ?? 0)
const readingProgress = useReadingProgress(bookId, pageIndex, pageCount)

// ---------- 横屏检测 ----------
const { isLandscape } = useScreenOrientation()

// ---------- 退出动画状态 ----------
const closing = ref(false)

// ---------- 当前页数据 ----------
const currentPage = computed<BookPage | null>(() => {
  if (!book.value?.pages?.length) return null
  return book.value.pages[pageIndex.value] ?? null
})

// ---------- 画布样式 ----------
const canvasStyle = computed(() => {
  if (!currentPage.value) return { background: '#f0f0f0' }
  const bg = currentPage.value.backgroundUrl
  if (bg) {
    return {
      backgroundImage: `url(${bg})`,
      backgroundSize: 'contain',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      backgroundColor: '#fff'
    }
  }
  return { background: 'linear-gradient(180deg, #79d9ff 0%, #fdb6de 100%)' }
})

// ---------- 手动播放旁白（不触发自动翻页） ----------
function playNarration() {
  const url = currentPage.value?.narrationAudioUrl
  if (url) audioPlayer.play(url)
}

// ---------- 翻页逻辑 ----------
function goToNextPage() {
  if (pageIndex.value >= pageCount.value - 1) {
    autoPageTurn.stop()
    return
  }

  turnDirection.value = 'next'
  pageIndex.value++
  autoPageTurn.onTurnCompleted()

  if (autoPageTurn.autoPlay.value) {
    autoPageTurn.scheduleTurn(
      currentPage.value,
      (url, onEnd, onError) => audioPlayer.play(url, onEnd, onError),
      goToNextPage
    )
  }
}

function goToPrevPage() {
  if (pageIndex.value <= 0) return

  turnDirection.value = 'prev'
  pageIndex.value--
  autoPageTurn.onTurnCompleted()

  if (autoPageTurn.autoPlay.value) {
    autoPageTurn.scheduleTurn(
      currentPage.value,
      (url, onEnd, onError) => audioPlayer.play(url, onEnd, onError),
      goToNextPage
    )
  }
}

// ---------- 首次激活阅读 ----------
function handleStartReading() {
  hasUserActivated.value = true
  autoPageTurn.start()

  const url = currentPage.value?.narrationAudioUrl
  if (url) {
    audioPlayer.play(
      url,
      () => {
        if (autoPageTurn.autoPlay.value) goToNextPage()
      },
      (err) => {
        console.warn('播放失败', err)
        autoPageTurn.stop()
      }
    )
  } else {
    autoPageTurn.scheduleTurn(
      currentPage.value,
      (url, onEnd, onError) => audioPlayer.play(url, onEnd, onError),
      goToNextPage
    )
  }
}

// ---------- 退出阅读器（带退出动画） ----------
function handleClose() {
  closing.value = true
  setTimeout(() => {
    router.back()
  }, 350) // 与 CSS 动画时长一致
}

// ---------- 生命周期 ----------
onMounted(async () => {
  await loadBook()
  // 尝试恢复阅读进度
  const saved = readingProgress.restore()
  if (saved !== null) {
    pageIndex.value = saved
  }

  // 直接进入自动播放+自动翻页模式
  autoPageTurn.start()

  // 立即调度当前页（第一页或恢复的页）的自动翻页
  autoPageTurn.scheduleTurn(
    currentPage.value,
    (url, onEnd, onError) => audioPlayer.play(url, onEnd, onError),
    goToNextPage
  )
})

onUnmounted(() => {
  audioPlayer.stop()
  autoPageTurn.stop()
})
</script>

<style scoped>
/* 全屏容器 + 入场动画 */
.reader-fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
  background: #000;
  z-index: 1000;
  animation: readerSlideIn 0.35s ease;
}

@keyframes readerSlideIn {
  from {
    transform: translateY(40px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* 退出动画 */
.reader-closing {
  animation: readerSlideOut 0.35s ease forwards;
}

@keyframes readerSlideOut {
  from {
    transform: translateY(0);
    opacity: 1;
  }
  to {
    transform: translateY(40px);
    opacity: 0;
  }
}

.fullscreen-canvas {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  background: radial-gradient(circle at center, #1a1a2e, #0a0a1a);
}

/* 加载 / 错误状态 */
.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 20px;
  color: white;
  font-size: 16px;
  z-index: 10;
}

.spinner {
  width: 44px;
  height: 44px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-state button {
  padding: 10px 24px;
  background: #2563eb;
  border: none;
  border-radius: 40px;
  color: white;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s;
}

.error-state button:active {
  transform: scale(0.96);
}

/* 画布容器（相对定位，用于放置左右箭头） */
.canvas-shell {
  position: relative;
  width: 100vw;
  aspect-ratio: 667 / 375;
}

.canvas {
  width: 100%;
  height: 100%;
  position: relative;
  background-size: cover;
  background-position: center;
  border-radius: 32px;
  overflow: hidden;
  box-shadow: 0 25px 45px -12px rgba(0,0,0,0.5);
  border: 1px solid rgba(255,255,255,0.2);
}

/* 页面切换动画 */
.page-next-enter-active,
.page-next-leave-active,
.page-prev-enter-active,
.page-prev-leave-active {
  transition: all 0.45s cubic-bezier(0.3, 0.9, 0.4, 1.1);
}

.page-next-enter-from { transform: translateX(100%); opacity: 0; }
.page-next-leave-to { transform: translateX(-100%); opacity: 0; }
.page-prev-enter-from { transform: translateX(-100%); opacity: 0; }
.page-prev-leave-to { transform: translateX(100%); opacity: 0; }

.page-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

/* 左右箭头按钮 */
.arrow-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.85);
  border: none;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  font-size: 28px;
  font-weight: 300;
  color: #333;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  z-index: 15;
  transition: all 0.2s;
  line-height: 1;
}

.arrow-left {
  left: 12px;
}

.arrow-right {
  right: 12px;
}

.arrow-btn:active {
  transform: translateY(-50%) scale(0.9);
  background: rgba(255,255,255,1);
}

/* 底部控制栏 */
.navigation-bar {
  position: absolute;
  bottom: max(24px, env(safe-area-inset-bottom));
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 20px;
  background: rgba(20, 20, 40, 0.6);
  backdrop-filter: blur(20px);
  border-radius: 60px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.2);
  border: 1px solid rgba(255,255,255,0.2);
  z-index: 20;
}

.btn {
  border: none;
  border-radius: 40px;
  padding: 10px 18px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  min-height: 44px;
  white-space: nowrap;
  background: rgba(255,255,255,0.9);
  color: #1f2f49;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.btn:active {
  transform: scale(0.95);
}

.audio-btn.active {
  background: #c7d2fe;
  color: #312e81;
  box-shadow: 0 0 12px rgba(99, 102, 241, 0.4);
}

.auto-play-btn {
  background: #dcfce7;
  color: #166534;
}

.close-btn {
  background: rgba(255,255,255,0.7);
  color: #333;
  font-size: 18px;
  padding: 8px 12px;
}

.page-progress {
  color: white;
  font-weight: 600;
  font-size: 14px;
  padding: 0 6px;
  user-select: none;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .canvas-shell { width: 92vw; }
  .navigation-bar { padding: 8px 16px; gap: 8px; }
  .btn { padding: 8px 14px; font-size: 13px; }
}

/* 减少动画 */
@media (prefers-reduced-motion: reduce) {
  .page-next-enter-active,
  .page-next-leave-active,
  .page-prev-enter-active,
  .page-prev-leave-active {
    animation: none !important;
    transition: none !important;
  }
  .reader-fullscreen {
    animation: none !important;
  }
  .reader-closing {
    animation: none !important;
  }
}

/* 首次激活遮罩 */
.start-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.5);
  backdrop-filter: blur(6px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 30;
  cursor: pointer;
}

.start-btn {
  padding: 18px 42px;
  font-size: 20px;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 60px;
  box-shadow: 0 12px 28px rgba(0,0,0,0.3);
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.start-btn:active {
  transform: scale(0.95);
  box-shadow: 0 6px 16px rgba(0,0,0,0.2);
}

/* 横屏提示 */
.orientation-tip {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.7);
  backdrop-filter: blur(12px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 40;
}

.tip-card {
  background: white;
  padding: 32px 40px;
  border-radius: 24px;
  text-align: center;
  box-shadow: 0 20px 40px rgba(0,0,0,0.3);
}

.tip-card span {
  font-size: 48px;
}

.tip-card p {
  margin-top: 12px;
  font-size: 18px;
  font-weight: 600;
  color: #333;
}
</style>