<template>
  <section class="grid">
    <div class="panel controls">
      <div class="field-row">
        <input v-model="filters.q" class="input" placeholder="搜索标题" />
        <input v-model="filters.age" class="input" placeholder="年龄段，例如 5-6" />
        <input v-model="filters.tag" class="input" placeholder="标签，例如 恐龙" />
        <button class="btn" @click="loadBooks">查询</button>
      </div>
    </div>

    <p v-if="loading">正在加载绘本...</p>
    <p v-else-if="errorMessage" class="error">{{ errorMessage }}</p>
    <p v-else-if="!books.length">暂无已发布绘本。</p>

    <div class="book-grid">
      <BookCard v-for="book in books" :key="book.id" :book="book" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import type { Book } from "@storybook-mvp/shared-types";
import { fetchPublishedBooks } from "@/api/books";
import BookCard from "@/components/BookCard.vue";

const books = ref<Book[]>([]);
const loading = ref(false);
const errorMessage = ref("");

const filters = reactive({
  q: "",
  age: "",
  tag: ""
});

async function loadBooks() {
  loading.value = true;
  errorMessage.value = "";
  try {
    books.value = await fetchPublishedBooks({
      q: filters.q || undefined,
      age: filters.age || undefined,
      tag: filters.tag || undefined
    });
  } catch (error) {
    errorMessage.value = `加载失败：${(error as Error).message}`;
  } finally {
    loading.value = false;
  }
}

onMounted(loadBooks);
</script>

<style scoped>
.controls {
  padding: 12px;
}

.field-row {
  display: grid;
  grid-template-columns: 1.4fr 1fr 1fr auto;
  gap: 10px;
}

.book-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 14px;
}

.error {
  color: #d23737;
}

@media (max-width: 760px) {
  .field-row {
    grid-template-columns: 1fr;
  }
}
</style>
