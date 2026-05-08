# ReaderPage UI Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance ReaderPage UI with full-screen animated background, strategically hidden control buttons, and swipe gesture navigation for page turning.

**Architecture:** 
- Add full-screen animated canvas layer behind content
- Refactor button visibility with smart hiding logic based on page state
- Implement touch gesture handlers for swipe navigation
- Maintain existing functionality while enhancing UX

**Tech Stack:** Vue 3 Composition API, CSS animations, Touch Events API

---

### Task 1: Full-Screen Animated Background Layer

**Files:**
- Create: `docs/superpowers/plans/2024-01-15-readerpage-improvements.md`
- Modify: `/Users/wsx/Documents/Playground/apps/reader-web/src/pages/ReaderPage.vue`

- [ ] **Step 1: Add animated background component**

```vue
<template>
  <div class="reader-background">
    <div class="bloom-animation"></div>
    <div class="particles-container">
      <div 
        v-for="particle in animatedParticles" 
        :key="particle.id"
        class="particle"
        :style="particle.style"
      ></div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const animatedParticles = ref([])
let animationFrame = null
let time = 0

const particles = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: 2 + Math.random() * 4,
  speed: 0.5 + Math.random() * 1.5,
  opacity: 0.3 + Math.random() * 0.4
}))

onMounted(() => {
  animatedParticles.value = particles
  
  const animate = () => {
    time += 0.016
    animatedParticles.value = animatedParticles.value.map(p => ({
      ...p,
      y: (p.y + p.speed * 0.5) % 100,
      opacity: 0.3 + 0.4 * Math.abs(Math.sin(time * p.speed + p.id))
    }))
    animationFrame = requestAnimationFrame(animate)
  }
  animate()
})

onUnmounted(() => {
  if (animationFrame) cancelAnimationFrame(animationFrame)
})
</script>

<style scoped>
.reader-background {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: -1;
  overflow: hidden;
}

.bloom-animation {
  position: absolute;
  width: 200%;
  height: 200%;
  background: radial-gradient(
    ellipse at center,
    rgba(100, 200, 255, 0.1) 0%,
    transparent 70%
  );
  animation: bloom 8s ease-in-out infinite;
}

@keyframes bloom {
  0%, 100% { transform: scale(1) rotate(0deg); opacity: 0.5; }
  50% { transform: scale(1.2) rotate(180deg); opacity: 0.8; }
}

.particle {
  position: absolute;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255,255,255,0.8), transparent);
  animation: floatParticle 3s ease-in-out infinite;
}

@keyframes floatParticle {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-20px) scale(1.2); }
}
</style>
```

- [ ] **Step 2: Integrate background into main layout**

```vue
<template>
  <section>
    <!-- Full-screen animated background -->
    <ReaderBackground />
    
    <div class="reader-content">
      <!-- Existing header and content -->
    </div>
  </section>
</template>

<script setup>
import ReaderBackground from '@/components/ReaderBackground.vue'
</script>
```

### Task 2: Smart Button Visibility System

**Files:**
- Modify: `/Users/wsx/Documents/Playground/apps/reader-web/src/pages/ReaderPage.vue`

- [ ] **Step 1: Create button visibility state**

```vue
<script setup>
// Add to existing state
const buttonsVisible = ref(true)
let hideButtonsTimeout = null

const resetButtonTimer = () => {
  if (hideButtonsTimeout) clearTimeout(hideButtonsTimeout)
  
  if (!buttonsVisible.value) {
    buttonsVisible.value = true
  }
  
  hideButtonsTimeout = setTimeout(() => {
    buttonsVisible.value = false
  }, 3000)
}

// Auto-hide on interaction
const handleInteraction = () => {
  resetButtonTimer()
}

onMounted(() => {
  resetButtonTimer()
})
</script>
```

- [ ] **Step 2: Apply visibility to buttons with smooth transitions**

```vue
<template>
  <aside class="panel side-panel" :class="{ hidden: !buttonsVisible }">
    <div class="actions">
      <button 
        class="btn secondary" 
        :disabled="pageIndex <= 0"
        @click="prevPage"
        @mouseenter="resetButtonTimer"
      >
        上一页
      </button>
      <button 
        class="btn" 
        :disabled="isLastPage"
        @click="nextPage"
        @mouseenter="resetButtonTimer"
      >
        下一页
      </button>
    </div>
    <!-- Other controls -->
  </aside>
</template>

<style scoped>
.side-panel {
  transition: opacity 0.5s ease, transform 0.5s ease;
}

.side-panel.hidden {
  opacity: 0;
  transform: translateX(100%);
  pointer-events: none;
}

/* Mobile-specific positioning */
@media (max-width: 900px) {
  .side-panel {
    position: sticky;
    bottom: calc(8px + env(safe-area-inset-bottom));
    transform: none;
  }
  
  .side-panel.hidden {
    transform: translateY(100%);
  }
}
</style>
```

