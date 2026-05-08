<template>
  <div class="reader-background">
    <div class="bloom-animation"></div>
    <div class="particles-container">
      <div 
        v-for="particle in animatedParticles" 
        :key="particle.id"
        class="particle"
        :style="particle.style"
      ></div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const animatedParticles = ref([])
let animationFrame = null
let time = 0

const particles = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: 2 + Math.random() * 4,
  speed: 0.5 + Math.random() * 1.5,
  opacity: 0.3 + Math.random() * 0.4
}))

onMounted(() => {
  animatedParticles.value = particles
  
  const animate = () => {
    time += 0.016
    animatedParticles.value = animatedParticles.value.map(p => ({
      ...p,
      y: (p.y + p.speed * 0.5) % 100,
      opacity: 0.3 + 0.4 * Math.abs(Math.sin(time * p.speed + p.id))
    }))
    animationFrame = requestAnimationFrame(animate)
  }
  animate()
})

onUnmounted(() => {
  if (animationFrame) cancelAnimationFrame(animationFrame)
})
</script>

<style scoped>
.reader-background {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: -1;
  overflow: hidden;
}

.bloom-animation {
  position: absolute;
  width: 200%;
  height: 200%;
  background: radial-gradient(
    ellipse at center,
    rgba(100, 200, 255, 0.1) 0%,
    transparent 70%
  );
  animation: bloom 8s ease-in-out infinite;
}

@keyframes bloom {
  0%, 100% { transform: scale(1) rotate(0deg); opacity: 0.5; }
  50% { transform: scale(1.2) rotate(180deg); opacity: 0.8; }
}

.particle {
  position: absolute;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255,255,255,0.8), transparent);
  animation: floatParticle 3s ease-in-out infinite;
}

@keyframes floatParticle {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-20px) scale(1.2); }
}
</style>
