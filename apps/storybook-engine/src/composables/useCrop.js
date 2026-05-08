import { ref, computed } from 'vue'

export function useCrop() {
  const cropTarget = ref(null)        // 正在裁剪的元素 id
  const cropRect = ref({ x: 0, y: 0, width: 1, height: 1 })  // 0~1 比例

  const isCropping = computed(() => !!cropTarget.value)

  function startCrop(elementId, initialRect = null) {
    cropTarget.value = elementId
    cropRect.value = initialRect || { x: 0, y: 0, width: 1, height: 1 }
  }

  function stopCrop(saveTo = null) {
    // saveTo 是外部保存回调的函数
    if (saveTo && cropTarget.value) {
      saveTo(cropTarget.value, cropRect.value)
    }
    cropTarget.value = null
    cropRect.value = { x: 0, y: 0, width: 1, height: 1 }
  }

  function updateCropRect(rect) {
    cropRect.value = rect
  }

  return { cropTarget, cropRect, isCropping, startCrop, stopCrop, updateCropRect }
}