### Task 3: Swipe Gesture Navigation

**Files:**
- Modify: `/Users/wsx/Documents/Playground/apps/reader-web/src/pages/ReaderPage.vue`
- Create: `/Users/wsx/Documents/Playground/apps/reader-web/src/composables/useSwipeGesture.ts`

- [ ] **Step 1: Create swipe gesture composable**

```typescript
// useSwipeGesture.ts
import { ref, onMounted, onUnmounted } from 'vue'

export interface SwipeConfig {
  threshold?: number
  velocityThreshold?: number
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  onSwipeUp?: () => void
  onSwipeDown?: () => void
}

export function useSwipeGesture(
  target: HTMLElement | null,
  config: SwipeConfig = {}
) {
  const {
    threshold = 50,
    velocityThreshold = 0.3,
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown
  } = config

  let startX = 0
  let startY = 0
  let startTime = 0
  let isSwiping = false

  const handleTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0]
    startX = touch.clientX
    startY = touch.clientY
    startTime = Date.now()
    isSwiping = true
  }

  const handleTouchMove = (e: TouchEvent) => {
    if (!isSwiping) return
    e.preventDefault()
  }

  const handleTouchEnd = (e: TouchEvent) => {
    if (!isSwiping) return
    
    const touch = e.changedTouches[0]
    const endX = touch.clientX
    const endY = touch.clientY
    const deltaTime = Date.now() - startTime
    
    const deltaX = endX - startX
    const deltaY = endY - startY
    
    const velocityX = Math.abs(deltaX) / deltaTime
    const velocityY = Math.abs(deltaY) / deltaTime
    
    const swipeDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
    
    if (swipeDistance > threshold && velocityX > velocityThreshold) {
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX < 0) {
          onSwipeLeft?.()
        } else {
          onSwipeRight?.()
        }
      } else {
        if (deltaY < 0) {
          onSwipeUp?.()
        } else {
          onSwipeDown?.()
        }
      }
    }
    
    isSwiping = false
  }

  onMounted(() => {
    if (target) {
      target.addEventListener('touchstart', handleTouchStart, { passive: false })
      target.addEventListener('touchmove', handleTouchMove, { passive: false })
      target.addEventListener('touchend', handleTouchEnd, { passive: false })
    }
  })

  onUnmounted(() => {
    if (target) {
      target.removeEventListener('touchstart', handleTouchStart)
      target.removeEventListener('touchmove', handleTouchMove)
      target.removeEventListener('touchend', handleTouchEnd)
    }
  })
}
```

- [ ] **Step 2: Integrate swipe gestures into ReaderPage**

```vue
<template>
  <section 
    ref="contentArea"
    class="reader-layout"
  >
    <div class="canvas-wrap panel">
      <!-- Existing canvas content -->
    </div>
    
    <aside class="panel side-panel" :class="{ hidden: !buttonsVisible }">
      <div class="actions">
        <button 
          class="btn secondary" 
          :disabled="pageIndex <= 0"
          @click="prevPage"
        >
          上一页
        </button>
        <button 
          class="btn" 
          :disabled="isLastPage"
          @click="nextPage"
        >
          下一页
        </button>
      </div>
      <!-- Other controls -->
    </aside>
  </section>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useSwipeGesture } from '@/composables/useSwipeGesture'

const contentArea = ref(null)

// Swipe handlers
useSwipeGesture(contentArea.value, {
  threshold: 80,
  velocityThreshold: 0.2,
  onSwipeLeft: () => {
    if (!isLastPage.value) {
      turnDirection.value = 'next'
      pageIndex.value += 1
    }
  },
  onSwipeRight: () => {
    if (pageIndex.value > 0) {
      turnDirection.value = 'prev'
      pageIndex.value -= 1
    }
  },
  onSwipeUp: () => {
    // Vertical swipe - could trigger audio or other actions
    resetButtonTimer()
  },
  onSwipeDown: () => {
    // Vertical swipe down
    resetButtonTimer()
  }
})

// Mouse/touch handlers for desktop
const handleMouseDown = (e) => {
  // Track for potential swipe detection
  resetButtonTimer()
}
</script>

<style scoped>
.reader-layout {
  position: relative;
  touch-action: pan-y; /* Allow vertical scrolling */
  user-select: none;
}

/* Prevent text selection during swipe */
.reader-layout:active {
  user-select: none;
}
</style>
```

