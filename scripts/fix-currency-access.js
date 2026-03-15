/**
 * Script de Correção Automatizada - Problema de Moedas e Acesso de Produtos
 * 
 * Este script identifica e corrige automaticamente vendas onde o acesso
 * aos produtos não foi liberado devido a problemas de conversão de moeda.
 * 
 * Como usar:
 * 1. node scripts/fix-currency-access.js --email=customer@email.com
 * 2. node scripts/fix-currency-access.js --payment-id=pi_xxx  
 * 3. node scripts/fix-currency-access.js --auto-fix (corrige automaticamente)
 * 4. node scripts/fix-currency-access.js --dry-run --auto-fix (simula correções)
 */

const { createClient } = require('@supabase/supabase-js')
const crypto = require('crypto')

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://your-project.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY is required')
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
})

// Configurações
const DRY_RUN = process.argv.includes('--dry-run')
const logPrefix = DRY_RUN ? '[DRY RUN]' : '[FIXING]'

async function createCustomerIfNotExists(customerEmail, customerName = null, customerPhone = null) {
    console.log(`${logPrefix} Verificando/criando customer_auth para: ${customerEmail}`)

    const { data: existing } = await supabase
        .from('customer_auth')
        .select('id, email')
        .eq('email', customerEmail)
        .maybeSingle()

    if (existing) {
        console.log(`✅ customer_auth já existe: ${existing.id}`)
        return existing.id
    }

    if (DRY_RUN) {
        console.log(`[DRY RUN] Criaria customer_auth para: ${customerEmail}`)
        return 'dry-run-user-id'
    }

    const { data: newAuth, error } = await supabase.auth.admin.createUser({
        email: customerEmail,
        email_confirm: true,
        user_metadata: {
            full_name: customerName || '',
            phone: customerPhone || '',
            created_via: 'currency_access_fix'
        }
    })

    if (error) {
        console.error(`❌ Erro ao criar customer_auth:`, error.message)
        return null
    }

    console.log(`✅ customer_auth criado: ${newAuth.user.id}`)
    return newAuth.user.id
}

async function findPaymentRecordWithCurrencyFix(paymentId) {
    console.log(`🔍 Buscando payment record: ${paymentId}`)

    const tables = [
        { name: 'stripe_redirect_payments', field: 'payment_intent_id' },
        { name: 'mollie_payments', field: 'mollie_payment_id' },
        { name: 'paypal_payments', field: 'paypal_capture_id' }
    ]

    for (const table of tables) {
        const { data: record } = await supabase
            .from(table.name)
            .select('*')
            .or(`${table.field}.eq.${paymentId},id.eq.${paymentId}`)
            .maybeSingle()

        if (record) {
            // Verificar se é um record válido para correção
            const isPaid = record.status === 'paid' || record.status === 'succeeded' || record.status === 'completed'

            if (!isPaid) {
                console.log(`⚠️  Payment não está pago ainda (status: ${record.status})`)
                return null
            }

            // Verificar se já existe acesso (mesmo que access_granted=true)
            const [appAccess, marketplaceAccess] = await Promise.all([
                supabase.from('user_product_access').select('id').eq('payment_id', paymentId).maybeSingle(),
                supabase.from('user_member_area_access').select('id').eq('payment_id', paymentId).maybeSingle()
            ])

            if (appAccess.data || marketplaceAccess.data) {
                console.log(`✅ Acesso já existe para este pagamento`)
                return null
            }

            console.log(`💳 Payment encontrado em ${table.name}`)
            console.log(`   Status: ${record.status}`)
            console.log(`   Access Granted: ${record.access_granted}`)
            console.log(`   Valor: ${record.amount} ${record.currency}`)

            return { ...record, table: table.name }
        }
    }

    console.log(`❌ Payment record não encontrado`)
    return null
}

