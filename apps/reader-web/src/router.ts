import { createRouter, createWebHistory } from "vue-router";
import LibraryPage from "./pages/LibraryPage.vue";
import ReaderPage from "./pages/ReaderPage.vue";
import AdminLoginPage from "./pages/AdminLoginPage.vue";
import AdminImportPage from "./pages/AdminImportPage.vue";
import AdminBookEditPage from "./pages/AdminBookEditPage.vue";
import SplashScreen from "./pages/SplashScreen.vue";
import { useAuthStore } from "./stores/auth";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: LibraryPage },
    { path: "/splash", component: SplashScreen },
    { path: "/book/:id", component: ReaderPage },
    { path: "/admin/login", component: AdminLoginPage },
    { path: "/admin/books/:id/edit", component: AdminBookEditPage, meta: { requiresAdmin: true } },
    { path: "/admin/import", component: AdminImportPage, meta: { requiresAdmin: true } }
  ]
});

router.beforeEach((to) => {
  if (!to.meta.requiresAdmin) {
    return true;
  }

  const authStore = useAuthStore();
  if (!authStore.token) {
    return "/admin/login";
  }

  return true;
});
