import { watch, type Ref } from 'vue'
import type { Book } from '@/types/book'

export function useImagePreload(book: Ref<Book | null>, pageIndex: Ref<number>) {
  const preloadPool = new Map<string, HTMLImageElement>()

  function preload(url: string) {
    if (!url || preloadPool.has(url)) return
    const img = new Image()
    img.src = url
    preloadPool.set(url, img)
  }

  function preloadAdjacent() {
    const pages = book.value?.pages
    if (!pages) return
    const idx = pageIndex.value
    if (idx > 0) {
      preload(pages[idx - 1].backgroundUrl || '')
    }
    if (idx < pages.length - 1) {
      preload(pages[idx + 1].backgroundUrl || '')
    }
  }

  watch([book, pageIndex], preloadAdjacent, { immediate: true })

  return { preload }
}