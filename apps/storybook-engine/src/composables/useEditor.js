// src/composables/useEditor.js
import { ref } from 'vue'

export function useEditor() {
  const editMode = ref(false)
  const selectedElementId = ref(null)

  // 从 URL 读取编辑模式
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search)
    editMode.value = params.get('edit') === 'true'
  }

  function enableEdit() {
    editMode.value = true
    const url = new URL(window.location)
    url.searchParams.set('edit', 'true')
    window.history.replaceState({}, '', url)
  }

  function disableEdit() {
    editMode.value = false
    const url = new URL(window.location)
    url.searchParams.delete('edit')
    window.history.replaceState({}, '', url)
  }

  function selectElement(id) {
    selectedElementId.value = id
  }

  function clearSelection() {
    selectedElementId.value = null
  }

  // 确保返回对象包含 selectElement
  return {
    editMode,
    enableEdit,
    disableEdit,
    selectedElementId,
    selectElement,
    clearSelection
  }
}