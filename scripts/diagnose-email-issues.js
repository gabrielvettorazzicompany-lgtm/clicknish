/**
 * Script de Diagnóstico - Problemas de Emails Pós-Compra
 * 
 * Este script diagnostica se o problema do filtro "Todos" e conversões de moeda
 * está afetando o envio de emails de acesso após as compras.
 * 
 * Problemas detectados:
 * 1. Emails enviados com applicationId/loginUrl errados devido à deduplicação
 * 2. Emails sem produtos listados devido a problemas de conversão de moeda
 * 3. Acessos liberados mas emails não enviados
 * 
 * Como usar:
 * node scripts/diagnose-email-issues.js --report
 * node scripts/diagnose-email-issues.js --email=customer@email.com
 * node scripts/diagnose-email-issues.js --days=7
 */

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://cgeqtodbisgwvhkaahiy.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Modo demo para demonstração
const isDemoMode = process.argv.includes('--demo') || !SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_SERVICE_ROLE_KEY && !isDemoMode) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY is required')
    console.error('💡 Use --demo para executar demonstração sem credenciais')
    process.exit(1)
}

const supabase = isDemoMode ? null : createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
})

async function runDemoAnalysis(days) {
    console.log('🎭 MODO DEMONSTRAÇÃO - Simulando problemas típicos')
    console.log(`📊 Análise simulada dos últimos ${days} dias`)
    console.log()

    // Dados simulados baseados em cenários reais
    const simulatedData = [
        {
            email: 'cliente1@email.com',
            sale: { application_id: 'app-fitness', product_id: 'prod-123', product_slug: 'fitness-app' },
            payment: { access_granted: true, currency: 'EUR', amount: 91 },
            users: [
                { user_id: 'user-123', application_id: 'app-fitness', created_at: '2026-03-10' },
                { user_id: 'user-456', application_id: 'app-marketing', created_at: '2026-03-14' } // Mais recente!
            ]
        },
        {
            email: 'cliente2@email.com',
            sale: { application_id: 'app-marketing', product_id: 'prod-456', product_slug: 'marketing-tools' },
            payment: { access_granted: true, currency: 'BRL', amount: 497 },
            users: [
                { user_id: 'user-789', application_id: 'app-marketing', created_at: '2026-03-12' }
            ]
        },
        {
            email: 'cliente3@email.com',
            sale: { application_id: 'app-ecommerce', product_id: 'prod-789', product_slug: 'ecommerce-suite' },
            payment: { access_granted: true, currency: 'USD', amount: 100 },
            users: [
                { user_id: 'user-999', application_id: 'app-ecommerce', created_at: '2026-03-05' },
                { user_id: 'user-888', application_id: 'app-fitness', created_at: '2026-03-13' } // Mais recente!
            ]
        }
    ]

    let emailInconsistencies = 0
    let accessWithoutEmailData = 0
    let multipleUserIdsFound = 0
    const problemCustomers = new Set()

    for (const data of simulatedData) {
        const { email, sale, payment, users } = data

        console.log(`\n🔍 Analisando: ${email}`)
        console.log(`   Sale: App=${sale.application_id}, Product=${sale.product_id}`)
        console.log(`   👥 User IDs encontrados: ${users.length}`)

        if (users.length > 1) {
            multipleUserIdsFound++
            console.log('   🚨 PROBLEMA: Múltiplos user_ids detectados!')

            users.forEach((user, index) => {
                console.log(`      ${index + 1}. user_id: ${user.user_id}`)
                console.log(`         app: ${user.application_id}`)
                console.log(`         criado: ${new Date(user.created_at).toLocaleString('pt-BR')}`)
            })

            const mostRecentUser = users.sort((a, b) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )[0]

            console.log(`   📧 EMAIL seria enviado para: user_id=${mostRecentUser.user_id}`)
            console.log(`      app do email: ${mostRecentUser.application_id}`)
            console.log(`      mas VENDA foi para app: ${sale.application_id}`)

            if (mostRecentUser.application_id !== sale.application_id) {
                emailInconsistencies++
                problemCustomers.add(email)
                console.log('   ❌ INCONSISTÊNCIA: Email enviado para app ERRADA!')
                console.log(`      Cliente compraria app "${sale.application_id}"`)
                console.log(`      Mas receberia email da app "${mostRecentUser.application_id}"`)
            }
        }

        if (payment.currency !== 'USD') {
            console.log(`   💰 Moeda: ${payment.currency} (${payment.amount}) - Conversão detectada`)
            console.log('   ⚠️ Possível problema de conversão de moeda')
        }
    }

    console.log()
    console.log('📈 RESUMO DOS PROBLEMAS DE EMAIL (SIMULAÇÃO):')
    console.log('='.repeat(40))
    console.log(`🚨 Inconsistências de app no email: ${emailInconsistencies}`)
    console.log(`❌ Acessos não liberados com email: ${accessWithoutEmailData}`)
    console.log(`👥 Clientes com múltiplos user_ids: ${multipleUserIdsFound}`)
    console.log(`📧 Total de clientes problemáticos: ${problemCustomers.size}`)

    console.log()
    console.log('🚨 PROBLEMA IDENTIFICADO:')
    console.log('1. Cliente compra produto da "app-fitness"')
    console.log('2. Mas tem user_id mais recente na "app-marketing"')
    console.log('3. Filtro "Todos" escolhe o user_id mais recente')
    console.log('4. Email enviado com loginUrl da app ERRADA!')
    console.log('5. Cliente não consegue acessar o que comprou')

    if (problemCustomers.size > 0) {
        console.log()
        console.log('📋 CLIENTES COM PROBLEMAS:')
        Array.from(problemCustomers).forEach((email, i) => {
            console.log(`   ${i + 1}. ${email}`)
        })
    }

    console.log()
    console.log('💡 SOLUÇÃO: Corrigir lógica do filtro "Todos" para evitar deduplicação incorreta')
    console.log('📝 Execute: node scripts/fix-filter-deduplication.js --auto-fix')

    return {
        emailInconsistencies,
        accessWithoutEmailData,
        multipleUserIdsFound,
        problemCustomers: Array.from(problemCustomers)
    }
}

