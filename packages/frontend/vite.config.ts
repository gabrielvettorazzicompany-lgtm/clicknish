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
          // ✅ CHECKOUT CRITICAL: Chunk separado para checkout (carrega primeiro)
          if (id.includes('checkout/CheckoutDigital') ||
            id.includes('checkout/CheckoutPublic') ||
            id.includes('components/checkout/CheckoutWrapper')) {
            return 'checkout-critical'
          }

          // ✅ CHECKOUT COMPONENTS: Componentes do checkout (lazy)
          if (id.includes('components/checkout/') &&
            !id.includes('CheckoutWrapper') &&
            !id.includes('CheckoutDigital')) {
            return 'checkout-components'
          }

          // ✅ PAYMENT: Chunk separado para payment (Stripe + forms)
          if (id.includes('PaymentForm') ||
            id.includes('OrderSummary') ||
            id.includes('hooks/usePaymentProcessing')) {
            return 'checkout-payment'
          }

          // ✅ STRIPE: Chunk isolado para Stripe (grande + específico)
          if (id.includes('@stripe') || id.includes('stripe-js')) {
            return 'vendor-stripe'
          }

          // ✅ SUPABASE: Chunk separado para Supabase
          if (id.includes('@supabase') || id.includes('supabase-js')) {
            return 'vendor-supabase'
          }

          // ✅ ROUTING: React Router chunk
          if (id.includes('react-router')) {
            return 'vendor-router'
          }

          // ✅ UI LIBS: Libraries de UI
          if (id.includes('@heroui') || id.includes('heroui')) {
            return 'vendor-ui'
          }

          // ✅ UTILS: Utilities grandes
          if (id.includes('date-fns') || id.includes('lodash')) {
            return 'vendor-utils'
          }

          // ✅ CHARTS: Highcharts em chunk separado (~700KB)
          if (id.includes('highcharts')) {
            return 'vendor-highcharts'
          }

          // ✅ PDF: jsPDF em chunk separado (~500KB) - só carrega quando exportar
          if (id.includes('jspdf') || id.includes('jspdf-autotable')) {
            return 'vendor-pdf'
          }

          // ✅ ANIMATIONS: Framer Motion em chunk separado (~150KB)
          if (id.includes('framer-motion')) {
            return 'vendor-motion'
          }

          // ✅ ICONS: Lucide icons no chunk principal (evita problemas de export)
          if (id.includes('lucide-react')) {
            return 'index'
          }

          // ✅ REACT CORE: React + ReactDOM juntos
          if (id.includes('react') || id.includes('react-dom')) {
            return 'vendor-react'
          }

          // ✅ NODE_MODULES: Outros vendors pequenos
          if (id.includes('node_modules') && !id.includes('react')) {
            return 'vendor-misc'
          }
        },
      },
    },
  },
  publicDir: 'public'
})