async function fixAccessWithCurrencySupport(sale, paymentRecord) {
    console.log(`\n${logPrefix} Corrigindo acesso com suporte a conversão de moeda`)
    console.log(`Payment ID: ${sale.payment_id}`)
    console.log(`Customer: ${sale.customer_email}`)

    // Usar valores do payment record (que já incluem conversões FX corretas)
    const {
        customer_email: customerEmail,
        customer_name: customerName,
        customer_phone: customerPhone,
        product_type: productType,
        product_id: productId,
        application_id: applicationId,
        checkout_id: checkoutId,
        amount: chargedAmount,  // Valor que foi realmente cobrado (já convertido)
        currency: chargedCurrency,  // Moeda que foi realmente cobrada
        method,
        seller_id: sellerId,
        selected_order_bumps: selectedOrderBumps
    } = paymentRecord

    console.log(`💰 Valor cobrado: ${chargedAmount} ${chargedCurrency}`)

    // 1. Garantir que customer_auth existe
    const userId = await createCustomerIfNotExists(customerEmail, customerName, customerPhone)
    if (!userId) return false

    // 2. Identificar tipo de produto
    const finalProductId = applicationId || productId
    if (!finalProductId) {
        console.log(`❌ Produto ID não encontrado`)
        return false
    }

    // 3. Determinar se é app ou marketplace
    const { data: app } = await supabase
        .from('applications')
        .select('id, name, slug')
        .eq('id', finalProductId)
        .maybeSingle()

    if (app) {
        return await fixAppAccessWithCurrency(sale, paymentRecord, userId, app)
    } else {
        return await fixMarketplaceAccessWithCurrency(sale, paymentRecord, userId)
    }
}

async function fixAppAccessWithCurrency(sale, paymentRecord, userId, app) {
    const {
        customer_email: customerEmail,
        customer_name: customerName,
        customer_phone: customerPhone,
        application_id: applicationId,
        product_id: productId,
        checkout_id: checkoutId,
        amount: chargedAmount,
        currency: chargedCurrency,
        method,
        seller_id: sellerId,
        selected_order_bumps: selectedOrderBumps
    } = paymentRecord

    console.log(`📱 App: ${app.name} (${app.slug})`)

    // Buscar produtos do app
    const { data: appProducts } = await supabase
        .from('products')
        .select('id, name')
        .eq('application_id', applicationId || productId)

    if (!appProducts || appProducts.length === 0) {
        console.log(`❌ Nenhum produto encontrado para o app`)
        return false
    }

    console.log(`📦 Produtos do app: ${appProducts.length}`)

    if (!DRY_RUN) {
        // Criar/atualizar app_users 
        await supabase.from('app_users').upsert({
            user_id: userId,
            email: customerEmail,
            full_name: customerName,
            phone: customerPhone,
            application_id: applicationId || productId,
            status: 'active',
            created_at: new Date().toISOString(),
        }, { onConflict: 'application_id,email', ignoreDuplicates: false })
    }

    // Processar produtos principais
    let productsToGrant = [...appProducts]

    // Aplicar filtros se necessário (selected_modules, order bumps, etc)
    if (checkoutId) {
        const { data: funnelPage } = await supabase
            .from('funnel_pages')
            .select('settings')
            .eq('checkout_id', checkoutId)
            .eq('page_type', 'checkout')
            .maybeSingle()

        const funnelSelectedModules =
            funnelPage?.settings?.selected_modules && Array.isArray(funnelPage.settings.selected_modules)
                ? funnelPage.settings.selected_modules
                : null

        if (funnelSelectedModules && funnelSelectedModules.length > 0) {
            productsToGrant = productsToGrant.filter(p => funnelSelectedModules.includes(p.id))
            console.log(`🔒 selected_modules: ${productsToGrant.length}/${appProducts.length} módulos`)
        }

        // Excluir order bumps do acesso principal
        if (checkoutId) {
            const { data: orderBumps } = await supabase
                .from('checkout_offers')
                .select('offer_product_id')
                .eq('checkout_id', checkoutId)
                .eq('offer_type', 'order_bump')
                .eq('is_active', true)

            const orderBumpProductIds = orderBumps?.map(b => b.offer_product_id).filter(Boolean) || []
            if (orderBumpProductIds.length > 0) {
                productsToGrant = productsToGrant.filter(p => !orderBumpProductIds.includes(p.id))
                console.log(`🛒 Excluídos ${orderBumpProductIds.length} order bumps`)
            }
        }
    }

    if (productsToGrant.length > 0) {
        const purchaseId = crypto.randomUUID()
        const thankyouToken = crypto.randomUUID()

        const accessRecords = productsToGrant.map((p) => ({
            user_id: userId,
            product_id: p.id,
            application_id: applicationId || productId,
            access_type: 'purchase',
            is_active: true,
            payment_id: sale.payment_id,
            payment_method: method || 'currency_fix',
            payment_status: 'completed',
            purchase_price: Number(chargedAmount) || 0,  // Usar valor realmente cobrado
            payout_schedule: 'weekly',
            thankyou_token: thankyouToken,
            thankyou_token_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            thankyou_max_views: 5,
            created_at: new Date().toISOString(),
        }))

        if (DRY_RUN) {
            console.log(`[DRY RUN] Criaria ${accessRecords.length} registros de acesso`)
        } else {
            const { error: accessError } = await supabase
                .from('user_product_access')
                .upsert(accessRecords, { onConflict: 'user_id,product_id', ignoreDuplicates: false })

            if (accessError) {
                console.error(`❌ Erro ao criar acessos:`, accessError.message)
                return false
            }

            console.log(`✅ ${accessRecords.length} acessos criados com valor ${chargedAmount} ${chargedCurrency}`)

            // Marcar payment como processado
            await supabase
                .from(paymentRecord.table)
                .update({ access_granted: true, updated_at: new Date().toISOString() })
                .eq('id', paymentRecord.id)

            // Criar sale_location com valores corretos
            await supabase.from('sale_locations').upsert({
                customer_email: customerEmail,
                payment_id: sale.payment_id,
                amount: Number(chargedAmount),
                currency: chargedCurrency,  // Usar moeda real cobrada
                payment_method: method || 'fixed',
                product_id: applicationId || productId,
                payout_schedule: 'weekly',
                sale_date: new Date().toISOString(),
                user_id: sellerId || null,
                checkout_id: checkoutId || null,
            }, { onConflict: 'payment_id', ignoreDuplicates: false })
        }
    }

    return true
}

