import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'WA Dashboard',
        short_name: 'WA Dashboard',
        description: 'Dashboard chat WhatsApp untuk tim sales',
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
  server: {
    host: '0.0.0.0',
    port: 5000,
    allowedHosts: true,
  },
})
