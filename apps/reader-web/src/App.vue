<template>
  <div class="app-shell">
    <header class="topbar">
      <h1>儿童绘本阅读器 MVP</h1>
      <nav>
        <RouterLink to="/">书库</RouterLink>
        <RouterLink :to="adminEntryPath">管理员</RouterLink>
      </nav>
    </header>
    <main class="main-content">
      <RouterView />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useAuthStore } from "@/stores/auth";

const authStore = useAuthStore();

const adminEntryPath = computed(() => (authStore.token ? "/admin/import" : "/admin/login"));
</script>
