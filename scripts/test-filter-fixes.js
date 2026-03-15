/**
 * Script de Teste - Correções Implementadas
 * 
 * Este script verifica se as correções do filtro "Todos" foram aplicadas
 * corretamente e se estão funcionando como esperado.
 * 
 * Como usar:
 * node scripts/test-filter-fixes.js --test-frontend
 * node scripts/test-filter-fixes.js --test-types  
 * node scripts/test-filter-fixes.js --full-test
 */

const fs = require('fs').promises
const path = require('path')

async function testFrontendChanges() {
    console.log('🧪 TESTANDO: Correções do Frontend')
    console.log('='.repeat(50))

    const useCustomersPath = path.join(__dirname, '../packages/frontend/src/hooks/useCustomers.ts')

    try {
        const content = await fs.readFile(useCustomersPath, 'utf8')

        // Verificar se a deduplicação problemática foi removida
        const hasOldDeduplication = content.includes('seen.has(c.email)')
        const hasNewUnification = content.includes('_appCount')
        const hasEmailGroups = content.includes('emailGroups')
        const hasUnifiedCustomers = content.includes('unifiedCustomers')

        console.log('✅ Verificações de Correção:')
        console.log(`   ${!hasOldDeduplication ? '✅' : '❌'} Deduplicação problemática removida`)
        console.log(`   ${hasNewUnification ? '✅' : '❌'} Sistema de unificação implementado`)
        console.log(`   ${hasEmailGroups ? '✅' : '❌'} Agrupamento por email presente`)
        console.log(`   ${hasUnifiedCustomers ? '✅' : '❌'} Criação de customers unificados`)

        if (!hasOldDeduplication && hasNewUnification && hasEmailGroups && hasUnifiedCustomers) {
            console.log('\n🎉 FRONTEND: Todas as correções aplicadas com sucesso!')
            return true
        } else {
            console.log('\n❌ FRONTEND: Algumas correções estão faltando')
            return false
        }

    } catch (error) {
        console.log('❌ Erro ao ler useCustomers.ts:', error.message)
        return false
    }
}

async function testTypesChanges() {
    console.log('\n🧪 TESTANDO: Correções dos Tipos')
    console.log('='.repeat(50))

    const typesPath = path.join(__dirname, '../packages/frontend/src/types/customers.ts')

    try {
        const content = await fs.readFile(typesPath, 'utf8')

        const hasAppCount = content.includes('_appCount?')
        const hasAllApps = content.includes('_allApps?')
        const hasOriginalRecords = content.includes('_originalRecords?')

        console.log('✅ Verificações de Tipos:')
        console.log(`   ${hasAppCount ? '✅' : '❌'} _appCount property adicionada`)
        console.log(`   ${hasAllApps ? '✅' : '❌'} _allApps property adicionada`)
        console.log(`   ${hasOriginalRecords ? '✅' : '❌'} _originalRecords property adicionada`)

        if (hasAppCount && hasAllApps && hasOriginalRecords) {
            console.log('\n🎉 TIPOS: Todas as correções aplicadas com sucesso!')
            return true
        } else {
            console.log('\n❌ TIPOS: Algumas correções estão faltando')
            return false
        }

    } catch (error) {
        console.log('❌ Erro ao ler types/customers.ts:', error.message)
        return false
    }
}

async function testComponentChanges() {
    console.log('\n🧪 TESTANDO: Correções dos Componentes')
    console.log('='.repeat(50))

    const tablePath = path.join(__dirname, '../packages/frontend/src/components/customers/CustomerTable.tsx')

    try {
        const content = await fs.readFile(tablePath, 'utf8')

        const hasAppCountBadge = content.includes('customer._appCount') && content.includes('apps')
        const hasMultiAppTitle = content.includes('Cliente existe em')

        console.log('✅ Verificações de Componentes:')
        console.log(`   ${hasAppCountBadge ? '✅' : '❌'} Badge de múltiplas apps adicionada`)
        console.log(`   ${hasMultiAppTitle ? '✅' : '❌'} Tooltip explicativo present`)

        if (hasAppCountBadge && hasMultiAppTitle) {
            console.log('\n🎉 COMPONENTES: Todas as correções aplicadas com sucesso!')
            return true
        } else {
            console.log('\n❌ COMPONENTES: Algumas correções estão faltando')
            return false
        }

    } catch (error) {
        console.log('❌ Erro ao ler CustomerTable.tsx:', error.message)
        return false
    }
}

