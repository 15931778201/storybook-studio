<template>
  <article class="book-card panel" @click="goBook">
    <img :src="book.coverUrl" :alt="book.title" class="cover" />
    <div>
      <h3>{{ book.title }}</h3>
      <p class="subtitle">{{ book.subtitle || "" }}</p>
      <p class="meta">适龄：{{ book.ageRange.join("、") || "未设置" }}</p>
      <p class="meta">标签：{{ book.tags.join(" / ") || "无" }}</p>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { Book } from "@storybook-mvp/shared-types";
import { useRouter } from "vue-router";

const props = defineProps<{
  book: Book;
}>();

const router = useRouter();

function goBook() {
  router.push(`/book/${props.book.id}`);
}
</script>

<style scoped>
.book-card {
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: 12px;
  cursor: pointer;
}

.cover {
  width: 110px;
  height: 150px;
  object-fit: cover;
  border-radius: 10px;
  border: 1px solid #d4def2;
  background: #edf2fc;
}

h3 {
  margin: 0;
  font-size: 16px;
}

.subtitle,
.meta {
  margin: 6px 0 0;
  color: #597299;
  font-size: 13px;
}
</style>