async function analyzeEmailInconsistencies(days = 7) {
    console.log('📧 ANÁLISE: Problemas de Email Pós-Compra')
    console.log('='.repeat(60))

    if (isDemoMode) {
        return await runDemoAnalysis(days)
    }

    const { data: saleLocations, error: salesErr } = await supabase
        .from('sale_locations')
        .select(`
            *,
            payment_records!payment_records_sale_id_fkey(
                payment_intent_id, 
                access_granted,
                amount,
                currency
            )
        `)
        .gte('sale_date', cutoffDate.toISOString())
        .order('sale_date', { ascending: false })

    if (salesErr) {
        console.error('❌ Erro ao buscar vendas:', salesErr.message)
        return
    }

    console.log(`📊 Análise de ${saleLocations?.length || 0} vendas dos últimos ${days} dias`)
    console.log()

    let emailInconsistencies = 0
    let accessWithoutEmailData = 0
    let multipleUserIdsFound = 0
    const problemCustomers = new Set()

    for (const sale of saleLocations || []) {
        const { customer_email, application_id, product_slug, product_id } = sale
        const paymentRecord = sale.payment_records?.[0]

        if (!paymentRecord || !paymentRecord.access_granted) continue

        console.log(`\n🔍 Analisando: ${customer_email}`)
        console.log(`   Sale: App=${application_id}, Product=${product_id}, Slug=${product_slug}`)

        // 2. Verificar se há múltiplos user_ids para este email
        const { data: allUsers, error: usersErr } = await supabase
            .from('app_users')
            .select('user_id, application_id, created_at')
            .eq('email', customer_email)

        if (usersErr) {
            console.warn('   ⚠️ Erro ao buscar users:', usersErr.message)
            continue
        }

        console.log(`   👥 User IDs encontrados: ${allUsers?.length || 0}`)

        if ((allUsers?.length || 0) > 1) {
            multipleUserIdsFound++
            console.log('   🚨 PROBLEMA: Múltiplos user_ids detectados!')

            allUsers?.forEach((user, index) => {
                console.log(`      ${index + 1}. user_id: ${user.user_id}`)
                console.log(`         app: ${user.application_id}`)
                console.log(`         criado: ${new Date(user.created_at).toLocaleString('pt-BR')}`)
            })

            // 3. Verificar qual user_id seria usado pelo filtro "Todos" (mais recente)
            const mostRecentUser = allUsers?.sort((a, b) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )[0]

            console.log(`   📧 EMAIL seria enviado para: user_id=${mostRecentUser?.user_id}`)
            console.log(`      mas ACESSO foi criado para app: ${application_id}`)

            if (mostRecentUser?.application_id !== application_id) {
                emailInconsistencies++
                problemCustomers.add(customer_email)
                console.log('   ❌ INCONSISTÊNCIA: Email enviado para app errado!')
            }
        }

        // 4. Verificar se acesso foi realmente liberado
        const userForThisApp = allUsers?.find(u => u.application_id === application_id)
        if (userForThisApp) {
            const { data: userAccess } = await supabase
                .from('user_product_access')
                .select('product_id, granted_at')
                .eq('user_id', userForThisApp.user_id)
                .eq('product_id', product_id)

            console.log(`   🔐 Acesso liberado: ${userAccess?.length > 0 ? 'SIM' : 'NÃO'}`)

            if (userAccess?.length === 0) {
                accessWithoutEmailData++
                problemCustomers.add(customer_email)
                console.log('   ❌ PROBLEMA: Email enviado mas acesso NÃO liberado!')
            }
        } else {
            console.log('   ⚠️ User não encontrado para esta app')
        }

        // 5. Verificar problema de conversão de moeda
        if (paymentRecord.currency !== 'USD') {
            console.log(`   💰 Moeda: ${paymentRecord.currency} (${paymentRecord.amount}) - Conversão detectada`)
            console.log('   ⚠️ Possível problema de conversão de moeda')
        }
    }

    console.log()
    console.log('📈 RESUMO DOS PROBLEMAS DE EMAIL:')
    console.log('='.repeat(40))
    console.log(`🚨 Inconsistências de app no email: ${emailInconsistencies}`)
    console.log(`❌ Acessos não liberados com email: ${accessWithoutEmailData}`)
    console.log(`👥 Clientes com múltiplos user_ids: ${multipleUserIdsFound}`)
    console.log(`📧 Total de clientes problemáticos: ${problemCustomers.size}`)

    if (problemCustomers.size > 0) {
        console.log()
        console.log('📋 CLIENTES COM PROBLEMAS:')
        Array.from(problemCustomers).forEach((email, i) => {
            console.log(`   ${i + 1}. ${email}`)
        })
    }

    return {
        emailInconsistencies,
        accessWithoutEmailData,
        multipleUserIdsFound,
        problemCustomers: Array.from(problemCustomers)
    }
}

