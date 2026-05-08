import { ref, onMounted, onBeforeUnmount } from 'vue'

export function useStageSize() {
  const ASPECT_RATIO = 16 / 9      // 横版绘本比例
  const MAX_WIDTH = 1920
  const PADDING = 20

  const stageWidth = ref(0)
  const stageHeight = ref(0)

  function updateSize() {
    const winWidth = window.innerWidth - PADDING
    const winHeight = window.innerHeight - PADDING
    let w = Math.min(winWidth, MAX_WIDTH)
    let h = w / ASPECT_RATIO

    if (h > winHeight) {
      h = winHeight
      w = h * ASPECT_RATIO
    }

    stageWidth.value = Math.floor(w)
    stageHeight.value = Math.floor(h)
  }
  updateSize()

  onMounted(() => {
    updateSize()
    window.addEventListener('resize', updateSize)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('resize', updateSize)
  })

  return { stageWidth, stageHeight }
}