import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

/**
 * Plugin: injeta __vitePreload inline nos chunks do checkout para eliminar a
 * dependência de vendor-heroui (que é importado só por causa desse helper).
 *
 * Com modulePreload: false e cssCodeSplit: false, o helper é chamado com
 * deps=[] e pode ser substituído por: (fn, _) => fn()
 */
function checkoutHeroUIDetach() {
  // Chunks do checkout que devem ter o helper inlineado
  const checkoutChunkNames = ['checkout', 'CheckoutDigital', 'CheckoutPublic', 'checkouts']

  return {
    name: 'checkout-heroui-detach',
    enforce: 'post' as const,
    renderChunk(code: string, chunk: any) {
      const name: string = chunk.name ?? ''
      const isCheckoutChunk = checkoutChunkNames.some(n => name.startsWith(n))
      if (!isCheckoutChunk) return null

      // Detecta: import{b as X}from"./vendor-heroui-HASH.js" (forma compacta do Rollup)
      // ou:     import { b as X } from './vendor-heroui-HASH.js' (forma espaçada)
      const match = code.match(/import\s*\{\s*b\s+as\s+(\w+)\s*\}\s*from\s*["'][^"']*vendor-heroui[^"']*["']/)
      if (!match) return null

      const alias = match[1]
      // Remove import de vendor-heroui e injeta o helper inline (~20 bytes)
      // Com modulePreload:false + cssCodeSplit:false, deps=[] → (f,_)=>f() é suficiente
      const newCode = code.replace(
        /import\s*\{\s*b\s+as\s+(\w+)\s*\}\s*from\s*["'][^"']*vendor-heroui[^"']*["'];?/,
        `const ${alias}=(f,_)=>f();`
      )
      return { code: newCode, map: null }
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    checkoutHeroUIDetach(),
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
    // ⚡ modulePreload: polyfill desabilitado (evita que o helper apareça em vendor-heroui)
    // mas MANTÉM os <link rel="modulepreload"> no checkout.html → browser baixa todos os
    // chunks JS em paralelo na 1ª request, eliminando o waterfall de 4-5 round trips.
    modulePreload: { polyfill: false },
    // CSS já está no index-BUn45iAA.css único — desabilitar code split evita que
    // Rollup injete um helper de CSS em vendor-heroui (quebrando a separação do checkout).
    cssCodeSplit: false,
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
      // ⚡ Dois entry points: main (app completo) + checkout (bundle mínimo)
      // O checkout.html usa checkout-main.tsx que exclui HeroUI, QueryClient, etc.
      input: {
        main: path.resolve(__dirname, 'index.html'),
        checkout: path.resolve(__dirname, 'checkout.html'),
      },
      output: {
        // Prefixo de hash para cache-busting eficiente
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        manualChunks: (id) => {
          // ✅ REACT CORE: chunk próprio — evita que React acabe dentro de vendor-heroui/vendor-motion
          // O checkout precisa de React mas NÃO de HeroUI/framer, então separar é crítico
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/react-is/') ||
            id.includes('node_modules/scheduler/')
          ) {
            return 'vendor-react'
          }

          // ✅ ROUTER: react-router-dom em chunk separado (usado por ambos os entries)
          if (id.includes('node_modules/react-router')) {
            return 'vendor-router'
          }

          // ✅ HEROUI + FRAMER-MOTION: apenas carregados pelo main (dashboard)
          // O checkout NÃO importa @heroui, então este chunk não aparece no checkout
          if (
            id.includes('node_modules/@heroui') ||
            id.includes('node_modules/framer-motion') ||
            id.includes('node_modules/@motionone') ||
            id.includes('node_modules/motion')
          ) {
            return 'vendor-heroui'
          }

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

          // ✅ DATE-FNS: Utilities de data (~75KB)
          if (id.includes('node_modules/date-fns')) {
            return 'vendor-date-fns'
          }

          // ✅ SUPABASE: cliente grande (~200KB) — usado por ambos os entries
          if (id.includes('node_modules/@supabase') || id.includes('node_modules/supabase')) {
            return 'vendor-supabase'
          }
        },
      },
    },
  },
  publicDir: 'public'
})
