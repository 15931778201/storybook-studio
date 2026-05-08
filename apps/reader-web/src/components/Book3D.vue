<template>
  <TresCanvas window-size :shadows="true">
    <TresPerspectiveCamera :position="[0, 0.2, 4.5]" :fov="45" :near="0.1" :far="100" />
    <OrbitControls
      :enable-pan="false"
      :enable-damping="true"
      :min-distance="3"
      :max-distance="8"
      :max-polar-angle="Math.PI / 1.8"
    />

    <TresAmbientLight :intensity="0.5" />
    <TresDirectionalLight
      :position="[3, 5, 2]"
      :intensity="0.8"
      :cast-shadow="true"
      shadow-mapSize-width="1024"
      shadow-mapSize-height="1024"
    />

    <TresGroup>
      <!-- 封面 -->
      <TresMesh :position="[0, 0, coverZ]">
        <TresBoxGeometry :args="[bookWidth, bookHeight, coverThickness]" />
        <TresMeshStandardMaterial :color="coverColor" :roughness="0.4" />
      </TresMesh>

      <!-- 封底 -->
      <TresMesh :position="[0, 0, backCoverZ]">
        <TresBoxGeometry :args="[bookWidth, bookHeight, backCoverThickness]" />
        <TresMeshStandardMaterial :color="backColor" :roughness="0.4" />
      </TresMesh>

      <!-- 书脊 -->
      <TresMesh :position="[spineX, 0, spineZ]">
        <TresBoxGeometry :args="[spineWidth, bookHeight, spineDepth]" />
        <TresMeshStandardMaterial :color="spineColor" :roughness="0.4" />
      </TresMesh>

      <!-- 内页堆叠 -->
      <TresMesh
        v-for="(page, index) in visiblePages"
        :key="`page-${index}`"
        :position="[0, 0, page.z]"
      >
        <TresBoxGeometry :args="[pageWidth, pageHeight, pageThickness]" />
        <TresMeshStandardMaterial :map="page.texture" :roughness="0.8" />
      </TresMesh>

      <!-- 正在翻动的书页 -->
      <TresMesh
        v-if="flippingPage"
        :position="flippingPage.position"
        :rotation="flippingPage.rotation"
      >
        <TresPlaneGeometry :args="[pageWidth, pageHeight]" />
        <TresMeshStandardMaterial
          :map="flippingPage.texture"
          :side="DoubleSide"
          :transparent="true"
          :roughness="0.8"
        />
      </TresMesh>
    </TresGroup>
  </TresCanvas>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, shallowRef } from 'vue'
import { TresCanvas } from '@tresjs/core'
import { OrbitControls } from '@tresjs/cientos'
import * as THREE from 'three'
import gsap from 'gsap'
import type { BookPage } from '@/types/book'

const props = defineProps<{
  pages: BookPage[]
  currentPage: number
  turnDirection: 'next' | 'prev'
}>()

const emit = defineEmits<{
  (e: 'page-turned'): void
}>()

// ==================== 书本几何常量 ====================
const bookWidth = 1.8
const bookHeight = 2.5
const coverThickness = 0.12
const backCoverThickness = 0.08
const spineWidth = 0.1
const spineDepth = coverThickness + backCoverThickness + 0.1
// const pageWidth = bookWidth - 0.1
// const pageHeight = bookHeight - 0.1
const pageThickness = 0.008
const pageAspect = 4 / 3
const pageHeight = 2.0     // 可调
const pageWidth = pageHeight * pageAspect   // ≈ 2.667

const coverZ = 0.06
const backCoverZ = -spineDepth / 2 + 0.04
const spineX = -bookWidth / 2 - spineWidth / 2
const spineZ = 0

const coverColor = '#d4a373'
const backColor = '#b08968'
const spineColor = '#8b5a2b'

// ==================== 纹理加载 ====================
const textures = shallowRef<THREE.Texture[]>([])
const loading = ref(true)

function createPlaceholderTexture(color = '#dcdcdc'): THREE.Texture {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = color
  ctx.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(canvas)
}

