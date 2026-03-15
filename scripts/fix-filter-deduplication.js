/**
 * Script de Correção - Problema do Filtro "Todos"
 * 
 * Corrige inconsistências causadas pela deduplicação de emails
 * quando o filtro está configurado como "Todos".
 * 
 * Como usar:
 * node scripts/fix-filter-deduplication.js --report
 * node scripts/fix-filter-deduplication.js --email=customer@email.com
 * node scripts/fix-filter-deduplication.js --auto-fix
 */

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://cgeqtodbisgwvhkaahiy.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Modo demo para demonstração
const isDemoMode = process.argv.includes('--demo') || !SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_SERVICE_ROLE_KEY && !isDemoMode) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY is required')
    console.error('💡 Use --demo para simular correção sem credenciais')
    process.exit(1)
}

const supabase = isDemoMode ? null : createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
})

const DRY_RUN = process.argv.includes('--dry-run')
const logPrefix = DRY_RUN ? '[DRY RUN]' : '[FIXING]'

async function runDemoFix() {
    console.log('🔧 DEMONSTRAÇÃO: Correção do Filtro "Todos"')
    console.log('='.repeat(60))

    console.log('💡 Este script corrigiria os seguintes problemas:')
    console.log()

    console.log('📧 PROBLEMA ATUAL:')
    console.log('1. Cliente tem user_ids em múltiplas apps')
    console.log('2. Filtro "Todos" deduplica por email')
    console.log('3. Escolhe o user_id mais recente')
    console.log('4. Email enviado com loginUrl da app errada')
    console.log()

    console.log('🔧 CORREÇÃO APLICADA:')
    console.log('✅ 1. Consolidar user_ids duplicados')
    console.log('✅ 2. Migrar acessos órfãos para user_id principal')
    console.log('✅ 3. Atualizar app_users para apontar pro mesmo user_id')
    console.log('✅ 4. Garantir customer_auth existe')
    console.log()

    console.log('📊 RESULTADO ESPERADO:')
    console.log('• 🎯 1 user_id por cliente (unificado)')
    console.log('• 📧 Emails enviados com loginUrl correto')
    console.log('• 🔐 Todos os acessos vinculados ao user_id principal')
    console.log('• ⚡ Frontend mostra dados consistentes')
    console.log()

    console.log('🚨 AVISO: Esta correção consolidaria dados no banco!')
    console.log('💾 Fazer backup antes de executar em produção')
    console.log()

    console.log('📝 Para executar a correção real:')
    console.log('1. Configure SUPABASE_SERVICE_ROLE_KEY')
    console.log('2. Execute: node scripts/fix-filter-deduplication.js --auto-fix')
    console.log('3. Ou teste primeiro: node scripts/fix-filter-deduplication.js --dry-run --auto-fix')

    return { demo: true, message: 'Demonstração concluída' }
}

