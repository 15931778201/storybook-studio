import { ref, onMounted, onUnmounted } from 'vue'

export function useScreenOrientation() {
  const isLandscape = ref(false)
  let mql: MediaQueryList | null = null

  const update = (e: MediaQueryListEvent | MediaQueryList) => {
    isLandscape.value = e.matches
  }

  onMounted(() => {
    mql = window.matchMedia('(orientation: landscape)')
    update(mql)
    mql.addEventListener('change', update)
  })

  onUnmounted(() => {
    mql?.removeEventListener('change', update)
  })

  return { isLandscape }
}