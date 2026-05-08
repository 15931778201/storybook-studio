<template>
  <div class="opening-screen">
    <!-- 视频层 -->
    <video
      ref="videoRef"
      class="full-video"
      :src="videoSrc"
      muted
      autoplay
      playsinline
      preload="auto"
      @ended="onEnded"
      @click="tryPlay"
    ></video>

    <!-- 播放失败时的轻柔提示（仅当自动播放被阻止时显示） -->
    <div v-if="showPlayHint" class="play-hint" @click="tryPlay">
      点击屏幕开始
    </div>

    <!-- 结束后按钮（淡入） -->
    <Transition name="fade-scale">
      <button
        v-if="showStartBtn"
        class="start-button"
        @click="handleStart"
      >
        一起开始吧
      </button>
    </Transition>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';

const videoSrc = '/intro/intro.mp4'; // 视频放在 public 目录下
const router = useRouter();
const videoRef = ref(null);
const showStartBtn = ref(false);
const showPlayHint = ref(false);

onMounted(() => {
  const video = videoRef.value;
  if (!video) return;

  // 尝试自动播放
  video.play().catch(() => {
    // 自动播放被阻止，显示点击提示
    showPlayHint.value = true;
  });
});

function tryPlay() {
  const video = videoRef.value;
  if (video && video.paused) {
    video.play().then(() => {
      showPlayHint.value = false;
    });
  }
}

function onEnded() {
  showStartBtn.value = true;
  showPlayHint.value = false;
}

function handleStart() {
  // 跳转到绘本主页面，例如：
  router.push('/');
}
</script>

<style scoped>
.opening-screen {
  position: fixed;
  inset: 0;
  background: black;      /* 避免视频未加载时的白屏 */
  overflow: hidden;
}

.full-video {
  width: 100%;
  height: 100%;
  object-fit: cover;      /* 4:3 视频在任意屏幕上无黑边铺满，会裁切左右 */
  display: block;
}

/* 播放提示（半透明蒙层） */
.play-hint {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.5);
  color: #fff;
  font-size: 2rem;
  cursor: pointer;
  z-index: 10;
}

/* 开始按钮样式 */
.start-button {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 20;

  background: linear-gradient(135deg, #ffd700, #ffaa00);
  border: none;
  padding: 18px 60px;
  border-radius: 50px;
  font-size: 2.2rem;
  font-weight: bold;
  color: #2d2d2d;
  cursor: pointer;
  box-shadow: 0 0 30px rgba(255, 215, 0, 0.7), 0 10px 20px rgba(0,0,0,0.4);
  letter-spacing: 4px;
  transition: transform 0.2s, box-shadow 0.2s;
}
.start-button:hover {
  transform: translate(-50%, -50%) scale(1.05);
  box-shadow: 0 0 45px rgba(255, 215, 0, 0.9), 0 15px 25px rgba(0,0,0,0.5);
}
.start-button:active {
  transform: translate(-50%, -50%) scale(0.98);
}

/* 按钮淡入放大动画 */
.fade-scale-enter-active {
  transition: opacity 0.8s ease, transform 0.8s ease;
}
.fade-scale-leave-active {
  transition: opacity 0.5s ease;
}
.fade-scale-enter-from {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.6);
}
.fade-scale-leave-to {
  opacity: 0;
}
</style>