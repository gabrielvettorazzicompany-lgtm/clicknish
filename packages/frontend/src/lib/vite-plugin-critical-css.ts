/**
 * 🚀 VITE PLUGIN: Critical CSS Extractor & Inliner
 * 
 * Extrai CSS crítico para checkout e gera inline styles
 * - Análise automática de CSS crítico
 * - Inlining para first paint otimizado
 * - Lazy loading para CSS não-crítico
 * - Preload de CSS secundário
 * 
 * TARGET: <100ms First Contentful Paint
 */

import type { Plugin } from 'vite'
import path from 'path'
import fs from 'fs'
import postcss from 'postcss'
import cssnano from 'cssnano'

interface CriticalCSSOptions {
    pages: {
        [key: string]: {
            url: string
            css: string[]
            selectors: string[]
        }
    }
    inline: boolean
    minify: boolean
    extractThreshold: number // KB
}

const DEFAULT_OPTIONS: CriticalCSSOptions = {
    pages: {
        checkout: {
            url: '/checkout',
            css: [
                // CSS crítico para checkout
                'checkout-critical.css'
            ],
            selectors: [
                // Seletores críticos específicos
                '.checkout-container',
                '.checkout-header',
                '.checkout-form',
                '.checkout-skeleton',
                '.payment-form',
                '.order-summary',
                '.checkout-button',
                '.error-message',
                '.success-message',
                '.loading-spinner',
                // Layout crítico
                '.min-h-screen',
                '.bg-gray-50',
                '.max-w-7xl',
                '.lg\\:grid',
                '.lg\\:grid-cols-5',
                '.lg\\:gap-8',
                // Componentes críticos
                '.bg-white',
                '.rounded-xl',
                '.shadow-sm',
                '.border',
                '.border-gray-100',
                '.p-6',
                '.space-y-6',
                // Typography crítica
                '.text-lg',
                '.font-medium',
                '.text-gray-900',
                '.text-sm',
                '.text-gray-500',
                // Form crítico
                'input',
                'button',
                '.form-group',
                '.form-control'
            ]
        }
    },
    inline: true,
    minify: true,
    extractThreshold: 15 // 15KB threshold
}

export function criticalCSS(userOptions: Partial<CriticalCSSOptions> = {}): Plugin {
    const options = { ...DEFAULT_OPTIONS, ...userOptions }

    return {
        name: 'critical-css',
        enforce: 'post',

        async generateBundle(opts, bundle) {
            if (opts.format !== 'es') return

            console.log('🎨 [Critical CSS] Extracting critical styles...')

            for (const [pageName, pageConfig] of Object.entries(options.pages)) {
                await extractCriticalCSS(pageName, pageConfig, bundle, options)
            }
        },

        transformIndexHtml: {
            enforce: 'post',
            transform(html, ctx) {
                // Inject critical CSS inline
                if (ctx.filename.includes('checkout') || html.includes('checkout')) {
                    return injectCriticalCSS(html, 'checkout', options)
                }
                return html
            }
        }
    }
}

async function extractCriticalCSS(
    pageName: string,
    pageConfig: any,
    bundle: any,
    options: CriticalCSSOptions
) {
    const criticalCSS: string[] = []

    // Buscar arquivos CSS no bundle
    for (const [fileName, file] of Object.entries(bundle)) {
        if (fileName.endsWith('.css') && 'source' in file) {
            const css = file.source as string
            const critical = await extractSelectorsFromCSS(css, pageConfig.selectors)

            if (critical) {
                criticalCSS.push(critical)
            }
        }
    }

    if (criticalCSS.length === 0) return

    let combinedCSS = criticalCSS.join('\n')

    // Minificar se habilitado
    if (options.minify) {
        const result = await postcss([cssnano({ preset: 'advanced' })])
            .process(combinedCSS, { from: undefined })
        combinedCSS = result.css
    }

    // Checar threshold
    const sizeKB = Buffer.byteLength(combinedCSS, 'utf8') / 1024

    if (sizeKB > options.extractThreshold) {
        console.warn(`⚠️ [Critical CSS] ${pageName} critical CSS is ${sizeKB.toFixed(1)}KB (threshold: ${options.extractThreshold}KB)`)
    }

    // Salvar arquivo critical CSS
    const criticalFileName = `assets/critical-${pageName}.css`
    bundle[criticalFileName] = {
        type: 'asset',
        fileName: criticalFileName,
        source: combinedCSS
    }

    console.log(`✅ [Critical CSS] Extracted ${sizeKB.toFixed(1)}KB critical CSS for ${pageName}`)
}

async function extractSelectorsFromCSS(css: string, selectors: string[]): Promise<string> {
    const criticalRules: string[] = []

    // Parse CSS
    const root = postcss.parse(css)

    root.walkRules(rule => {
        const selector = rule.selector

        // Check if selector matches any critical selector
        const isCritical = selectors.some(criticalSelector => {
            // Handle escaped selectors (e.g., lg\:grid)
            const escaped = criticalSelector.replace(/\\/g, '\\\\')
            const regex = new RegExp(escaped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            return regex.test(selector) || selector.includes(criticalSelector.replace(/\\/g, ''))
        })

        if (isCritical) {
            criticalRules.push(rule.toString())
        }
    })

    // Extract CSS variables and base styles
    root.walkAtRules(rule => {
        if (rule.name === 'import' || rule.name === 'charset') {
            criticalRules.unshift(rule.toString())
        }
    })

    root.walkRules(rule => {
        if (rule.selector === ':root' || rule.selector.includes('*') && rule.selector.includes('box-sizing')) {
            criticalRules.unshift(rule.toString())
        }
    })

    return criticalRules.join('\n')
}

function injectCriticalCSS(html: string, pageName: string, options: CriticalCSSOptions): string {
    if (!options.inline) return html

    const criticalCSSPath = path.resolve(`dist/assets/critical-${pageName}.css`)

    if (!fs.existsSync(criticalCSSPath)) {
        console.warn(`⚠️ [Critical CSS] File not found: ${criticalCSSPath}`)
        return html
    }

    const criticalCSS = fs.readFileSync(criticalCSSPath, 'utf8')

    // Inject critical CSS inline in <head>
    const criticalStyleTag = `<style id="critical-css-${pageName}">${criticalCSS}</style>`

    // Insert before closing </head>
    const headCloseIndex = html.indexOf('</head>')
    if (headCloseIndex === -1) return html

    const beforeHead = html.substring(0, headCloseIndex)
    const afterHead = html.substring(headCloseIndex)

    // Add preload hints for non-critical CSS
    const preloadHints = generatePreloadHints()

    const newHtml = beforeHead + preloadHints + criticalStyleTag + afterHead

    console.log(`✅ [Critical CSS] Injected ${(criticalCSS.length / 1024).toFixed(1)}KB inline styles for ${pageName}`)

    return newHtml
}

function generatePreloadHints(): string {
    return `
        <!-- Preload non-critical CSS -->
        <link rel="preload" href="/assets/checkout.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
        <noscript><link rel="stylesheet" href="/assets/checkout.css"></noscript>
        
        <!-- Preload critical resources -->
        <link rel="preconnect" href="https://js.stripe.com" crossorigin>
        <link rel="preconnect" href="https://api.stripe.com" crossorigin>
        <link rel="preconnect" href="https://api.clicknich.com" crossorigin>
        
        <!-- DNS prefetch for external resources -->
        <link rel="dns-prefetch" href="https://fonts.googleapis.com">
        <link rel="dns-prefetch" href="https://fonts.gstatic.com">
    `
}