<template>
  <section class="panel login-panel">
    <h2>管理员登录</h2>
    <div class="grid">
      <label>
        用户名
        <input v-model="form.username" class="input" placeholder="admin" />
      </label>
      <label>
        密码
        <input v-model="form.password" type="password" class="input" placeholder="请输入密码" />
      </label>
      <button class="btn" :disabled="loading" @click="onSubmit">登录</button>
      <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { adminLogin } from "@/api/admin";
import { useAuthStore } from "@/stores/auth";

const router = useRouter();
const authStore = useAuthStore();

const form = reactive({
  username: "admin",
  password: "admin123456"
});

const loading = ref(false);
const errorMessage = ref("");

async function onSubmit() {
  loading.value = true;
  errorMessage.value = "";
  try {
    const result = await adminLogin(form.username, form.password);
    authStore.setToken(result.token);
    await router.push("/admin/import");
  } catch (error) {
    errorMessage.value = `登录失败：${(error as Error).message}`;
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-panel {
  max-width: 420px;
  margin: 20px auto;
}

h2 {
  margin-top: 0;
}

.error {
  color: #d23737;
}
</style>
