// 书籍数据加载
import { ref, type Ref } from 'vue'
import type { Book } from '@/types/book'
import { fetchBookDetail } from '@/api/books'

export function useBookLoader(bookId: Ref<string>) {
  const book = ref<Book | null>(null)
  const loading = ref(true)
  const error = ref<string | null>(null)

  async function load() {
    loading.value = true
    error.value = null
    try {
      book.value = await fetchBookDetail(bookId.value)
    } catch (err: any) {
      error.value = err.message || '加载失败'
    } finally {
      loading.value = false
    }
  }

  return { book, loading, error, load }
}