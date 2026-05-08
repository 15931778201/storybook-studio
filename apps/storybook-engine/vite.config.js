import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import legacy from '@vitejs/plugin-legacy'

export default defineConfig({
  plugins: [
    vue(),
    legacy({ targets: ['chrome >= 90'] }),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '交互式绘本引擎',
        short_name: '绘本',
        start_url: '.',
        display: 'standalone',
        background_color: '#f0ead6',
        theme_color: '#ff9f1c',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ]
})