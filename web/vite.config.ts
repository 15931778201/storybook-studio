import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // 核心：将 antd/x/monaco/highlight 等大库与主业务逻辑分离
        manualChunks(id) {
          if (id.includes('node_modules/antd')) return 'antd';
          if (id.includes('node_modules/@ant-design')) return 'antdx';
          if (id.includes('node_modules/@monaco-editor')) return 'monaco';
          if (id.includes('node_modules/highlight')) return 'highlight';
          if (id.includes('node_modules/react')) return 'react';
          if (id.includes('node_modules')) return 'vendor';
        },
      },
    },
    // 适当增大 chunk 体积警告阈值（避免过多小 chunk）
    chunkSizeWarningLimit: 600,
  },  
  server: { port: 5173, proxy: { '/api': 'http://localhost:3000' } },
});