### Task 4: Enhanced Page Transition Animations

**Files:**
- Modify: `/Users/wsx/Documents/Playground/apps/reader-web/src/pages/ReaderPage.vue`

- [ ] **Step 1: Add enhanced page transition styles**

```vue
<style scoped>
/* Enhanced page transitions with 3D flip effect */
.page-next-enter-active,
.page-next-leave-active,
.page-prev-enter-active,
.page-prev-leave-active {
  transition: all 400ms cubic-bezier(0.4, 0, 0.2, 1);
  transform-style: preserve-3d;
}

.page-next-enter-from,
.page-next-leave-to {
  transform: translateX(20px) rotateY(15deg) scale(0.95);
  opacity: 0;
  filter: blur(5px);
}

.page-next-leave-to,
.page-prev-enter-from {
  transform: translateX(-20px) rotateY(-15deg) scale(0.95);
  opacity: 0;
  filter: blur(5px);
}

/* Add depth to page during transition */
.page-layer {
  transition: transform 300ms ease;
}

.page-next-leave-active .page-layer,
.page-prev-enter-active .page-layer {
  transform: translateZ(-20px);
}
</style>
```

### Task 5: Performance Optimizations

**Files:**
- Modify: `/Users/wsx/Documents/Playground/apps/reader-web/src/pages/ReaderPage.vue`

- [ ] **Step 1: Optimize animations for performance**

```vue
<script setup>
// Add will-change property to animated elements
const optimizedCanvasStyle = computed(() => ({
  backgroundImage: currentPage.value?.backgroundUrl
    ? `url(${currentPage.value.backgroundUrl})`
    : FALLBACK_BACKGROUNDS[pageIndex.value % FALLBACK_BACKGROUNDS.length],
  willChange: 'background-position',
  backfaceVisibility: 'hidden',
  perspective: '1000px'
}))
</script>

<style scoped>
.canvas {
  /* Hardware acceleration for smooth animations */
  transform: translateZ(0);
  backface-visibility: hidden;
  -webkit-font-smoothing: antialiased;
}

.spark {
  will-change: transform, opacity;
}

/* Reduce motion for accessibility */
@media (prefers-reduced-motion: reduce) {
  .spark,
  .scene-ribbon,
  .particle {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  
  .page-next-enter-active,
  .page-next-leave-active,
  .page-prev-enter-active,
  .page-prev-leave-active {
    transition: none;
  }
}
</style>
```

### Task 6: Responsive Design and Mobile Optimization

**Files:**
- Modify: `/Users/wsx/Documents/Playground/apps/reader-web/src/pages/ReaderPage.vue`

- [ ] **Step 1: Add mobile-specific swipe optimizations**

```vue
<template>
  <section 
    ref="contentArea"
    class="reader-layout"
    :class="{ 'touch-device': isTouchDevice }"
  >
    <!-- Content -->
  </section>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const isTouchDevice = ref(false)
let touchStartY = 0
let touchStartX = 0

onMounted(() => {
  isTouchDevice.value = 'ontouchstart' in window
  
  // Check for touch device
  const mediaQuery = window.matchMedia('(hover: none) and (pointer: coarse)')
  if (mediaQuery.matches) {
    isTouchDevice.value = true
  }
})

// Enhanced swipe handling for mobile
const handleTouchStart = (e) => {
  touchStartX = e.touches[0].clientX
  touchStartY = e.touches[0].clientY
  resetButtonTimer()
}

const handleTouchMove = (e) => {
  if (!isTouchDevice.value) return
  
  const touchX = e.touches[0].clientX
  const touchY = e.touches[0].clientY
  const deltaX = touchX - touchStartX
  const deltaY = touchY - touchStartY
  
  // Prevent vertical scroll interference with horizontal swipe
  if (Math.abs(deltaX) > Math.abs(deltaY) * 2) {
    e.preventDefault()
  }
}
</script>

<style scoped>
.reader-layout {
  /* Prevent rubber band effect on iOS */
  overscroll-behavior: contain;
}

/* Mobile layout adjustments */
@media (max-width: 900px) and (hover: none) {
  .side-panel {
    /* Full height on mobile when visible */
    max-height: 50vh;
    overflow-y: auto;
  }
  
  .reader-background {
    /* Reduced parallax on mobile */
    transform: scale(1.1);
  }
}
</style>
```

### Testing Strategy

**Files:**
- Create: `/Users/wsx/Documents/Playground/apps/reader-web/tests/unit/ReaderPage.spec.js`

- [ ] **Step 1: Create comprehensive tests**

