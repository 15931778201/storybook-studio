import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "node:path";
import { templateCompilerOptions } from '@tresjs/core'

export default defineConfig({
  plugins: [vue({
    template: {
      compilerOptions: templateCompilerOptions.template.compilerOptions,
    }
  })],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true
      }
    }
  }
});
