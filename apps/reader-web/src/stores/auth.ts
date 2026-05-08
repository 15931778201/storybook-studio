import { defineStore } from "pinia";

const TOKEN_STORAGE_KEY = "mvp_admin_token";

export const useAuthStore = defineStore("auth", {
  state: () => ({
    token: localStorage.getItem(TOKEN_STORAGE_KEY) ?? ""
  }),
  actions: {
    setToken(token: string) {
      this.token = token;
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    },
    logout() {
      this.token = "";
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  }
});
