/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // L'aggiornamento non è automatico: l'app mostra un avviso e l'utente sceglie quando ricaricare.
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'GestioneTurni 112',
        short_name: 'Turni 112',
        description: 'Turni, cambi e ore dei medici del 112 di Genova.',
        lang: 'it',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#0B2C4F',
        theme_color: '#14467A',
        categories: ['medical', 'productivity'],
        icons: [
          { src: '/icona-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icona-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icona-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Tesseract (solo import da screenshot, solo admin e delegati) non va mai nel precache.
        globIgnores: ['ocr-tesseract/**'],
        // Le pagine di Firebase Auth (/__/auth/...) non devono essere servite dal service worker.
        navigateFallbackDenylist: [/^\/__\//],
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
    }),
  ],
  server: { port: 5173, strictPort: false },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
