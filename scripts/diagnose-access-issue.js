/**
 * Script de Diagnóstico - Problema de Acesso de Produtos
 * 
 * Este script diagnostica por que o acesso aos produtos do app não está
 * sendo liberado automaticamente após uma venda.
 * 
 * Como usar:
 * 1. node scripts/diagnose-access-issue.js --email=customer@email.com
 * 2. ou node scripts/diagnose-access-issue.js --payment-id=pi_xxx
 * 3. ou node scripts/diagnose-access-issue.js --checkout-id=xxx
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

async function diagnoseByEmail(customerEmail) {
    console.log(`🔍 Diagnosticando vendas para email: ${customerEmail}`)
    console.log('='.repeat(60))

    // 1. Buscar vendas do cliente
    const { data: saleLocations, error: saleErr } = await supabase
        .from('sale_locations')
        .select('*')
        .eq('customer_email', customerEmail)
        .order('sale_date', { ascending: false })

    if (saleErr) {
        console.error('❌ Erro ao buscar vendas:', saleErr.message)
        return
    }

    if (!saleLocations || saleLocations.length === 0) {
        console.log('⚠️  Nenhuma venda encontrada para este email')
        return
    }

    console.log(`📊 Encontradas ${saleLocations.length} venda(s):`)

    for (const sale of saleLocations) {
        console.log(`\n--- Venda ${sale.id} ---`)
        console.log(`Data: ${sale.sale_date}`)
        console.log(`Valor: ${sale.amount} ${sale.currency}`)
        console.log(`Payment ID: ${sale.payment_id}`)
        console.log(`Produto ID: ${sale.product_id}`)

        // 2. Verificar se é venda de app
        if (sale.product_id) {
            const { data: app } = await supabase
                .from('applications')
                .select('id, name, slug')
                .eq('id', sale.product_id)
                .maybeSingle()

            if (app) {
                console.log(`📱 App: ${app.name} (${app.slug})`)
                await diagnoseAppAccess(sale, customerEmail)
            } else {
                // Verificar marketplace
                const { data: product } = await supabase
                    .from('marketplace_products')
                    .select('id, name, slug')
                    .eq('id', sale.product_id)
                    .maybeSingle()

                if (product) {
                    console.log(`🛒 Produto Marketplace: ${product.name}`)
                    await diagnoseMarketplaceAccess(sale, customerEmail)
                } else {
                    console.log('⚠️  Produto não encontrado')
                }
            }
        }
    }
}

async function diagnoseAppAccess(sale, customerEmail) {
    console.log('\n🔍 Diagnosticando acesso ao app...')

    // 1. Verificar se existe customer_auth
    const { data: customerAuth } = await supabase
        .from('customer_auth')
        .select('id, email')
        .eq('email', customerEmail)
        .maybeSingle()

    console.log(customerAuth ? '✅ customer_auth encontrado' : '❌ customer_auth NÃO encontrado')

    // 2. Verificar app_users
    const { data: appUsers } = await supabase
        .from('app_users')
        .select('user_id, email, application_id, status')
        .eq('email', customerEmail)

    console.log(`📊 app_users encontrados: ${appUsers?.length || 0}`)
    if (appUsers && appUsers.length > 0) {
        appUsers.forEach(au => {
            console.log(`  - App: ${au.application_id}, User ID: ${au.user_id}, Status: ${au.status}`)
        })
    }

    // 3. Verificar user_product_access
    const { data: productAccess } = await supabase
        .from('user_product_access')
        .select('*')
        .eq('payment_id', sale.payment_id)

    console.log(`🔑 user_product_access encontrados: ${productAccess?.length || 0}`)
    if (productAccess && productAccess.length > 0) {
        productAccess.forEach(access => {
            console.log(`  ✅ Product: ${access.product_id}, User: ${access.user_id}, Active: ${access.is_active}`)
        })
    } else {
        console.log('❌ PROBLEMA: Nenhum acesso de produto encontrado!')

        // 4. Verificar produtos do app
        const { data: appProducts } = await supabase
            .from('products')
            .select('id, name')
            .eq('application_id', sale.product_id)

        console.log(`📦 Produtos do app: ${appProducts?.length || 0}`)
        if (appProducts && appProducts.length > 0) {
            appProducts.forEach(prod => {
                console.log(`  - ${prod.name} (${prod.id})`)
            })
        }

        // 5. Verificar se existe user_id válido
        if (customerAuth) {
            const targetUserId = customerAuth.id
            console.log(`\n🔍 Verificando acesso para user_id: ${targetUserId}`)

            const { data: existingAccess } = await supabase
                .from('user_product_access')
                .select('*')
                .eq('user_id', targetUserId)

            console.log(`🔑 Total de acessos do usuário: ${existingAccess?.length || 0}`)
        }
    }

    // 6. Verificar se o pagamento foi processado nos handlers específicos
    await checkPaymentTables(sale.payment_id)
}

async function diagnoseMarketplaceAccess(sale, customerEmail) {
    console.log('\n🔍 Diagnosticando acesso marketplace...')

    // Verificar user_member_area_access
    const { data: memberAccess } = await supabase
        .from('user_member_area_access')
        .select('*')
        .eq('payment_id', sale.payment_id)

    console.log(`🔑 user_member_area_access encontrados: ${memberAccess?.length || 0}`)
    if (memberAccess && memberAccess.length > 0) {
        memberAccess.forEach(access => {
            console.log(`  ✅ Product: ${access.member_area_id}, User: ${access.user_id}, Active: ${access.is_active}`)
        })
    } else {
        console.log('❌ PROBLEMA: Nenhum acesso de área de membros encontrado!')
    }
}

async function checkPaymentTables(paymentId) {
    console.log('\n🔍 Verificando tabelas de pagamento...')

    // Stripe payments
    const { data: stripePayments } = await supabase
        .from('stripe_redirect_payments')
        .select('*')
        .eq('payment_intent_id', paymentId)

    if (stripePayments && stripePayments.length > 0) {
        console.log('💳 Pagamento Stripe encontrado:')
        stripePayments.forEach(payment => {
            console.log(`  - Status: ${payment.status}, Access Granted: ${payment.access_granted}`)
            console.log(`  - Purchase ID: ${payment.purchase_id}`)
        })
    }

    // Mollie payments  
    const { data: molliePayments } = await supabase
        .from('mollie_payments')
        .select('*')
        .or(`mollie_payment_id.eq.${paymentId},id.eq.${paymentId}`)

    if (molliePayments && molliePayments.length > 0) {
        console.log('🇳🇱 Pagamento Mollie encontrado:')
        molliePayments.forEach(payment => {
            console.log(`  - Status: ${payment.status}, Access Granted: ${payment.access_granted}`)
            console.log(`  - Purchase ID: ${payment.purchase_id}`)
        })
    }

    // PayPal payments
    const { data: paypalPayments } = await supabase
        .from('paypal_payments')
        .select('*')
        .eq('paypal_capture_id', paymentId)

    if (paypalPayments && paypalPayments.length > 0) {
        console.log('💰 Pagamento PayPal encontrado:')
        paypalPayments.forEach(payment => {
            console.log(`  - Status: ${payment.status}, Access Granted: ${payment.access_granted}`)
        })
    }
}

async function diagnoseByPaymentId(paymentId) {
    console.log(`🔍 Diagnosticando payment ID: ${paymentId}`)
    console.log('='.repeat(60))

    // Buscar venda pelo payment_id
    const { data: sale } = await supabase
        .from('sale_locations')
        .select('*')
        .eq('payment_id', paymentId)
        .maybeSingle()

    if (!sale) {
        console.log('⚠️  Venda não encontrada para este payment ID')
        await checkPaymentTables(paymentId)
        return
    }

    console.log(`📊 Venda encontrada: ${sale.customer_email}`)
    await diagnoseByEmail(sale.customer_email)
}

async function generateAccessReport() {
    console.log('\n📊 RELATÓRIO DE VENDAS SEM ACESSO (últimos 7 dias)')
    console.log('='.repeat(60))

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    // Buscar vendas recentes sem acesso correspondente
    const { data: recentSales } = await supabase
        .from('sale_locations')
        .select('*')
        .gte('sale_date', sevenDaysAgo.toISOString())
        .order('sale_date', { ascending: false })

    if (!recentSales) return

    console.log(`📊 Vendas analisadas: ${recentSales.length}`)

    const problemSales = []

    for (const sale of recentSales) {
        // Verificar se existe acesso correspondente
        const [appAccess, marketplaceAccess] = await Promise.all([
            supabase.from('user_product_access').select('id').eq('payment_id', sale.payment_id).maybeSingle(),
            supabase.from('user_member_area_access').select('id').eq('payment_id', sale.payment_id).maybeSingle()
        ])

        if (!appAccess.data && !marketplaceAccess.data) {
            problemSales.push(sale)
        }
    }

    console.log(`🚨 Vendas SEM acesso liberado: ${problemSales.length}`)

    if (problemSales.length > 0) {
        console.log('\nDetalhes das vendas problemáticas:')
        problemSales.slice(0, 10).forEach(sale => {
            console.log(`- ${sale.customer_email} | ${sale.sale_date} | ${sale.payment_id}`)
        })

        if (problemSales.length > 10) {
            console.log(`... e mais ${problemSales.length - 10} vendas`)
        }
    }
}

async function main() {
    const args = process.argv.slice(2)

    if (args.length === 0) {
        console.log('❓ Uso:')
        console.log('  node scripts/diagnose-access-issue.js --email=customer@email.com')
        console.log('  node scripts/diagnose-access-issue.js --payment-id=pi_xxx')
        console.log('  node scripts/diagnose-access-issue.js --report')
        console.log('')
        console.log('💡 CORREÇÕES DISPONÍVEIS:')
        console.log('  node scripts/fix-currency-access.js --auto-fix          (corrige problemas de moeda)')
        console.log('  node scripts/currency-diagnosis.js --report             (diagnóstico de moedas)')
        console.log('  node scripts/fix-currency-access.js --dry-run --auto-fix (simular correções)')
        process.exit(0)
    }

    const emailArg = args.find(arg => arg.startsWith('--email='))
    const paymentIdArg = args.find(arg => arg.startsWith('--payment-id='))
    const reportFlag = args.includes('--report')

    if (emailArg) {
        const email = emailArg.split('=')[1]
        await diagnoseByEmail(email)
    } else if (paymentIdArg) {
        const paymentId = paymentIdArg.split('=')[1]
        await diagnoseByPaymentId(paymentId)
    } else if (reportFlag) {
        await generateAccessReport()
    } else {
        console.log('❌ Argumento inválido')
    }

    console.log('\n✅ Diagnóstico concluído!')
}

main().catch(console.error)