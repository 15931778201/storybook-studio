<template>
  <div class="book-scene">
    <div class="book" :class="{ open: isOpen }">
      <div class="book-cover">
        <div class="cover-front">
          <!-- 替换为你自己的绘本封面图 -->
          <img src="https://chatopens.oss-cn-hangzhou.aliyuncs.com/chatgpt/7b9b701a-3579-4786-8ab6-c5d553fc2409.png" alt="绘本封面" />
        </div>
        <div class="cover-back"></div>
      </div>
      <div class="book-page">
        <div class="page-content">
          <slot />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const isOpen = ref(false);
const emit = defineEmits(['opened']);

onMounted(() => {
  setTimeout(() => {
    isOpen.value = true;
    // 翻书动画时长 1.2s，结束后通知父级
    setTimeout(() => {
      emit('opened');
    }, 1300);
  }, 500);
});
</script>

<style scoped>
.book-scene {
  perspective: 1200px;
  width: 300px;
  height: 400px;
  margin: 0 auto;
}
.book {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  transform: rotateX(5deg);
  transition: transform 0.8s ease;
}
.book.open {
  transform: rotateX(5deg) rotateY(-5deg);
}
.book-cover {
  position: absolute;
  width: 100%;
  height: 100%;
  transform-origin: left center;
  transition: transform 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  transform-style: preserve-3d;
}
.book.open .book-cover {
  transform: rotateY(-170deg);
}
.cover-front,
.cover-back {
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  border-radius: 4px 12px 12px 4px;
}
.cover-front img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.cover-back {
  background: #f7e8d0;
  transform: rotateY(180deg);
}
.book-page {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 0 12px 12px 0;
  background: #fff9ef;
  transform: translateZ(-2px);
  box-shadow: inset -2px 0 5px rgba(0,0,0,0.05);
}
.page-content {
  padding: 30px 20px;
}
</style>