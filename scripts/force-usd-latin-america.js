/**
 * Script de Configuração - Forçar USD para América Latina
 * 
 * Este script configura o sistema para cobrar clientes da América Latina
 * apenas em dólares (USD), removendo a conversão automática para
 * moedas locais (MXN, COP, CLP, PEN).
 * 
 * Como usar:
 * node scripts/force-usd-latin-america.js --enable    # Ativar USD-only
 * node scripts/force-usd-latin-america.js --disable   # Voltar conversão automática
 * node scripts/force-usd-latin-america.js --status    # Ver status atual
 */

const fs = require('fs').promises
const path = require('path')

const FX_FILE_PATH = path.join(__dirname, '../workers/src/lib/fx.ts')

async function enableUsdOnlyForLatinAmerica() {
    console.log('🔧 CONFIGURANDO: América Latina cobrança apenas em USD')
    console.log('='.repeat(60))

    try {
        let content = await fs.readFile(FX_FILE_PATH, 'utf8')

        // Comentar moedas da América Latina
        const latinCountries = [
            "'MX': 'MXN',",
            "'CO': 'COP',",
            "'CL': 'CLP',",
            "'PE': 'PEN',"
        ]

        for (const country of latinCountries) {
            if (content.includes(country) && !content.includes(`// ${country}`)) {
                content = content.replace(country, `// ${country}  // ← DESABILITADO: Forçar USD`)
                console.log(`✅ Desabilitado: ${country.replace(/'/g, '').replace(',', '')} → agora usa USD`)
            }
        }

        await fs.writeFile(FX_FILE_PATH, content, 'utf8')

        console.log()
        console.log('🎯 RESULTADO:')
        console.log('✅ México (MX) → USD (era MXN)')
        console.log('✅ Colômbia (CO) → USD (era COP)')
        console.log('✅ Chile (CL) → USD (era CLP)')
        console.log('✅ Peru (PE) → USD (era PEN)')
        console.log()
        console.log('💳 Agora clientes da América Latina pagam em dólares!')
        console.log('📧 Emails pós-compra mostrarão valores em USD')
        console.log('⚠️  Redeploy necessário para ativar mudanças')

    } catch (error) {
        console.error('❌ Erro ao modificar arquivo:', error.message)
    }
}

async function disableUsdOnlyForLatinAmerica() {
    console.log('🔧 DESABILITANDO: Voltando conversão automática para América Latina')
    console.log('='.repeat(60))

    try {
        let content = await fs.readFile(FX_FILE_PATH, 'utf8')

        // Descomentar moedas da América Latina
        const latinCountries = [
            "// 'MX': 'MXN',  // ← DESABILITADO: Forçar USD",
            "// 'CO': 'COP',  // ← DESABILITADO: Forçar USD",
            "// 'CL': 'CLP',  // ← DESABILITADO: Forçar USD",
            "// 'PE': 'PEN',  // ← DESABILITADO: Forçar USD"
        ]

        const originalCountries = [
            "'MX': 'MXN',",
            "'CO': 'COP',",
            "'CL': 'CLP',",
            "'PE': 'PEN',"
        ]

        for (let i = 0; i < latinCountries.length; i++) {
            if (content.includes(latinCountries[i])) {
                content = content.replace(latinCountries[i], originalCountries[i])
                console.log(`✅ Reabilitado: ${originalCountries[i].replace(/'/g, '').replace(',', '')}`)
            }
        }

        await fs.writeFile(FX_FILE_PATH, content, 'utf8')

        console.log()
        console.log('🔄 Conversão automática reativada para América Latina')
        console.log('⚠️  Redeploy necessário para ativar mudanças')

    } catch (error) {
        console.error('❌ Erro ao modificar arquivo:', error.message)
    }
}

async function checkStatus() {
    console.log('📊 STATUS: Configuração atual de moedas')
    console.log('='.repeat(50))

    try {
        const content = await fs.readFile(FX_FILE_PATH, 'utf8')

        const checks = [
            { country: 'México', code: 'MX', currency: 'MXN', line: "'MX': 'MXN'," },
            { country: 'Colômbia', code: 'CO', currency: 'COP', line: "'CO': 'COP'," },
            { country: 'Chile', code: 'CL', currency: 'CLP', line: "'CL': 'CLP'," },
            { country: 'Peru', code: 'PE', currency: 'PEN', line: "'PE': 'PEN'," }
        ]

        for (const check of checks) {
            const isDisabled = content.includes(`// ${check.line}`)
            const status = isDisabled ? '💵 USD' : `💱 ${check.currency}`
            console.log(`${check.country} (${check.code}): ${status}`)
        }

        console.log()
        console.log('💡 Use --enable para forçar USD ou --disable para reativar conversão')

    } catch (error) {
        console.error('❌ Erro ao ler arquivo:', error.message)
    }
}

async function explainUpsellTransaction() {
    console.log()
    console.log('💳 EXPLICAÇÃO: Por que US$ 9.00 foi cobrado em USD?')
    console.log('='.repeat(50))
    console.log()
    console.log('Possíveis razões para a transação de US$ 9.00:')
    console.log()
    console.log('1. 🌎 Cliente de país NÃO listado na conversão')
    console.log('   • Brasil (BR) → USD (não tem conversão configurada)')
    console.log('   • Argentina (AR) → USD (não tem conversão configurada)')
    console.log('   • Outros países → USD por padrão')
    console.log()
    console.log('2. 🚫 Falha na API de conversão')
    console.log('   • API Frankfurter offline → fallback USD')
    console.log('   • Timeout na consulta → fallback USD')
    console.log()
    console.log('3. 💳 Processamento via Stripe')
    console.log('   • Stripe processa em USD por padrão')
    console.log('   • Alguns cartões preferem USD')
    console.log()
    console.log('4. ⚙️ Produto configurado como USD-only')
    console.log('   • Upsell específico sem conversão')
    console.log('   • Configuração manual do produto')
}

async function main() {
    const args = process.argv.slice(2)

    if (args.includes('--help')) {
        console.log('🔧 Configuração USD-only para América Latina')
        console.log()
        console.log('Uso:')
        console.log('  node scripts/force-usd-latin-america.js --enable     # Forçar USD apenas')
        console.log('  node scripts/force-usd-latin-america.js --disable    # Voltar conversão automática')
        console.log('  node scripts/force-usd-latin-america.js --status     # Ver configuração atual')
        console.log('  node scripts/force-usd-latin-america.js --explain    # Explicar transação USD')
        console.log()
        return
    }

    if (args.includes('--enable')) {
        await enableUsdOnlyForLatinAmerica()
    } else if (args.includes('--disable')) {
        await disableUsdOnlyForLatinAmerica()
    } else if (args.includes('--status')) {
        await checkStatus()
    } else if (args.includes('--explain')) {
        await explainUpsellTransaction()
    } else {
        console.log('❓ Use --help para ver as opções disponíveis')
        console.log('💡 Recomendado: node scripts/force-usd-latin-america.js --status')
    }
}

if (require.main === module) {
    main().catch(console.error)
}

module.exports = { enableUsdOnlyForLatinAmerica, disableUsdOnlyForLatinAmerica, checkStatus }