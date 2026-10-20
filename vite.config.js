import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Service worker baru langsung aktif; halaman dimuat ulang ke versi baru
      // pada saat aman (buka app / pindah menu / app di belakang) oleh
      // src/lib/pwaUpdate.js (pendaftaran manual, bukan script bawaan plugin).
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.png', 'apple-touch-icon.png', 'chat-doodle-light.svg', 'chat-doodle-dark.svg'],
      manifest: {
        name: 'RenusPro Chat',
        short_name: 'RenusPro Chat',
        description: 'Dashboard chat WhatsApp untuk tim sales RenusPro',
        theme_color: '#3563e9',
        background_color: '#f0f3fa',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        // Impor handler Web Push ke service worker
        importScripts: ['push-sw.js'],
        // Jangan cache panggilan API/socket — biar data selalu realtime
        navigateFallbackDenylist: [/^\/api/, /socket\.io/],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === self.location.origin,
            handler: 'NetworkFirst',
            options: { cacheName: 'app-shell' },
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        // Pisahkan library besar ke chunk sendiri supaya caching lebih baik
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5000,
    allowedHosts: true,
  },
})