```javascript
// tests/unit/ReaderPage.spec.js
import { mount } from '@vue/test-utils'
import ReaderPage from '@/pages/ReaderPage.vue'

describe('ReaderPage UI Improvements', () => {
  describe('Full-screen Background', () => {
    it('renders animated background layer', () => {
      const wrapper = mount(ReaderPage, {
        props: { book: mockBookWithPages }
      })
      
      expect(wrapper.find('.reader-background').exists()).toBe(true)
      expect(wrapper.find('.bloom-animation').exists()).toBe(true)
      expect(wrapper.findAll('.particle')).toHaveLength(20)
    })

    it('applies correct background styles', () => {
      const wrapper = mount(ReaderPage, {
        props: { book: mockBookWithPages }
      })
      
      const canvas = wrapper.find('.canvas')
      expect(canvas.element.style.backgroundImage).toContain('url')
    })
  })

  describe('Smart Button Visibility', () => {
    it('hides buttons after timeout', async () => {
      const wrapper = mount(ReaderPage, {
        props: { book: mockBookWithPages }
      })
      
      // Buttons should be visible initially
      expect(wrapper.find('.side-panel').classes('hidden')).toBe(false)
      
      // Wait for auto-hide
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 3500))
      
      expect(wrapper.find('.side-panel').classes('hidden')).toBe(true)
    })

    it('resets timer on interaction', async () => {
      const wrapper = mount(ReaderPage, {
        props: { book: mockBookWithPages }
      })
      
      // Trigger interaction
      await wrapper.find('.btn').trigger('mouseenter')
      
      // Should not be hidden after interaction
      expect(wrapper.find('.side-panel').classes('hidden')).toBe(false)
    })
  })

  describe('Swipe Gestures', () => {
    it('detects swipe left to next page', () => {
      const wrapper = mount(ReaderPage, {
        props: { book: mockBookWithPages }
      })
      
      const contentArea = wrapper.find('.reader-layout')
      const touchStart = new Touch({
        identifier: 1,
        target: contentArea.element,
        clientX: 100,
        clientY: 50
      })
      
      const touchEnd = new Touch({
        identifier: 1,
        target: contentArea.element,
        clientX: 20,  // Swipe left
        clientY: 50
      })
      
      contentArea.element.dispatchEvent(new TouchEvent('touchstart', {
        touches: [touchStart],
        changedTouches: [touchStart]
      }))
      
      contentArea.element.dispatchEvent(new TouchEvent('touchend', {
        changedTouches: [touchEnd]
      }))
      
      expect(wrapper.vm.pageIndex).toBe(1)
      expect(wrapper.vm.turnDirection).toBe('next')
    })

    it('detects swipe right to previous page', () => {
      const wrapper = mount(ReaderPage, {
        props: { book: mockBookWithPages }
      })
      
      // First navigate to page 1
      wrapper.setData({ pageIndex: 1 })
      
      const contentArea = wrapper.find('.reader-layout')
      const touchStart = new Touch({
        identifier: 1,
        target: contentArea.element,
        clientX: 20,
        clientY: 50
      })
      
      const touchEnd = new Touch({
        identifier: 1,
        target: contentArea.element,
        clientX: 100,  // Swipe right
        clientY: 50
      })
      
      contentArea.element.dispatchEvent(new TouchEvent('touchstart', {
        touches: [touchStart],
        changedTouches: [touchStart]
      }))
      
      contentArea.element.dispatchEvent(new TouchEvent('touchend', {
        changedTouches: [touchEnd]
      }))
      
      expect(wrapper.vm.pageIndex).toBe(0)
      expect(wrapper.vm.turnDirection).toBe('prev')
    })
  })

  describe('Enhanced Animations', () => {
    it('applies 3D transform styles during transitions', async () => {
      const wrapper = mount(ReaderPage, {
        props: { book: mockBookWithPages }
      })
      
      // Trigger page turn
      await wrapper.find('.btn').trigger('click')
      
      const pageLayer = wrapper.find('.page-layer')
      expect(pageLayer.element.style.transform).toContain('rotateY')
    })
  })
})
```

## Execution Plan

This plan provides a complete implementation for the ReaderPage UI improvements. The changes enhance user experience with:

1. **Immersive animated background** that doesn't interfere with content
2. **Smart button system** that auto-hides but remains accessible
3. **Swipe gestures** for intuitive mobile navigation
4. **Enhanced transitions** with 3D effects
5. **Performance optimizations** for smooth animations
6. **Mobile-first responsive design**

All features include accessibility considerations and performance best practices.

**Next Steps:**
- Review and adjust particle count based on performance testing
- Fine-tune swipe thresholds for optimal user experience
- Test on various devices and screen sizes
- Consider adding configuration options for animation intensity