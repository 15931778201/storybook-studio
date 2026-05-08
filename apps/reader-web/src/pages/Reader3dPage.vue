<template>
  <div class="reader-fullscreen">
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
        <!-- ⚠️ 仅传递 pages, currentPage, turnDirection，不再传 autoPlay 等 -->
        <Book3D
          v-if="book?.pages"
          :pages="book.pages"
          :currentPage="pageIndex"
          :turnDirection="turnDirection"
          @page-turned="onPageTurned"
        />

        <!-- 🔧 临时翻页测试按钮（调试用，正式上线可删除） -->
        <div class="debug-controls">
          <button @click="goToPrevPage" :disabled="pageIndex <= 0">👈 上一页</button>
          <span style="color:white; margin:0 12px">
            {{ pageIndex + 1 }} / {{ pageCount }}
          </span>
          <button @click="goToNextPage" :disabled="pageIndex >= pageCount - 1">下一页 👉</button>
        </div>
      </div>

      <!-- 底部控制栏 -->
      <div
        class="navigation-bar"
        @touchstart="handleTouchStart"
        @touchmove="handleTouchMove"
        @touchend="handleTouchEnd"
      >
        <button
          v-if="currentPage?.narrationAudioUrl"
          class="btn audio-btn"
          @click="playAudio(currentPage.narrationAudioUrl)"
        >
          🎵 播放旁白
        </button>
        <button class="btn auto-play-btn" @click="toggleAutoPlay">
          {{ autoPlay ? '⏸️ 停止' : '▶️ 自动翻页' }}
        </button>
        <button class="btn fullscreen-btn" @click="toggleFullscreen">
          {{ isFullscreen ? '✕ 退出' : '⛶ 全屏' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import type { Book, BookPage } from '@/types/book'
import { fetchBookDetail } from '@/api/books'
import Book3D from '@/components/Book3D.vue'

// ==================== 图片代理 ====================
const USE_IMAGE_PROXY = true
const PROXY_PREFIX = '/books/image-proxy?url='

function proxyImageUrl(originalUrl: string): string {
  if (!USE_IMAGE_PROXY) return originalUrl
  if (originalUrl.startsWith('http') && !originalUrl.includes(window.location.host)) {
    return PROXY_PREFIX + encodeURIComponent(originalUrl)
  }
  return originalUrl
}

// ==================== 路由与状态 ====================
const route = useRoute()
const bookId = computed(() => route.params.id as string)

const book = ref<Book | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

const pageIndex = ref(0)
const autoPlay = ref(true)
const turnDirection = ref<'next' | 'prev'>('next')

let currentAudio: HTMLAudioElement | null = null
let autoPageTurnPending = false
const pendingPlayAudioUrl = ref<string | null>(null)

// ==================== 计算属性 ====================
const currentPage = computed<BookPage | null>(() => {
  if (!book.value?.pages || book.value.pages.length === 0) return null
  return book.value.pages[pageIndex.value] || null
})

const pageCount = computed(() => book.value?.pageCount ?? 0)

// ==================== 音频播放 ====================
function playAudio(url?: string, triggerAutoTurn: boolean = autoPlay.value) {
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.onended = null
    currentAudio = null
  }
  autoPageTurnPending = false

  if (!url) {
    if (triggerAutoTurn && autoPlay.value) {
      scheduleAutoPageTurn()
    }
    return
  }

  const audio = new Audio(url)
  currentAudio = audio

  if (triggerAutoTurn && autoPlay.value) {
    audio.onended = () => {
      if (currentAudio === audio) currentAudio = null
      if (autoPlay.value && !autoPageTurnPending) {
        autoPageTurnPending = true
        goToNextPage()
      }
    }
  } else {
    audio.onended = () => {
      if (currentAudio === audio) currentAudio = null
    }
  }

  audio.play().catch(err => console.warn('音频播放失败:', err))
}

function scheduleAutoPageTurn() {
  if (!autoPlay.value) return
  if (autoPageTurnPending) return
  autoPageTurnPending = true
  setTimeout(() => {
    if (autoPlay.value && autoPageTurnPending) {
      goToNextPage()
    }
  }, 100)
}

// ==================== 翻页逻辑（添加日志） ====================
function goToNextPage() {
  console.log(`▶ goToNextPage 当前页: ${pageIndex.value} / 总页: ${pageCount.value}`)
  if (pageIndex.value < pageCount.value - 1) {
    turnDirection.value = 'next'
    pageIndex.value++
    console.log(`翻至第 ${pageIndex.value} 页`)
    pendingPlayAudioUrl.value = currentPage.value?.narrationAudioUrl || null
  } else {
    console.log('已到最后一页')
    if (autoPlay.value) stopAutoPlay()
    autoPageTurnPending = false
  }
}

function goToPrevPage() {
  console.log(`◀ goToPrevPage 当前页: ${pageIndex.value}`)
  if (pageIndex.value > 0) {
    turnDirection.value = 'prev'
    pageIndex.value--
    console.log(`翻至第 ${pageIndex.value} 页`)
    pendingPlayAudioUrl.value = currentPage.value?.narrationAudioUrl || null
  } else {
    console.log('已到第一页')
  }
}

function onPageTurned() {
  console.log('📘 翻页动画完成，处理后续播放')
  autoPageTurnPending = false
  if (pendingPlayAudioUrl.value) {
    playAudio(pendingPlayAudioUrl.value, autoPlay.value)
    pendingPlayAudioUrl.value = null
  } else if (autoPlay.value && !currentPage.value?.narrationAudioUrl) {
    scheduleAutoPageTurn()
  }
}

// ==================== 手势处理 ====================
interface TouchEventWithStart extends TouchEvent {
  _startX?: number
  _startY?: number
}

function handleTouchStart(e: TouchEvent) {
  const touch = e.touches[0]
  if (touch) {
    (e as TouchEventWithStart)._startX = touch.clientX
    ;(e as TouchEventWithStart)._startY = touch.clientY
  }
}

function handleTouchMove(e: TouchEvent) {
  const touch = e.touches[0]
  const startX = (e as TouchEventWithStart)._startX
  if (startX !== undefined && Math.abs(touch.clientX - startX) > 10) {
    e.preventDefault()
  }
}

function handleTouchEnd(e: TouchEvent) {
  const touch = e.changedTouches[0]
  const startX = (e as TouchEventWithStart)._startX
  const startY = (e as TouchEventWithStart)._startY
  if (!touch || startX === undefined || startY === undefined) return

  const deltaX = touch.clientX - startX
  const deltaY = touch.clientY - startY

  if (Math.abs(deltaX) > 30 && Math.abs(deltaY) < 80) {
    if (deltaX < 0) {
      goToNextPage()
    } else {
      goToPrevPage()
    }
  }
}

// ==================== 自动播放控制 ====================
function stopAutoPlay() {
  autoPageTurnPending = false
  if (currentAudio) {
    currentAudio.onended = () => {
      if (currentAudio) currentAudio = null
    }
  }
  autoPlay.value = false
}

function startAutoPlay() {
  autoPlay.value = true
  if (currentAudio && !currentAudio.paused) {
    const audio = currentAudio
    audio.onended = () => {
      if (currentAudio === audio) currentAudio = null
      if (autoPlay.value && !autoPageTurnPending) {
        autoPageTurnPending = true
        goToNextPage()
      }
    }
  } else if (!currentAudio && currentPage.value) {
    if (!currentPage.value.narrationAudioUrl) {
      scheduleAutoPageTurn()
    }
  }
}

function toggleAutoPlay() {
  if (autoPlay.value) {
    stopAutoPlay()
  } else {
    startAutoPlay()
  }
}

// ==================== 全屏控制 ====================
const isFullscreen = ref(false)

function toggleFullscreen() {
  const el = document.documentElement
  if (!isFullscreen.value) {
    el.requestFullscreen?.().catch(err => {
      console.warn('全屏失败:', err)
    })
  } else {
    document.exitFullscreen?.()
  }
}

function onFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement
}