async function fixMarketplaceAccessWithCurrency(sale, paymentRecord, userId) {
    const {
        customer_email: customerEmail,
        product_id: productId,
        amount: chargedAmount,
        currency: chargedCurrency,
        method
    } = paymentRecord

    const { data: product } = await supabase
        .from('marketplace_products')
        .select('id, name, slug')
        .eq('id', productId)
        .maybeSingle()

    if (!product) {
        console.log(`❌ Produto marketplace não encontrado: ${productId}`)
        return false
    }

    console.log(`🛒 Produto: ${product.name} (${product.slug})`)

    if (DRY_RUN) {
        console.log(`[DRY RUN] Criaria acesso marketplace`)
    } else {
        const thankyouToken = crypto.randomUUID()

        const { error: accessError } = await supabase.from('user_member_area_access').upsert({
            user_id: userId,
            member_area_id: productId,
            access_type: 'purchase',
            is_active: true,
            payment_id: sale.payment_id,
            payment_method: method || 'currency_fix',
            payment_status: 'completed',
            purchase_price: Number(chargedAmount),  // Valor correto cobrado
            thankyou_token: thankyouToken,
            thankyou_token_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            thankyou_max_views: 5,
            created_at: new Date().toISOString(),
        }, { onConflict: 'user_id,member_area_id', ignoreDuplicates: false })

        if (accessError) {
            console.error(`❌ Erro ao criar acesso marketplace:`, accessError.message)
            return false
        }

        console.log(`✅ Acesso marketplace criado com valor ${chargedAmount} ${chargedCurrency}`)

        // Marcar payment como processado
        await supabase
            .from(paymentRecord.table)
            .update({ access_granted: true, updated_at: new Date().toISOString() })
            .eq('id', paymentRecord.id)
    }

    return true
}

async function fixByEmail(customerEmail) {
    console.log(`\n🔧 CORREÇÃO DE MOEDAS - EMAIL: ${customerEmail}`)
    console.log('='.repeat(60))

    const { data: saleLocations } = await supabase
        .from('sale_locations')
        .select('*')
        .eq('customer_email', customerEmail)
        .order('sale_date', { ascending: false })

    if (!saleLocations || saleLocations.length === 0) {
        console.log('⚠️  Nenhuma venda encontrada')
        return
    }

    console.log(`📊 Analisando ${saleLocations.length} venda(s)...\n`)

    let fixedCount = 0

    for (const sale of saleLocations) {
        console.log(`--- Venda ${sale.id} ---`)
        console.log(`Payment ID: ${sale.payment_id}`)

        // Verificar se já tem acesso
        const [appAccess, marketplaceAccess] = await Promise.all([
            supabase.from('user_product_access').select('id').eq('payment_id', sale.payment_id).maybeSingle(),
            supabase.from('user_member_area_access').select('id').eq('payment_id', sale.payment_id).maybeSingle()
        ])

        if (appAccess.data || marketplaceAccess.data) {
            console.log('✅ Acesso já existe, pulando...\n')
            continue
        }

        const paymentRecord = await findPaymentRecordWithCurrencyFix(sale.payment_id)
        if (!paymentRecord) {
            console.log('❌ Payment record não encontrado ou não corrigível\n')
            continue
        }

        const fixed = await fixAccessWithCurrencySupport(sale, paymentRecord)
        if (fixed) {
            fixedCount++
            console.log(`✅ Venda ${sale.id} corrigida!`)
        } else {
            console.log(`❌ Falha ao corrigir venda ${sale.id}`)
        }
        console.log('')
    }

    console.log(`\n📊 RESUMO: ${fixedCount} venda(s) corrigida(s)`)
}

