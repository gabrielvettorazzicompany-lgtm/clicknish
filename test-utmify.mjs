/**
 * Script de teste da integração UTMify
 * Uso: SUPABASE_SERVICE_ROLE_KEY=<key> node test-utmify.mjs [userId]
 */

const SUPABASE_URL = 'https://cgeqtodbisgwvhkaahiy.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY


if (!SERVICE_ROLE_KEY) {
    console.error('❌ Faltando SUPABASE_SERVICE_ROLE_KEY')
    console.error('   Use: SUPABASE_SERVICE_ROLE_KEY=<sua_key> node test-utmify.mjs')
    process.exit(1)
}

const filterUserId = process.argv[2] || null

async function supabaseGet(table, filters = '') {
    const url = `${SUPABASE_URL}/rest/v1/${table}?${filters}`
    const res = await fetch(url, {
        headers: {
            'apikey': SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
        }
    })
    if (!res.ok) throw new Error(`Supabase error ${res.status}: ${await res.text()}`)
    return res.json()
}

async function main() {
    console.log('🔍 Buscando integrações UTMify ativas...\n')

    // Buscar integrações ativas
    const filter = filterUserId
        ? `is_active=eq.true&user_id=eq.${filterUserId}`
        : `is_active=eq.true`

    const integrations = await supabaseGet('utmify_integrations', filter)

    if (!integrations.length) {
        console.log('⚠️  Nenhuma integração UTMify ativa encontrada.')
        if (!filterUserId) console.log('   Passe um userId como argumento para filtrar por usuário.')
        return
    }

    console.log(`✅ ${integrations.length} integração(ões) encontrada(s):\n`)
    for (const i of integrations) {
        console.log(`  • ${i.name || i.id} | eventos: ${(i.events || []).join(', ')} | token: ${i.api_token?.slice(0, 8)}...`)
    }

    // Payload de teste
    const testOrderId = `TEST_${Date.now()}`
    const testBody = {
        orderId: testOrderId,
        platform: 'Clicknich',
        paymentMethod: 'credit_card',
        status: 'paid',
        createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
        approvedDate: new Date().toISOString().replace('T', ' ').substring(0, 19),
        refundedAt: null,
        customer: {
            name: 'Teste UTMify',
            email: 'teste@clicknich.com',
            phone: null,
            document: null,
        },
        products: [{
            id: 'test-product-id',
            name: 'Produto Teste',
            planId: null,
            planName: null,
            quantity: 1,
            priceInCents: 9700,
        }],
        trackingParameters: {
            src: 'test',
            sck: null,
            utm_source: 'test',
            utm_campaign: 'test_clicknich',
            utm_medium: null,
            utm_content: null,
            utm_term: null,
        },
        commission: {
            totalPriceInCents: 9700,
            gatewayFeeInCents: 311,
            userCommissionInCents: 9389,
            currency: 'BRL',
        },
        isTest: true,
    }

    console.log(`\n📤 Disparando evento "paid" de teste (orderId: ${testOrderId})...\n`)

    for (const integration of integrations) {
        if (!(integration.events || []).includes('paid')) {
            console.log(`  ⚠️  [${integration.name || integration.id}] não tem evento "paid" configurado — pulando`)
            continue
        }

        process.stdout.write(`  📡 [${integration.name || integration.id}] enviando... `)

        try {
            const res = await fetch('https://api.utmify.com.br/api-credentials/orders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-token': integration.api_token,
                },
                body: JSON.stringify(testBody),
            })

            const body = await res.text()
            if (res.ok) {
                console.log(`✅ OK (${res.status}) → ${body}`)
            } else {
                console.log(`❌ FALHOU (${res.status}) → ${body}`)
            }
        } catch (e) {
            console.log(`❌ ERRO → ${e.message}`)
        }
    }

    console.log('\nTeste concluído.')
}

main().catch(e => {
    console.error('Erro fatal:', e)
    process.exit(1)
})
