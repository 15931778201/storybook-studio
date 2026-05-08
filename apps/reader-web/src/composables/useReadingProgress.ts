import { watch, computed, type Ref } from 'vue'

export function useReadingProgress(
  bookId: Ref<string>,
  pageIndex: Ref<number>,
  pageCount: Ref<number>
) {
  const storageKey = computed(() => `book_progress_${bookId.value}`)

  function save() {
    try {
      sessionStorage.setItem(storageKey.value, String(pageIndex.value))
    } catch {}
  }

  function restore(): number | null {
    try {
      const raw = sessionStorage.getItem(storageKey.value)
      if (raw !== null) {
        const idx = parseInt(raw, 10)
        if (!isNaN(idx) && idx >= 0 && idx < pageCount.value) {
          return idx
        }
      }
    } catch {}
    return null
  }

  watch(pageIndex, save)

  return { restore }
}