async function fixDeduplicationIssues(customerEmail) {
    if (isDemoMode) {
        console.log('❌ Modo demo não suporta correção de cliente específico')
        console.log('💡 Use --demo para ver demonstração geral')
        return
    }

    console.log(`\n${logPrefix} CORRIGINDO PROBLEMAS DE DEDUPLICAÇÃO: ${customerEmail}`)
    console.log('='.repeat(60))

    // 1. Buscar todos os app_users para este email
    const { data: appUsers } = await supabase
        .from('app_users')
        .select('*')
        .eq('email', customerEmail)
        .order('created_at', { ascending: false })

    if (!appUsers || appUsers.length <= 1) {
        console.log('✅ Email não está duplicado entre apps')
        return { fixed: false, reason: 'No duplication' }
    }

    console.log(`📊 Encontrados ${appUsers.length} registros app_users:`)
    appUsers.forEach((user, index) => {
        console.log(`  ${index + 1}. App: ${user.application_id}, User ID: ${user.user_id}`)
    })

    // 2. Verificar customer_auth
    const { data: customerAuth } = await supabase
        .from('customer_auth')
        .select('id, email')
        .eq('email', customerEmail)
        .maybeSingle()

    if (!customerAuth) {
        console.log('❌ customer_auth não encontrado - criando...')

        if (!DRY_RUN) {
            // Criar customer_auth usando o user_id da app mais recente
            const primaryUserId = appUsers[0].user_id
            const { data: newAuth, error } = await supabase.auth.admin.createUser({
                id: primaryUserId,  // Usar o mesmo ID
                email: customerEmail,
                email_confirm: true,
                user_metadata: {
                    full_name: appUsers[0].full_name || '',
                    phone: appUsers[0].phone || '',
                    created_via: 'dedup_fix'
                }
            })

            if (error && error.message !== 'A user with this email address has already been registered') {
                console.error(`❌ Erro ao criar customer_auth:`, error.message)
                return { fixed: false, reason: 'Auth creation failed' }
            }
            console.log(`✅ customer_auth criado com ID: ${primaryUserId}`)
        } else {
            console.log(`[DRY RUN] Criaria customer_auth com ID: ${appUsers[0].user_id}`)
        }
    } else {
        console.log(`🔑 customer_auth encontrado: ${customerAuth.id}`)
    }

    // 3. Verificar acessos órfãos
    let totalFixed = 0
    const targetUserId = customerAuth?.id || appUsers[0].user_id

    for (const user of appUsers) {
        if (user.user_id === targetUserId) continue

        // Verificar se este user_id tem acessos
        const { data: orphanAccess } = await supabase
            .from('user_product_access')
            .select('*')
            .eq('user_id', user.user_id)

        if (orphanAccess && orphanAccess.length > 0) {
            console.log(`\n🔄 Migrating ${orphanAccess.length} access records from ${user.user_id} → ${targetUserId}`)

            if (!DRY_RUN) {
                for (const access of orphanAccess) {
                    // Tentar migrar acesso para o user_id correto
                    const { error } = await supabase
                        .from('user_product_access')
                        .upsert({
                            ...access,
                            id: undefined,  // Remover ID para criar novo
                            user_id: targetUserId
                        }, {
                            onConflict: 'user_id,product_id',
                            ignoreDuplicates: true  // Não substituir se já existe
                        })

                    if (error) {
                        console.log(`⚠️  Não foi possível migrar ${access.product_id}: ${error.message}`)
                    } else {
                        // Deletar o acesso órfão apenas se migração foi bem-sucedida
                        await supabase
                            .from('user_product_access')
                            .delete()
                            .eq('id', access.id)

                        totalFixed++
                        console.log(`  ✅ Produto ${access.product_id} migrado`)
                    }
                }
            } else {
                totalFixed += orphanAccess.length
                console.log(`[DRY RUN] Migraria ${orphanAccess.length} acessos`)
            }
        }
    }

    // 4. Consolidar app_users para apontar para o mesmo user_id
    if (!DRY_RUN && customerAuth) {
        for (const user of appUsers) {
            if (user.user_id !== customerAuth.id) {
                await supabase
                    .from('app_users')
                    .update({ user_id: customerAuth.id })
                    .eq('id', user.id)
                console.log(`🔄 app_user ${user.id} atualizado para user_id: ${customerAuth.id}`)
            }
        }
    }

    console.log(`\n📊 RESULTADO: ${totalFixed} acessos corrigidos`)
    return { fixed: totalFixed > 0, totalFixed }
}

async function reportDeduplicationProblems() {
    console.log('📊 RELATÓRIO DE PROBLEMAS DE DEDUPLICAÇÃO')
    console.log('='.repeat(60))

    // Buscar emails duplicados nas últimas 2 semanas
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

    const { data: appUsers } = await supabase
        .from('app_users')
        .select('email, user_id, application_id, created_at')
        .gte('created_at', twoWeeksAgo)

    // Agrupar por email
    const emailGroups = {}
    appUsers?.forEach(user => {
        if (!emailGroups[user.email]) emailGroups[user.email] = []
        emailGroups[user.email].push(user)
    })

    // Filtrar emails com múltiplas entradas
    const duplicatedEmails = Object.entries(emailGroups)
        .filter(([email, users]) => users.length > 1)
        .map(([email, users]) => ({ email, users, count: users.length }))
        .sort((a, b) => b.count - a.count)

    console.log(`📊 Emails com múltiplos app_users (últimas 2 semanas): ${duplicatedEmails.length}`)

    if (duplicatedEmails.length === 0) {
        console.log('✅ Nenhum problema de deduplicação encontrado!')
        return
    }

    // Verificar quantos têm problemas reais
    let problemEmails = 0
    console.log('\n🔍 Analisando problemas reais...')

    for (const { email, users } of duplicatedEmails.slice(0, 10)) {
        // Verificar se há acessos órfãos
        const userIds = users.map(u => u.user_id)
        let hasOrphans = false

        for (const userId of userIds) {
            const { count } = await supabase
                .from('user_product_access')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', userId)

            if (count > 0) {
                hasOrphans = true
                break
            }
        }

        if (hasOrphans) {
            problemEmails++
            console.log(`  ❌ ${email} (${users.length} apps, tem acessos)`)
        } else {
            console.log(`  ⚠️  ${email} (${users.length} apps, sem acessos ainda)`)
        }
    }

    console.log(`\n🚨 Emails com problemas REAIS: ${problemEmails}`)

    if (problemEmails > 0) {
        console.log('\n💡 RECOMENDAÇÕES:')
        console.log('1. Execute: node scripts/fix-filter-deduplication.js --auto-fix')
        console.log('2. Considere implementar validação ANTES da duplicação acontecer')
        console.log('3. Melhore a lógica do filtro "Todos" para evitar confusão visual')
    }
}

