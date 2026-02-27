import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
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
          // Highcharts em chunk separado (~700KB)
          if (id.includes('highcharts')) return 'vendor-highcharts'
          // jsPDF em chunk separado (~500KB) - só carrega quando exportar
          if (id.includes('jspdf') || id.includes('jspdf-autotable')) return 'vendor-pdf'
          // Framer Motion em chunk separado (~150KB)
          if (id.includes('framer-motion')) return 'vendor-motion'
          // Supabase em chunk separado
          if (id.includes('@supabase')) return 'vendor-supabase'
          // HeroUI + React Aria em chunk separado (~400KB)
          if (id.includes('@heroui') || id.includes('@react-aria') || id.includes('@react-stately')) return 'vendor-ui'
          // Stripe — chunk separado, só carrega no checkout
          if (id.includes('@stripe') || id.includes('stripe-js')) return 'vendor-stripe'
          // Resto dos node_modules
          if (id.includes('node_modules')) return 'vendor-misc'
        },
      },
    },
  },
  publicDir: 'public'
})
