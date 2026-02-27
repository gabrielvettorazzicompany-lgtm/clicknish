import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [
    react()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../shared/src'),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    copyPublicDir: true,
    target: 'es2020',         // Target moderno = bundle menor
    minify: 'terser',
    chunkSizeWarningLimit: 600, // Avisa se chunk > 600KB
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.debug', 'console.info'],
        passes: 2,             // 2 passes de compressão = menor bundle
      },
      mangle: {
        safari10: true,
      },
      format: {
        comments: false,
      },
    },
    sourcemap: false,
    rollupOptions: {
      output: {
        // Prefixo de hash para cache-busting eficiente
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        manualChunks: (id) => {
          // ✅ STRIPE: Chunk isolado para Stripe (grande + sem dependência de React)
          if (id.includes('node_modules/@stripe') || id.includes('node_modules/stripe-js')) {
            return 'vendor-stripe'
          }

          // ✅ CHARTS: Highcharts em chunk separado (~700KB)
          if (id.includes('node_modules/highcharts')) {
            return 'vendor-highcharts'
          }

          // ✅ PDF: jsPDF em chunk separado (~500KB)
          if (id.includes('node_modules/jspdf')) {
            return 'vendor-pdf'
          }

          // ✅ ANIMATIONS: Framer Motion em chunk separado (~150KB)
          if (id.includes('node_modules/framer-motion')) {
            return 'vendor-motion'
          }

          // ✅ DATE-FNS: Utilities de data (~75KB)
          if (id.includes('node_modules/date-fns')) {
            return 'vendor-date-fns'
          }

          // NOTA: React, react-router, supabase, heroui e outros vendors
          // ficam no chunk automático do Rollup para evitar instâncias duplicadas de React.
        },
      },
    },
  },
  publicDir: 'public'
})