async function autoFixAllIssues() {
    console.log(`\n${logPrefix} AUTO-CORREÇÃO DE PROBLEMAS DE DEDUPLICAÇÃO`)
    console.log('='.repeat(60))

    // Buscar todos os emails duplicados
    const { data: appUsers } = await supabase
        .from('app_users')
        .select('email')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

    const emailCounts = {}
    appUsers?.forEach(user => {
        emailCounts[user.email] = (emailCounts[user.email] || 0) + 1
    })

    const duplicatedEmails = Object.entries(emailCounts)
        .filter(([email, count]) => count > 1)
        .map(([email, count]) => email)

    console.log(`📊 Emails duplicados encontrados: ${duplicatedEmails.length}`)

    if (duplicatedEmails.length === 0) {
        console.log('✅ Nenhuma correção necessária!')
        return
    }

    let totalFixed = 0

    for (const email of duplicatedEmails) {
        console.log(`\n--- Processando: ${email} ---`)
        const result = await fixDeduplicationIssues(email)
        if (result.fixed) {
            totalFixed += result.totalFixed || 1
        }
    }

    console.log(`\n✅ AUTO-CORREÇÃO CONCLUÍDA!`)
    console.log(`📊 Total de acessos corrigidos: ${totalFixed}`)
}

async function main() {
    const args = process.argv.slice(2)

    if (args.length === 0) {
        console.log('❓ CORREÇÃO DE PROBLEMAS DE DEDUPLICAÇÃO')
        console.log('')
        console.log('Este script corrige problemas causados pelo filtro "Todos"')
        console.log('que faz deduplicação e pode causar inconsistências.')
        console.log('')
        console.log('Uso:')
        console.log('  node scripts/fix-filter-deduplication.js --report                    # Relatório (requer credenciais)')
        console.log('  node scripts/fix-filter-deduplication.js --demo                     # Demonstração')
        console.log('  node scripts/fix-filter-deduplication.js --email=customer@email.com # Cliente específico')
        console.log('  node scripts/fix-filter-deduplication.js --auto-fix                 # Correção automática')
        console.log('')
        console.log('Flags:')
        console.log('  --dry-run    Simula as correções sem aplicar')
        console.log('  --demo       Modo demonstração sem credenciais')
        process.exit(0)
    }

    if (DRY_RUN) {
        console.log('🔍 MODO DRY RUN - Simulação de correções')
        console.log('')
    }

    const emailArg = args.find(arg => arg.startsWith('--email='))
    const reportFlag = args.includes('--report')
    const autoFixFlag = args.includes('--auto-fix')
    const demoFlag = args.includes('--demo')

    if (demoFlag || isDemoMode) {
        await runDemoFix()
    } else if (emailArg) {
        const email = emailArg.split('=')[1]
        await fixDeduplicationIssues(email)
    } else if (reportFlag) {
        if (isDemoMode) {
            console.log('❌ Modo demo não suporta relatórios')
            console.log('💡 Configure SUPABASE_SERVICE_ROLE_KEY para funcionalidade completa')
            return
        }
        await reportDeduplicationProblems()
    } else if (autoFixFlag) {
        if (isDemoMode) {
            console.log('❌ Modo demo não suporta correção automática')
            console.log('💡 Configure SUPABASE_SERVICE_ROLE_KEY para funcionalidade completa')
            return
        }
        await autoFixAllIssues()
    }

    console.log('\n✅ Processo concluído!')
}

main().catch(console.error)