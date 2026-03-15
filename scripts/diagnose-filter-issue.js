/**
 * Script de Diagnóstico - Problema de Filtro "Todos" e Deduplicação
 * 
 * Este script verifica se o filtro "Todos" e a deduplicação por email
 * estão causando inconsistências na liberação de acesso aos produtos.
 * 
 * Como usar:
 * node scripts/diagnose-filter-issue.js --email=customer@email.com
 * node scripts/diagnose-filter-issue.js --report
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

async function diagnoseFilterDeduplication(customerEmail) {
    console.log('🔍 DIAGNÓSTICO DE PROBLEMA DE FILTRO "TODOS" E DEDUPLICAÇÃO')
    console.log('='.repeat(70))
    console.log(`Email: ${customerEmail}\n`)

    // 1. Verificar quantos app_users existem para este email
    const { data: appUsers, error: appError } = await supabase
        .from('app_users')
        .select('*')
        .eq('email', customerEmail)
        .order('created_at', { ascending: false })

    if (appError) {
        console.error('❌ Erro ao buscar app_users:', appError.message)
        return
    }

    console.log(`📊 APP_USERS encontrados: ${appUsers?.length || 0}`)
    if (appUsers && appUsers.length > 0) {
        appUsers.forEach((user, index) => {
            console.log(`  ${index + 1}. App: ${user.application_id}, User ID: ${user.user_id}`)
            console.log(`     Status: ${user.status}, Criado: ${user.created_at}`)
        })
    }

    // 2. Verificar customer_auth
    const { data: customerAuth } = await supabase
        .from('customer_auth')
        .select('id, email')
        .eq('email', customerEmail)
        .maybeSingle()

    console.log(`\n🔑 CUSTOMER_AUTH: ${customerAuth ? `Encontrado (${customerAuth.id})` : 'NÃO encontrado'}`)

    // 3. Verificar user_product_access para cada user_id
    if (appUsers && appUsers.length > 0) {
        console.log(`\n🔐 USER_PRODUCT_ACCESS por user_id:`)

        for (const user of appUsers) {
            const { data: productAccess } = await supabase
                .from('user_product_access')
                .select('*')
                .eq('user_id', user.user_id)
                .order('created_at', { ascending: false })

            console.log(`  User ID ${user.user_id} (App: ${user.application_id}):`)

            if (productAccess && productAccess.length > 0) {
                productAccess.forEach(access => {
                    console.log(`    ✅ Produto: ${access.product_id}, Payment: ${access.payment_id}`)
                    console.log(`       Preço: ${access.purchase_price}, Status: ${access.payment_status}`)
                })
            } else {
                console.log(`    ❌ Nenhum acesso encontrado`)
            }
        }
    }

    // 4. Verificar vendas recentes para este email
    const { data: saleLocations } = await supabase
        .from('sale_locations')
        .select('*')
        .eq('customer_email', customerEmail)
        .order('sale_date', { ascending: false })
        .limit(5)

    console.log(`\n💼 SALE_LOCATIONS (últimas 5): ${saleLocations?.length || 0}`)
    if (saleLocations && saleLocations.length > 0) {
        saleLocations.forEach((sale, index) => {
            console.log(`  ${index + 1}. Payment: ${sale.payment_id}, Produto: ${sale.product_id}`)
            console.log(`     Valor: ${sale.amount} ${sale.currency}, Data: ${sale.sale_date}`)
        })
    }

    // 5. PROBLEMA CRÍTICO: Detectar IDs conflitantes
    if (appUsers && appUsers.length > 1) {
        console.log(`\n🚨 PROBLEMA DETECTADO: Múltiplos app_users para o mesmo email`)

        // Verificar se customer_auth.id corresponde algum user_id
        if (customerAuth) {
            const matchingUser = appUsers.find(u => u.user_id === customerAuth.id)
            if (matchingUser) {
                console.log(`✅ customer_auth.id (${customerAuth.id}) corresponde ao app_user da app ${matchingUser.application_id}`)
            } else {
                console.log(`❌ customer_auth.id (${customerAuth.id}) NÃO corresponde a nenhum app_user.user_id`)
                console.log(`💡 PROBLEMA: Isso pode causar falha na liberação de acesso!`)
            }
        }

        // Verificar user_product_access orfão (sem app_user correspondente)
        const allUserIds = appUsers.map(u => u.user_id)

        if (customerAuth && !allUserIds.includes(customerAuth.id)) {
            const { data: orphanAccess } = await supabase
                .from('user_product_access')
                .select('*')
                .eq('user_id', customerAuth.id)

            if (orphanAccess && orphanAccess.length > 0) {
                console.log(`\n⚠️  ACESSOS ÓRFÃOS encontrados para customer_auth.id:`)
                orphanAccess.forEach(access => {
                    console.log(`  - Produto: ${access.product_id}, Payment: ${access.payment_id}`)
                })
            }
        }
    }

    // 6. Análise da lógica de deduplicação do frontend
    console.log(`\n🔍 ANÁLISE DE DEDUPLICAÇÃO:`)
    console.log(`O frontend faz deduplicação por email, mantendo apenas 1 registro por email.`)

    if (appUsers && appUsers.length > 1) {
        const latest = appUsers[0]  // Primeiro da lista ordenada por created_at desc
        const others = appUsers.slice(1)

        console.log(`✅ Frontend manteria: App ${latest.application_id}, User ID ${latest.user_id}`)
        console.log(`❌ Frontend ocultaria: ${others.map(u => `App ${u.application_id} (${u.user_id})`).join(', ')}`)

        // Verificar se o hidden tem acessos importantes
        for (const hiddenUser of others) {
            const { data: hiddenAccess } = await supabase
                .from('user_product_access')
                .select('*')
                .eq('user_id', hiddenUser.user_id)

            if (hiddenAccess && hiddenAccess.length > 0) {
                console.log(`⚠️  ATENÇÃO: User ID oculto ${hiddenUser.user_id} tem ${hiddenAccess.length} acesso(s)!`)
                console.log(`   Isso pode confundir o admin sobre quais produtos o cliente tem acesso.`)
            }
        }
    }

    return {
        appUsersCount: appUsers?.length || 0,
        hasCustomerAuth: !!customerAuth,
        hasMultipleAppUsers: appUsers && appUsers.length > 1
    }
}

async function reportFilterIssues() {
    console.log('📊 RELATÓRIO DE PROBLEMAS DE FILTRO E DEDUPLICAÇÃO')
    console.log('='.repeat(70))

    // 1. Buscar emails que aparecem em múltiplas apps
    const { data: duplicateEmails, error } = await supabase
        .from('app_users')
        .select('email')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Últimos 30 dias


    if (error) {
        console.error('❌ Erro ao buscar emails duplicados:', error.message)
        return
    }

    // Contar duplicatas
    const emailCounts = {}
    duplicateEmails.forEach(row => {
        emailCounts[row.email] = (emailCounts[row.email] || 0) + 1
    })

    const duplicatedEmails = Object.entries(emailCounts)
        .filter(([email, count]) => count > 1)
        .map(([email, count]) => ({ email, count }))
        .sort((a, b) => b.count - a.count)

    console.log(`📊 Emails em múltiplas apps (últimos 30 dias): ${duplicatedEmails.length}`)

    if (duplicatedEmails.length > 0) {
        console.log(`\n🚨 TOP 10 emails mais duplicados:`)
        duplicatedEmails.slice(0, 10).forEach((item, index) => {
            console.log(`  ${index + 1}. ${item.email} (${item.count} apps)`)
        })

        // Verificar alguns casos específicos
        console.log(`\n🔍 Análise detalhada de 3 casos:`)
        for (let i = 0; i < Math.min(3, duplicatedEmails.length); i++) {
            console.log(`\n--- ${duplicatedEmails[i].email} ---`)
            await diagnoseFilterDeduplication(duplicatedEmails[i].email)
        }
    } else {
        console.log(`✅ Nenhum email duplicado encontrado nos últimos 30 dias.`)
    }

    // 2. Verificar vendas orphan (sale_location sem user_product_access)
    console.log(`\n\n🔍 VERIFICANDO VENDAS SEM ACESSO (últimos 7 dias)...`)

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data: recentSales } = await supabase
        .from('sale_locations')
        .select('customer_email, payment_id, product_id')
        .gte('sale_date', sevenDaysAgo)
        .not('product_id', 'is', null)

    let problemSales = 0
    const problemEmails = new Set()

    if (recentSales) {
        for (const sale of recentSales.slice(0, 20)) {  // Apenas primeiras 20 para não sobrecarregar
            // Verificar se tem acesso
            const { data: access } = await supabase
                .from('user_product_access')
                .select('id')
                .eq('payment_id', sale.payment_id)
                .maybeSingle()

            if (!access) {
                problemSales++
                problemEmails.add(sale.customer_email)
            }
        }
    }

    console.log(`📊 Vendas sem acesso de ${recentSales?.length || 0} verificadas: ${problemSales}`)
    if (problemSales > 0) {
        console.log(`📧 Emails únicos afetados: ${problemEmails.size}`)
        console.log(`\n💡 RECOMENDAÇÕES:`)
        console.log(`1. Execute fix-currency-access.js --auto-fix para corrigir acessos pendentes`)
        console.log(`2. Considere melhorar a lógica de deduplicação no frontend`)
        console.log(`3. Implemente alertas para detectar inconsistências em tempo real`)
    }
}

async function main() {
    const args = process.argv.slice(2)

    if (args.length === 0) {
        console.log('❓ DIAGNÓSTICO DE FILTRO E DEDUPLICAÇÃO')
        console.log('')
        console.log('Uso:')
        console.log('  node scripts/diagnose-filter-issue.js --email=customer@email.com')
        console.log('  node scripts/diagnose-filter-issue.js --report')
        console.log('')
        console.log('Este script verifica problemas causados pelo filtro "Todos"')
        console.log('e pela deduplicação de emails no frontend.')
        process.exit(0)
    }

    const emailArg = args.find(arg => arg.startsWith('--email='))
    const reportFlag = args.includes('--report')

    if (emailArg) {
        const email = emailArg.split('=')[1]
        await diagnoseFilterDeduplication(email)
    } else if (reportFlag) {
        await reportFilterIssues()
    }

    console.log('\n✅ Diagnóstico concluído!')
}

main().catch(console.error)