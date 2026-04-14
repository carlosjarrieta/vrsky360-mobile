import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['apple-touch-icon.png', 'pwa-512x512.png'],
          manifest: {
            name: 'VRsky360 Mobile - Vendedor',
            short_name: 'VR360',
            description: 'Aplicación oficial para vendedores de VRsky360',
            start_url: '/',
            scope: '/',
            theme_color: '#2563eb',
            background_color: '#ffffff',
            display: 'standalone',
            orientation: 'portrait',
            categories: ['business', 'productivity'],
            icons: [
              {
                src: '/pwa-192x192.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'any'
              },
              {
                src: '/pwa-512x512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any maskable'
              }
            ],
            apple: {
              'apple-mobile-web-app-capable': 'yes',
              'apple-mobile-web-app-status-bar-style': 'black-translucent',
              'apple-mobile-web-app-title': 'VR360'
            },
            screenshots: [
              {
                src: '/pwa-512x512.png',
                sizes: '512x512',
                type: 'image/png',
                form_factor: 'narrow'
              }
            ]
          }
        })
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