async function diagnoseSpecificCustomerEmail(customerEmail) {
    console.log(`🔍 DIAGNÓSTICO DETALHADO: ${customerEmail}`)
    console.log('='.repeat(60))

    // 1. Buscar todas as vendas deste cliente
    const { data: sales } = await supabase
        .from('sale_locations')
        .select('*')
        .eq('customer_email', customerEmail)
        .order('sale_date', { ascending: false })

    console.log(`📊 Vendas encontradas: ${sales?.length || 0}`)

    // 2. Buscar todos os user_ids deste email
    const { data: users } = await supabase
        .from('app_users')
        .select(`
            user_id,
            application_id,
            created_at,
            applications(name, slug)
        `)
        .eq('email', customerEmail)

    console.log(`👥 User IDs: ${users?.length || 0}`)
    users?.forEach((user, i) => {
        console.log(`   ${i + 1}. ${user.user_id} (${user.applications?.name || 'N/A'})`)
    })

    // 3. Simulação: Como filtro "Todos" escolheria o user_id
    const mostRecentUser = users?.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0]

    console.log()
    console.log(`📧 SIMULAÇÃO: Filtro "Todos" usaria:`)
    console.log(`   User ID: ${mostRecentUser?.user_id}`)
    console.log(`   App: ${mostRecentUser?.applications?.name || 'N/A'}`)
    console.log(`   Login URL seria: /access/${mostRecentUser?.applications?.slug || 'unknown'}`)

    // 4. Verificar cada venda
    for (const sale of sales || []) {
        console.log(`\n💳 VENDA: ${new Date(sale.sale_date).toLocaleString('pt-BR')}`)
        console.log(`   App real da venda: ${sale.application_id}`)
        console.log(`   Product ID: ${sale.product_id}`)

        const correctUser = users?.find(u => u.application_id === sale.application_id)
        console.log(`   User correto seria: ${correctUser?.user_id || 'NÃO ENCONTRADO'}`)

        if (mostRecentUser?.user_id !== correctUser?.user_id) {
            console.log(`   ❌ PROBLEMA: Email enviado para user errado!`)
            console.log(`      Email enviou: ${mostRecentUser?.user_id} (${mostRecentUser?.applications?.name})`)
            console.log(`      Deveria ser: ${correctUser?.user_id} (${correctUser?.applications?.name})`)
        } else {
            console.log(`   ✅ Email enviado corretamente`)
        }
    }
}

async function main() {
    const args = process.argv.slice(2)

    if (args.includes('--help')) {
        console.log('📧 Diagnóstico de Problemas de Email Pós-Compra')
        console.log()
        console.log('Uso:')
        console.log('  node scripts/diagnose-email-issues.js --report                    # Análise geral (requer credenciais)')
        console.log('  node scripts/diagnose-email-issues.js --demo                     # Demonstração com dados simulados')
        console.log('  node scripts/diagnose-email-issues.js --email=customer@email.com # Cliente específico')
        console.log('  node scripts/diagnose-email-issues.js --days=14                  # Últimos 14 dias')
        console.log()
        console.log('💡 Use --demo para ver como funciona sem precisar das credenciais do banco')
        return
    }

    const emailArg = args.find(arg => arg.startsWith('--email='))
    const daysArg = args.find(arg => arg.startsWith('--days='))
    const isReport = args.includes('--report')
    const isDemo = args.includes('--demo')

    if (emailArg && !isDemo) {
        if (isDemoMode) {
            console.log('❌ Modo demo não suporta análise de cliente específico')
            console.log('💡 Configure SUPABASE_SERVICE_ROLE_KEY para funcionalidade completa')
            return
        }
        const email = emailArg.split('=')[1]
        await diagnoseSpecificCustomerEmail(email)
    } else if (isReport || daysArg || isDemo) {
        const days = daysArg ? parseInt(daysArg.split('=')[1]) : 7
        await analyzeEmailInconsistencies(days)
    } else {
        console.log('❌ Use --help para ver as opções disponíveis')
    }
}

if (require.main === module) {
    main().catch(console.error)
}

module.exports = { analyzeEmailInconsistencies, diagnoseSpecificCustomerEmail }