async function loadTextureSafe(url: string): Promise<THREE.Texture> {
  if (!url || url.trim() === '') return createPlaceholderTexture('#e0e0e0')
  try {
    const loader = new THREE.TextureLoader()
    loader.crossOrigin = 'anonymous'
    return await loader.loadAsync(url)
  } catch (e) {
    console.warn('TextureLoader failed, trying Image:', url, e)
  }
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.crossOrigin = 'anonymous'
      image.onload = () => resolve(image)
      image.onerror = reject
      image.src = url
    })
    const texture = new THREE.Texture(img)
    texture.needsUpdate = true
    return texture
  } catch (e) {
    console.warn('Image load failed, placeholder:', url, e)
    return createPlaceholderTexture('#f0c0c0')
  }
}

onMounted(async () => {
  console.log(`📖 开始加载 ${props.pages.length} 页纹理`)
  const results = await Promise.all(
    props.pages.map((page, i) => {
      console.log(` - 纹理 ${i + 1}: ${page.backgroundUrl ?? '(empty)'}`)
      if (!page.backgroundUrl) {
        return createPlaceholderTexture('#eaeaea')
      }
      return loadTextureSafe(page.backgroundUrl)
    })
  )
  textures.value = results
  loading.value = false
  console.log('纹理加载完毕')
})

// ==================== 内页显示 ====================
// const visiblePages = computed(() => {
//   if (!textures.value.length) return []
//   const midZ = 0.05
//   const leftPages: any[] = []
//   const rightPages: any[] = []

//   for (let i = 0; i < props.pages.length; i++) {
//     const texture = textures.value[i]
//     if (i < props.currentPage) {
//       leftPages.push({
//         z: midZ - (props.currentPage - i) * pageThickness * 3,
//         texture,
//       })
//     } else if (i > props.currentPage) {
//       rightPages.push({
//         z: midZ + (i - props.currentPage) * pageThickness * 3,
//         texture,
//       })
//     }
//   }
//   return [...leftPages, ...rightPages]
// })
const visiblePages = computed(() => {
  // 🔧 调试：直接显示所有纹理，忽略 currentPage
  if (!textures.value.length) return []
  return textures.value.map((texture, i) => ({
    z: 0.05 + i * 0.02,  // 微小层叠
    texture,
  }))
})

// ==================== 翻页动画（带日志） ====================
const isAnimating = ref(false)
const flippingPage = ref<any>(null)

watch(
  [() => props.currentPage, () => props.turnDirection],
  ([newPage, direction], [oldPage]) => {
    console.log(`📖 翻页检测: ${oldPage} → ${newPage}, 方向: ${direction}`)
    if (newPage === oldPage || isAnimating.value) {
      console.log(' - 忽略（页码未变或动画进行中）')
      return
    }
    if (!textures.value.length) {
      console.log(' - 纹理未加载，直接 emit')
      emit('page-turned')
      return
    }

    const fromPageIndex = direction === 'next' ? newPage - 1 : newPage + 1
    const texture = textures.value[fromPageIndex]
    if (!texture) {
      console.log(' - 找不到纹理，直接 emit')
      emit('page-turned')
      return
    }

    console.log(' - 开始翻页动画')
    isAnimating.value = true
    const midZ = 0.05
    const startRotationY = direction === 'next' ? 0 : Math.PI
    const targetRotationY = direction === 'next' ? -Math.PI : 0

    flippingPage.value = {
      position: [0, 0, midZ],
      rotation: [0, startRotationY, 0],
      texture,
    }

    gsap.to(flippingPage.value.rotation, {
      y: targetRotationY,
      duration: 0.7,
      ease: 'power2.inOut',
      onComplete: () => {
        flippingPage.value = null
        isAnimating.value = false
        console.log(' - 动画结束，emit page-turned')
        setTimeout(() => { isAnimating.value = false }, 50) // 二次保险
        emit('page-turned')
      },
    })
  }
)

const DoubleSide = THREE.DoubleSide
</script>

<style scoped>
/* 可按需添加辅助样式 */
</style>
