<template>
  <section class="grid layout">
    <div class="panel">
      <div class="header-row">
        <h2>绘本 JSON 导入</h2>
        <button class="btn secondary" @click="logout">退出</button>
      </div>

      <div class="actions-row">
        <input type="file" accept="application/json" @change="onFileSelect" />
        <button class="btn secondary" @click="fillSample">填充示例</button>
        <button class="btn" :disabled="loading" @click="onImport">导入草稿</button>
      </div>

      <textarea v-model="jsonText" class="textarea" spellcheck="false"></textarea>

      <div class="actions-row">
      </div>

      <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
      <p v-if="successMessage" class="success">{{ successMessage }}</p>
    </div>

    <div class="panel">
      <div class="header-row">
        <h2>绘本管理</h2>
        <button class="btn secondary" @click="loadBooks">刷新</button>
      </div>
      <p v-if="booksLoading">加载中...</p>
      <p v-else-if="!books.length">暂无绘本</p>
      <table v-else class="book-table">
        <thead>
          <tr>
            <th>标题</th>
            <th>状态</th>
            <th>页数</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="book in books" :key="book.id">
            <td>{{ book.title }}</td>
            <td>{{ book.status }}</td>
            <td>{{ book.pageCount }}</td>
            <td class="actions-cell">
              <button class="btn secondary" @click="goEdit(book.id)">编辑</button>
              <button class="btn danger" :disabled="deletingBookId === book.id" @click="onDelete(book)">
                {{ deletingBookId === book.id ? "删除中..." : "删除" }}
              </button>
              <button
                v-if="book.status === 'draft'"
                class="btn"
                @click="togglePublish(book.id, true)"
              >
                发布
              </button>
              <button
                v-else
                class="btn warn"
                @click="togglePublish(book.id, false)"
              >
                下架
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="panel">
      <div class="header-row">
        <h2>阅读事件概览</h2>
        <button class="btn secondary" @click="loadSummary">刷新</button>
      </div>
      <p>总事件数：{{ summary.totalEvents }}</p>
      <ul class="summary-list">
        <li v-for="item in summaryRows" :key="item.key">
          {{ item.key }}: {{ item.value }}
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { Book } from "@storybook-mvp/shared-types";
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import {
  deleteAdminBook,
  fetchAdminBooks,
  fetchReadingSummary,
  importBook,
  publishBook,
  unpublishBook
} from "@/api/admin";
import { useAuthStore } from "@/stores/auth";
import animatedSamplePayload from "@/storybook/animatedSample";

const router = useRouter();
const authStore = useAuthStore();

const loading = ref(false);
const booksLoading = ref(false);
const jsonText = ref("");
const errorMessage = ref("");
const successMessage = ref("");
const books = ref<Book[]>([]);
const deletingBookId = ref("");
const summary = ref({
  totalEvents: 0,
  byType: {} as Record<string, number>
});

const summaryRows = computed(() =>
  Object.entries(summary.value.byType).map(([key, value]) => ({ key, value }))
);

function fillSample() {
  jsonText.value = JSON.stringify(animatedSamplePayload, null, 2);
}

async function onFileSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) {
    return;
  }

  const text = await file.text();
  jsonText.value = text;
}

async function onImport() {
  loading.value = true;
  errorMessage.value = "";
  successMessage.value = "";

  try {
    const payload = JSON.parse(jsonText.value);
    const imported = await importBook(payload);
    successMessage.value = `导入成功：${imported.title}`;
    await loadBooks();
  } catch (error) {
    errorMessage.value = `导入失败：${(error as Error).message}`;
  } finally {
    loading.value = false;
  }
}

async function loadBooks() {
  booksLoading.value = true;
  try {
    books.value = await fetchAdminBooks();
  } catch (error) {
    errorMessage.value = `加载绘本失败：${(error as Error).message}`;
  } finally {
    booksLoading.value = false;
  }
}

async function togglePublish(bookId: string, publish: boolean) {
  try {
    if (publish) {
      await publishBook(bookId);
    } else {
      await unpublishBook(bookId);
    }
    await loadBooks();
  } catch (error) {
    errorMessage.value = `更新状态失败：${(error as Error).message}`;
  }
}

function goEdit(bookId: string) {
  router.push(`/admin/books/${bookId}/edit`);
}

async function onDelete(book: Book) {
  const confirmed = window.confirm(`确定删除《${book.title}》吗？此操作不可恢复。`);
  if (!confirmed) {
    return;
  }

  deletingBookId.value = book.id;
  errorMessage.value = "";
  successMessage.value = "";
  try {
    await deleteAdminBook(book.id);
    successMessage.value = `已删除：${book.title}`;
    await loadBooks();
  } catch (error) {
    errorMessage.value = `删除失败：${(error as Error).message}`;
  } finally {
    deletingBookId.value = "";
  }
}

async function loadSummary() {
  try {
    summary.value = await fetchReadingSummary();
  } catch (error) {
    errorMessage.value = `加载统计失败：${(error as Error).message}`;
  }
}

function logout() {
  authStore.logout();
  router.push("/admin/login");
}

onMounted(async () => {
  fillSample();
  await Promise.all([loadBooks(), loadSummary()]);
});
</script>

<style scoped>
.layout {
  grid-template-columns: 1fr;
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.header-row h2 {
  margin: 0;
}

.actions-row {
  margin: 10px 0;
  display: flex;
  gap: 10px;
  align-items: center;
}

.book-table {
  width: 100%;
  border-collapse: collapse;
}

.book-table th,
.book-table td {
  border-bottom: 1px solid #e3e9f7;
  padding: 10px 6px;
  text-align: left;
}

.actions-cell {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.btn.danger {
  background: #d34b4b;
}

.summary-list {
  margin: 0;
  padding-left: 18px;
  color: #5f7598;
}

.error {
  color: #d23737;
}

.success {
  color: #0f7b2f;
}
</style>
