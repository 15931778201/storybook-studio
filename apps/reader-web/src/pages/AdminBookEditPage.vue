<template>
  <section class="panel edit-panel">
    <div class="header-row">
      <div>
        <h2>编辑绘本</h2>
        <p class="sub">ID：{{ bookId }}</p>
      </div>
      <div class="header-actions">
        <button class="btn secondary" :disabled="loading || saving" @click="loadBook">重新加载</button>
        <button class="btn secondary" :disabled="saving" @click="goBack">返回管理</button>
      </div>
    </div>

    <p v-if="loading">正在加载绘本...</p>
    <p v-else-if="errorMessage" class="error">{{ errorMessage }}</p>

    <div v-else class="grid">
      <p class="hint">
        在这里编辑 <code>BookImportPayload</code> JSON。保存会覆盖书名、封面、标签和页面内容，但不会自动改变发布状态。
      </p>

      <textarea v-model="jsonText" class="textarea" spellcheck="false"></textarea>

      <div class="actions-row">
        <button class="btn" :disabled="saving" @click="onSave">保存修改</button>
        <button class="btn secondary" :disabled="saving" @click="goBack">取消</button>
      </div>

      <p v-if="successMessage" class="success">{{ successMessage }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { Book, BookImportPayload } from "@storybook-mvp/shared-types";
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { fetchAdminBookDetail, updateAdminBook } from "@/api/admin";

const router = useRouter();
const route = useRoute();

const bookId = computed(() => String(route.params.id ?? ""));

const loading = ref(false);
const saving = ref(false);
const jsonText = ref("");
const errorMessage = ref("");
const successMessage = ref("");
const book = ref<Book | null>(null);

function bookToPayload(item: Book): BookImportPayload {
  const pages = Array.isArray(item.pages) ? [...item.pages].sort((a, b) => a.pageNo - b.pageNo) : [];
  return {
    bookMeta: {
      title: item.title,
      subtitle: item.subtitle,
      coverUrl: item.coverUrl,
      ageRange: item.ageRange,
      tags: item.tags
    },
    pages
  };
}

async function loadBook() {
  loading.value = true;
  errorMessage.value = "";
  successMessage.value = "";
  try {
    const item = await fetchAdminBookDetail(bookId.value);
    book.value = item;
    jsonText.value = JSON.stringify(bookToPayload(item), null, 2);
  } catch (error) {
    errorMessage.value = `加载失败：${(error as Error).message}`;
  } finally {
    loading.value = false;
  }
}

async function onSave() {
  saving.value = true;
  errorMessage.value = "";
  successMessage.value = "";

  try {
    const payload = JSON.parse(jsonText.value) as unknown;
    const updated = await updateAdminBook(bookId.value, payload);
    book.value = updated;
    jsonText.value = JSON.stringify(bookToPayload(updated), null, 2);
    successMessage.value = `保存成功：${updated.title}`;
  } catch (error) {
    errorMessage.value = `保存失败：${(error as Error).message}`;
  } finally {
    saving.value = false;
  }
}

function goBack() {
  router.push("/admin/import");
}

onMounted(loadBook);
</script>

<style scoped>
.edit-panel {
  max-width: 920px;
  margin: 20px auto;
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.header-row h2 {
  margin: 0;
}

.sub {
  margin: 6px 0 0;
  color: #5f7598;
  font-size: 13px;
}

.header-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.hint {
  margin: 0;
  color: #5f7598;
  font-size: 14px;
}

.actions-row {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: flex-end;
}

.error {
  color: #d23737;
}

.success {
  color: #0f7b2f;
}

@media (max-width: 760px) {
  .edit-panel {
    margin: 12px auto;
  }

  .header-row {
    flex-direction: column;
    align-items: stretch;
  }

  .header-actions {
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .actions-row {
    justify-content: stretch;
  }
}
</style>