// ==================== 加载书籍 ====================
async function loadBook() {
  loading.value = true
  error.value = null
  try {
    const rawBook = await fetchBookDetail(bookId.value)
    if (rawBook.pages) {
      rawBook.pages = rawBook.pages.map(page => ({
        ...page,
        backgroundUrl: page.backgroundUrl ? proxyImageUrl(page.backgroundUrl) : page.backgroundUrl,
      }))
    }
    book.value = rawBook
    pageIndex.value = 0
    console.log(`📚 书籍加载完成，共 ${pageCount.value} 页`)
    playAudio(currentPage.value?.narrationAudioUrl, autoPlay.value)
  } catch (err: any) {
    error.value = err.message || '加载失败'
  } finally {
    loading.value = false
  }
}

// 1. 添加键盘处理函数
function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'ArrowRight') {
    e.preventDefault()
    goToNextPage()
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault()
    goToPrevPage()
  }
}

// ==================== 生命周期 ====================
onMounted(() => {
  loadBook()
  document.addEventListener('fullscreenchange', onFullscreenChange)
  document.addEventListener('keydown', onKeyDown)   // 新增
})

onUnmounted(() => {
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.onended = null
    currentAudio = null
  }
  autoPageTurnPending = false
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  document.removeEventListener('keydown', onKeyDown) // 新增
})
</script>

<style scoped>
.reader-fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
  background: #000;
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
  to {
    transform: rotate(360deg);
  }
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

.canvas-shell {
  width: 100%;
  height: 100%;
}

/* 临时调试按钮 */
.debug-controls {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  z-index: 100;
  background: rgba(0,0,0,0.6);
  padding: 6px 16px;
  border-radius: 40px;
}
.debug-controls button {
  background: #fff;
  border: none;
  padding: 6px 16px;
  border-radius: 20px;
  font-weight: bold;
}

.navigation-bar {
  position: absolute;
  bottom: max(24px, env(safe-area-inset-bottom));
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 16px;
  padding: 12px 24px;
  background: rgba(20, 20, 40, 0.6);
  backdrop-filter: blur(20px);
  border-radius: 60px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.2);
  z-index: 20;
  flex-wrap: wrap;
}

.btn {
  border: none;
  border-radius: 40px;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  min-height: 44px;
  white-space: nowrap;
  background: rgba(255, 255, 255, 0.9);
  color: #1f2f49;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.btn:active {
  transform: scale(0.95);
}

.audio-btn {
  background: #e0e7ff;
  color: #3730a3;
}

.auto-play-btn {
  background: #dcfce7;
  color: #166534;
}

.fullscreen-btn {
  background: #fef3c7;
  color: #92400e;
}

@media (max-width: 768px) {
  .navigation-bar {
    padding: 10px 18px;
    gap: 12px;
  }
  .btn {
    padding: 8px 16px;
    font-size: 13px;
  }
}
</style>
