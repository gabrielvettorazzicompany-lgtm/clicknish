/**
 * Script de Diagnóstico Avançado - Problema de Moedas em Pagamentos
 * 
 * Este script identifica especificamente problemas relacionados a conversões
 * de moeda que impedem a liberação de acesso após pagamento confirmado.
 * 
 * Como usar:
 * node scripts/currency-diagnosis.js --payment-id=tr_xxx
 * node scripts/currency-diagnosis.js --email=customer@email.com
 */

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://your-project.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY is required')
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
})

async function diagnoseCurrencyIssue(paymentId, customerEmail) {
    console.log('🔍 DIAGNÓSTICO DE CONVERSÃO DE MOEDA')
    console.log('='.repeat(60))

    // 1. Buscar payment record em todas as tabelas
    const tables = [
        { name: 'mollie_payments', id_field: 'mollie_payment_id' },
        { name: 'stripe_redirect_payments', id_field: 'payment_intent_id' },
        { name: 'paypal_payments', id_field: 'paypal_capture_id' }
    ]

    let paymentRecord = null
    let tableName = ''

    for (const table of tables) {
        const { data } = await supabase
            .from(table.name)
            .select('*')
            .or(`${table.id_field}.eq.${paymentId},id.eq.${paymentId}`)
            .maybeSingle()

        if (data) {
            paymentRecord = data
            tableName = table.name
            break
        }
    }

    if (!paymentRecord) {
        console.log(`❌ Payment record não encontrado para: ${paymentId}`)
        return
    }

    console.log(`💳 Payment encontrado na tabela: ${tableName}`)
    console.log(`Status: ${paymentRecord.status}`)
    console.log(`Access Granted: ${paymentRecord.access_granted}`)

    // 2. Analisar valores de moeda no record
    console.log('\n💰 ANÁLISE DE MOEDAS:')
    console.log('-'.repeat(40))

    if (paymentRecord.amount) {
        console.log(`Valor no Record: ${paymentRecord.amount}`)
    }
    if (paymentRecord.currency) {
        console.log(`Moeda no Record: ${paymentRecord.currency}`)
    }

    // 3. Buscar produto original para comparar moedas
    const productId = paymentRecord.product_id || paymentRecord.application_id
    if (productId) {
        console.log(`\n🏷️ PRODUTO ORIGINAL:`)
        console.log('-'.repeat(40))

        // Tentar como app primeiro
        const { data: app } = await supabase
            .from('applications')
            .select('name, slug')
            .eq('id', productId)
            .maybeSingle()

        if (app) {
            console.log(`App: ${app.name} (${app.slug})`)

            // Verificar checkout associado
            if (paymentRecord.checkout_id) {
                const { data: checkout } = await supabase
                    .from('checkouts')
                    .select('custom_price, currency')
                    .eq('id', paymentRecord.checkout_id)
                    .maybeSingle()

                if (checkout) {
                    console.log(`Checkout ID: ${paymentRecord.checkout_id}`)
                    console.log(`Preço definido: ${checkout.custom_price}`)
                    console.log(`Moeda do checkout: ${checkout.currency}`)

                    // PROBLEMA IDENTIFICADO: Comparar moedas
                    if (checkout.currency !== paymentRecord.currency) {
                        console.log(`\n🚨 PROBLEMA IDENTIFICADO!`)
                        console.log(`❌ Moeda do Checkout (${checkout.currency}) ≠ Moeda do Payment (${paymentRecord.currency})`)
                        console.log(`💡 CAUSA: Conversão FX aplicada mas record salvo com valores originais`)
                    }
                }
            }
        } else {
            // Tentar como marketplace produto
            const { data: product } = await supabase
                .from('marketplace_products')
                .select('name, price, currency, slug')
                .eq('id', productId)
                .maybeSingle()

            if (product) {
                console.log(`Produto: ${product.name} (${product.slug})`)
                console.log(`Preço base: ${product.price}`)
                console.log(`Moeda base: ${product.currency}`)

                if (product.currency !== paymentRecord.currency) {
                    console.log(`\n🚨 PROBLEMA IDENTIFICADO!`)
                    console.log(`❌ Moeda do Produto (${product.currency}) ≠ Moeda do Payment (${paymentRecord.currency})`)
                    console.log(`💡 CAUSA: Conversão FX aplicada mas acesso não foi concedido`)
                }
            }
        }
    }

    // 4. Verificar se existe sale_location com moedas diferentes
    const { data: saleLocation } = await supabase
        .from('sale_locations')
        .select('amount, currency')
        .eq('payment_id', paymentId)
        .maybeSingle()

    if (saleLocation) {
        console.log(`\n💼 SALE LOCATION:`)
        console.log('-'.repeat(40))
        console.log(`Valor registrado: ${saleLocation.amount}`)
        console.log(`Moeda registrada: ${saleLocation.currency}`)

        if (saleLocation.currency !== paymentRecord.currency) {
            console.log(`\n⚠️  INCONSISTÊNCIA DETECTADA!`)
            console.log(`❌ Moeda Sale Location (${saleLocation.currency}) ≠ Payment (${paymentRecord.currency})`)
        }
    }

    // 5. Verificar se há acessos criados
    const [appAccess, marketplaceAccess] = await Promise.all([
        supabase.from('user_product_access').select('purchase_price, user_id').eq('payment_id', paymentId),
        supabase.from('user_member_area_access').select('purchase_price, user_id').eq('payment_id', paymentId)
    ])

    console.log(`\n🔑 STATUS DO ACESSO:`)
    console.log('-'.repeat(40))
    console.log(`Acessos App: ${appAccess.data?.length || 0}`)
    console.log(`Acessos Marketplace: ${marketplaceAccess.data?.length || 0}`)

    if (appAccess.data && appAccess.data.length > 0) {
        appAccess.data.forEach(access => {
            console.log(`  - User: ${access.user_id}, Valor pago: ${access.purchase_price}`)
        })
    }

    if (marketplaceAccess.data && marketplaceAccess.data.length > 0) {
        marketplaceAccess.data.forEach(access => {
            console.log(`  - User: ${access.user_id}, Valor pago: ${access.purchase_price}`)
        })
    }

    // 6. VERIFICAÇÃO CRÍTICA: Valores corretos para grantAccess
    console.log(`\n🔧 CORREÇÃO NECESSÁRIA:`)
    console.log('-'.repeat(40))

    if (!paymentRecord.access_granted) {
        console.log(`✅ O payment record ainda não foi processado (access_granted = false)`)
        console.log(`💡 PRÓXIMO PASSO: Execute fix-access-issue.js --payment-id=${paymentId}`)
        console.log(`   O script irá usar os valores corretos do payment record para criar acessos`)
    } else {
        console.log(`⚠️  Payment já marcado como processado (access_granted = true)`)
        console.log(`❓ Investigar por que acessos não foram criados mesmo com processamento`)
    }

    // 7. Detectar padrões específicos de erro
    console.log(`\n🔍 PADRÕES DE ERRO DETECTADOS:`)
    console.log('-'.repeat(40))

    // Problema 1: Produto USD + Cliente EUR + iDEAL 
    if (paymentRecord.currency === 'EUR' && paymentRecord.method === 'ideal') {
        console.log(`⚠️  PADRÃO: iDEAL com EUR (conversão de outra moeda)`)
        console.log(`   Verifique se o produto original não era USD`)
    }

    // Problema 2: Record sem valores de moeda
    if (!paymentRecord.currency) {
        console.log(`❌ CRÍTICO: Payment record sem campo 'currency'`)
        console.log(`   Isso impede a criação correta dos registros de acesso`)
    }

    if (!paymentRecord.amount) {
        console.log(`❌ CRÍTICO: Payment record sem campo 'amount'`)
        console.log(`   Isso impede a criação correta dos registros de acesso`)
    }
}

