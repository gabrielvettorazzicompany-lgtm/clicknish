// @ts-nocheck
import { createClient } from '../lib/supabase'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hotmart-hottok, x-user-id',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
}

export async function handleWebhooks(request: Request, env: any, pathSegments: string[]): Promise<Response> {
    if (request.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

        // POST /api/webhooks/:platform
        if (request.method === 'POST' && pathSegments.length >= 1) {
            const platform = pathSegments[0].toLowerCase()
            const body = await request.json()

            let result

            switch (platform) {
                case 'hotmart':
                    result = await processHotmartWebhook(supabase, body)
                    break

                case 'cartpanda':
                case 'yampi':
                    result = await processGenericWebhook(platform, body)
                    break

                default:
                    return new Response(JSON.stringify({
                        error: 'Platform not supported',
                        supportedPlatforms: ['hotmart', 'cartpanda', 'yampi']
                    }), {
                        status: 400,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    })
            }

            return new Response(JSON.stringify(result), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        return new Response(JSON.stringify({ error: 'Not Found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error: any) {
        console.error('Webhook error:', error)
        return new Response(JSON.stringify({
            error: error.message,
            timestamp: new Date().toISOString()
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
}

async function processHotmartWebhook(supabase: any, data: any) {
    try {
        const event = data.event
        const purchase = data.data?.purchase || data.data?.subscription || {}

        const buyerEmail = purchase.buyer?.email || data.data?.buyer?.email
        const buyerName = purchase.buyer?.name || data.data?.buyer?.name
        const productName = purchase.product?.name || data.data?.product?.name
        const productId = purchase.product?.id || data.data?.product?.id
        const transactionId = purchase.transaction || data.id
        const status = purchase.status?.toLowerCase() || 'approved'

        if (!buyerEmail) {
            return { error: 'Email not found' }
        }

        const approvedEvents = ['PURCHASE_APPROVED', 'PURCHASE_COMPLETE', 'SUBSCRIPTION_PAYMENT_APPROVED']

        if (approvedEvents.includes(event)) {
            const { data: apps } = await supabase
                .from('applications')
                .select('id')
                .limit(1)

            if (!apps || apps.length === 0) {
                return { error: 'No application found' }
            }

            const applicationId = apps[0].id

            const { data: existingUser } = await supabase
                .from('app_users')
                .select('*')
                .eq('application_id', applicationId)
                .eq('email', buyerEmail)
                .single()

            if (existingUser) {
                return { success: true, message: 'User already exists', user_id: existingUser.id }
            }

            const { data: newUser, error: userError } = await supabase
                .from('app_users')
                .insert({
                    application_id: applicationId,
                    email: buyerEmail,
                    full_name: buyerName || null,
                    user_id: `user_${Date.now()}_${buyerEmail.split('@')[0]}`
                })
                .select()
                .single()

            if (userError) {
                throw userError
            }

            await supabase
                .from('transactions')
                .insert({
                    application_id: applicationId,
                    user_id: newUser.id,
                    platform: 'hotmart',
                    transaction_id: transactionId,
                    product_name: productName,
                    product_id: productId,
                    buyer_email: buyerEmail,
                    buyer_name: buyerName,
                    status: status,
                    webhook_data: data
                })

            return {
                success: true,
                message: 'User created and access granted',
                user_id: newUser.id,
                email: buyerEmail
            }
        }

        const cancelEvents = ['PURCHASE_CANCELED', 'PURCHASE_REFUNDED', 'SUBSCRIPTION_CANCELED']

        if (cancelEvents.includes(event)) {
            return { success: true, message: 'Cancellation processed' }
        }

        return { success: true, message: 'Event not processed but received' }

    } catch (error) {
        console.error('Error processing Hotmart webhook:', error)
        throw error
    }
}

async function processGenericWebhook(platform: string, data: any) {
    return {
        success: true,
        message: `${platform} webhook received`,
        data: data
    }
}