async function autoFixCurrencyIssues() {
    console.log(`\n🔧 AUTO-CORREÇÃO DE PROBLEMAS DE MOEDA (últimos 7 dias)`)
    console.log('='.repeat(60))

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    // Buscar vendas sem acesso nos últimos 7 dias
    const { data: recentSales } = await supabase
        .from('sale_locations')
        .select('*')
        .gte('sale_date', sevenDaysAgo.toISOString())
        .order('sale_date', { ascending: false })

    if (!recentSales) {
        console.log('❌ Erro ao buscar vendas')
        return
    }

    console.log(`📊 Analisando ${recentSales.length} vendas...`)

    const problemSales = []

    for (const sale of recentSales) {
        const [appAccess, marketplaceAccess] = await Promise.all([
            supabase.from('user_product_access').select('id').eq('payment_id', sale.payment_id).maybeSingle(),
            supabase.from('user_member_area_access').select('id').eq('payment_id', sale.payment_id).maybeSingle()
        ])

        if (!appAccess.data && !marketplaceAccess.data) {
            problemSales.push(sale)
        }
    }

    console.log(`\n🚨 Vendas SEM acesso: ${problemSales.length}`)

    if (problemSales.length === 0) {
        console.log('✅ Nenhum problema encontrado!')
        return
    }

    let fixedCount = 0
    const processedEmails = new Set()

    for (const sale of problemSales) {
        if (processedEmails.has(sale.customer_email)) {
            continue
        }
        processedEmails.add(sale.customer_email)

        console.log(`\n--- Processando: ${sale.customer_email} ---`)
        const previousFixed = fixedCount

        await fixByEmail(sale.customer_email)

        fixedCount = previousFixed + 1
    }

    console.log(`\n✅ AUTO-CORREÇÃO CONCLUÍDA!`)
    console.log(`📊 ${fixedCount} email(s) processado(s)`)
}

async function main() {
    const args = process.argv.slice(2)

    if (args.length === 0) {
        console.log('❓ SCRIPT DE CORREÇÃO DE MOEDAS E ACESSOS')
        console.log('')
        console.log('Uso:')
        console.log('  node scripts/fix-currency-access.js --email=customer@email.com')
        console.log('  node scripts/fix-currency-access.js --payment-id=pi_xxx')
        console.log('  node scripts/fix-currency-access.js --auto-fix')
        console.log('')
        console.log('Flags:')
        console.log('  --dry-run    Simula as correções sem aplicar mudanças')
        process.exit(0)
    }

    if (DRY_RUN) {
        console.log('🔍 MODO DRY RUN - Simulação de correções')
        console.log('')
    }

    const emailArg = args.find(arg => arg.startsWith('--email='))
    const paymentIdArg = args.find(arg => arg.startsWith('--payment-id='))
    const autoFixFlag = args.includes('--auto-fix')

    if (emailArg) {
        const email = emailArg.split('=')[1]
        await fixByEmail(email)
    } else if (paymentIdArg) {
        const paymentId = paymentIdArg.split('=')[1]

        const { data: sale } = await supabase
            .from('sale_locations')
            .select('*')
            .eq('payment_id', paymentId)
            .maybeSingle()

        if (sale) {
            await fixByEmail(sale.customer_email)
        } else {
            console.log(`❌ Venda não encontrada para payment: ${paymentId}`)
        }
    } else if (autoFixFlag) {
        await autoFixCurrencyIssues()
    }

    console.log('\n✅ Processo concluído!')
}

main().catch(console.error)