async function checkRecentCurrencyIssues() {
    console.log('📊 ANÁLISE DE PROBLEMAS DE MOEDA (últimos 7 dias)')
    console.log('='.repeat(60))

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    // Buscar payments não processados recentes
    const tables = ['mollie_payments', 'stripe_redirect_payments', 'paypal_payments']

    let totalUnprocessed = 0
    let currencyMismatches = 0

    for (const table of tables) {
        const { data: unprocessedPayments } = await supabase
            .from(table)
            .select('*')
            .eq('access_granted', false)
            .gte('created_at', sevenDaysAgo.toISOString())

        if (unprocessedPayments && unprocessedPayments.length > 0) {
            console.log(`\n💳 ${table.toUpperCase()}: ${unprocessedPayments.length} não processados`)
            totalUnprocessed += unprocessedPayments.length

            for (const payment of unprocessedPayments.slice(0, 5)) {
                // Verificar status
                const statusField = table === 'mollie_payments' ? 'status' :
                    table === 'stripe_redirect_payments' ? 'status' : 'status'

                const isPaid = payment[statusField] === 'paid' ||
                    payment[statusField] === 'succeeded' ||
                    payment[statusField] === 'completed'

                if (isPaid) {
                    console.log(`  ⚠️  ${payment.customer_email} - Pago mas não processado`)
                    currencyMismatches++
                } else {
                    console.log(`  ℹ️  ${payment.customer_email} - Status: ${payment[statusField]}`)
                }
            }
        }
    }

    console.log(`\n📊 RESUMO:`)
    console.log(`Total não processados: ${totalUnprocessed}`)
    console.log(`Pagos mas sem acesso: ${currencyMismatches}`)

    if (currencyMismatches > 0) {
        console.log(`\n💡 RECOMENDAÇÃO:`)
        console.log(`Execute: node scripts/fix-access-issue.js --auto-fix`)
        console.log(`O script corrigirá automaticamente os pagamentos confirmados`)
    }
}

async function main() {
    const args = process.argv.slice(2)

    if (args.length === 0) {
        console.log('❓ DIAGNÓSTICO DE MOEDAS')
        console.log('')
        console.log('Uso:')
        console.log('  node scripts/currency-diagnosis.js --payment-id=tr_xxx')
        console.log('  node scripts/currency-diagnosis.js --email=customer@email.com')
        console.log('  node scripts/currency-diagnosis.js --report')
        process.exit(0)
    }

    const paymentIdArg = args.find(arg => arg.startsWith('--payment-id='))
    const emailArg = args.find(arg => arg.startsWith('--email='))
    const reportFlag = args.includes('--report')

    if (paymentIdArg) {
        const paymentId = paymentIdArg.split('=')[1]
        await diagnoseCurrencyIssue(paymentId, null)
    } else if (emailArg) {
        const email = emailArg.split('=')[1]

        // Buscar payments desse email
        const { data: saleLocations } = await supabase
            .from('sale_locations')
            .select('payment_id')
            .eq('customer_email', email)
            .order('sale_date', { ascending: false })
            .limit(3)

        if (saleLocations && saleLocations.length > 0) {
            for (const sale of saleLocations) {
                await diagnoseCurrencyIssue(sale.payment_id, email)
                console.log('\n' + '='.repeat(60) + '\n')
            }
        } else {
            console.log(`❌ Nenhuma venda encontrada para: ${email}`)
        }
    } else if (reportFlag) {
        await checkRecentCurrencyIssues()
    }

    console.log('\n✅ Diagnóstico concluído!')
}

main().catch(console.error)