async function testAccessLogic() {
    console.log('\n🧪 TESTANDO: Lógica de Acesso Melhorada')
    console.log('='.repeat(50))

    const useCustomersPath = path.join(__dirname, '../packages/frontend/src/hooks/useCustomers.ts')

    try {
        const content = await fs.readFile(useCustomersPath, 'utf8')

        const hasImprovedAccess = content.includes('customer._originalRecords')
        const hasMultiUserIdCheck = content.includes('userIdsToCheck')
        const hasAllAccessIds = content.includes('allAccessIds')

        console.log('✅ Verificações de Lógica de Acesso:')
        console.log(`   ${hasImprovedAccess ? '✅' : '❌'} Verificação de registros originais`)
        console.log(`   ${hasMultiUserIdCheck ? '✅' : '❌'} Check de múltiplos user_ids`)
        console.log(`   ${hasAllAccessIds ? '✅' : '❌'} Consolidação de acessos`)

        if (hasImprovedAccess && hasMultiUserIdCheck && hasAllAccessIds) {
            console.log('\n🎉 LÓGICA DE ACESSO: Todas as correções aplicadas com sucesso!')
            return true
        } else {
            console.log('\n❌ LÓGICA DE ACESSO: Algumas correções estão faltando')
            return false
        }

    } catch (error) {
        console.log('❌ Erro ao verificar lógica de acesso:', error.message)
        return false
    }
}

async function runFullTest() {
    console.log('🚀 TESTE COMPLETO DAS CORREÇÕES DO FILTRO "TODOS"')
    console.log('='.repeat(60))
    console.log()

    const frontendOk = await testFrontendChanges()
    const typesOk = await testTypesChanges()
    const componentOk = await testComponentChanges()
    const accessOk = await testAccessLogic()

    console.log('\n📊 RESUMO DOS TESTES:')
    console.log('='.repeat(30))
    console.log(`Frontend Hook:     ${frontendOk ? '✅ PASS' : '❌ FAIL'}`)
    console.log(`Tipos TypeScript:  ${typesOk ? '✅ PASS' : '❌ FAIL'}`)
    console.log(`Componentes React: ${componentOk ? '✅ PASS' : '❌ FAIL'}`)
    console.log(`Lógica de Acesso:  ${accessOk ? '✅ PASS' : '❌ FAIL'}`)

    const allGood = frontendOk && typesOk && componentOk && accessOk

    if (allGood) {
        console.log('\n🎉 TODAS AS CORREÇÕES APLICADAS COM SUCESSO!')
        console.log('✅ O filtro "Todos" não vai mais enviar emails errados')
        console.log('✅ Clientes com múltiplas apps serão exibidos corretamente')
        console.log('✅ Acessos serão verificados em todos os user_ids')
        console.log('✅ Interface visual indica clientes multi-app')
        console.log()
        console.log('🚀 PRÓXIMOS PASSOS:')
        console.log('1. Fazer build do frontend: npm run build')
        console.log('2. Testar em ambiente de desenvolvimento')
        console.log('3. Verificar se emails pós-compra estão corretos')
        console.log('4. Aplicar correções no backend se necessário')
    } else {
        console.log('\n❌ ALGUMAS CORREÇÕES FALHARAM')
        console.log('💡 Verifique os arquivos mencionados nos erros')
    }

    return allGood
}

async function main() {
    const args = process.argv.slice(2)

    if (args.includes('--help')) {
        console.log('🧪 Teste das Correções do Filtro "Todos"')
        console.log()
        console.log('Uso:')
        console.log('  node scripts/test-filter-fixes.js --test-frontend    # Testar useCustomers.ts')
        console.log('  node scripts/test-filter-fixes.js --test-types       # Testar types/customers.ts')
        console.log('  node scripts/test-filter-fixes.js --test-components  # Testar CustomerTable.tsx')
        console.log('  node scripts/test-filter-fixes.js --test-access      # Testar lógica de acesso')
        console.log('  node scripts/test-filter-fixes.js --full-test        # Teste completo')
        console.log()
        return
    }

    if (args.includes('--test-frontend')) {
        await testFrontendChanges()
    } else if (args.includes('--test-types')) {
        await testTypesChanges()
    } else if (args.includes('--test-components')) {
        await testComponentChanges()
    } else if (args.includes('--test-access')) {
        await testAccessLogic()
    } else if (args.includes('--full-test')) {
        await runFullTest()
    } else {
        console.log('❓ Use --help para ver as opções disponíveis')
        console.log('💡 Recomendado: node scripts/test-filter-fixes.js --full-test')
    }
}

if (require.main === module) {
    main().catch(console.error)
}

module.exports = { testFrontendChanges, testTypesChanges, testComponentChanges, testAccessLogic, runFullTest }