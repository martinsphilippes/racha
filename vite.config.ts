import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

import pkg from './package.json' with { type: 'json' }
import { execSync } from 'node:child_process'

// Identificador da versão publicada: commit curto (Vercel expõe VERCEL_GIT_COMMIT_SHA).
function buildId(): string {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA
  if (sha) return sha.slice(0, 7)
  try { return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() } catch { return 'dev' }
}

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(`${pkg.version}+${buildId()}`) },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/favicon-64.png', 'icons/apple-touch-icon.png', 'brand/logo.webp'],
      manifest: {
        name: 'Racha 10 — organize seu futebol',
        short_name: 'Racha 10',
        description: 'Organize os jogos semanais de futsal e society: presença, rateio, PIX e times.',
        lang: 'pt-BR',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0a1440',
        theme_color: '#0a1440',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webp,ico,woff2}'],
        navigateFallback: '/index.html',
        // Nunca cacheia chamadas ao Firebase: dados sempre em tempo real.
        navigateFallbackDenylist: [/^\/__\//],
        runtimeCaching: [],
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    rollupOptions: {
      output: {
        // Separa o SDK do Firebase do código do app: o cache do navegador reaproveita o SDK entre versões.
        manualChunks: { firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'], react: ['react', 'react-dom', 'react-router'] },
      },
    },
  },
  server: { port: 5173, host: true },
  preview: { port: 4173, host: true },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
