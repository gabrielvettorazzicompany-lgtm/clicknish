import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hotmart-hottok, x-user-id',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Function to process Hotmart webhook
async function processHotmartWebhook(data: any) {
    try {
        const event = data.event
        const purchase = data.data?.purchase || data.data?.subscription || {}

        // Extract buyer information
        const buyerEmail = purchase.buyer?.email || data.data?.buyer?.email
        const buyerName = purchase.buyer?.name || data.data?.buyer?.name
        const productName = purchase.product?.name || data.data?.product?.name
        const productId = purchase.product?.id || data.data?.product?.id
        const transactionId = purchase.transaction || data.id
        const status = purchase.status?.toLowerCase() || 'approved'

        if (!buyerEmail) {
            console.error('❌ Buyer email not found in webhook')
            return { error: 'Email not found' }
        }

        // Events that grant access
        const approvedEvents = ['PURCHASE_APPROVED', 'PURCHASE_COMPLETE', 'SUBSCRIPTION_PAYMENT_APPROVED']

        if (approvedEvents.includes(event)) {
            // Here you need to map the Hotmart product_id to your system's application_id
            // For now, let's fetch the first app (you should implement a real mapping)
            const { data: apps } = await supabase
                .from('applications')
                .select('id')
                .limit(1)

            if (!apps || apps.length === 0) {
                console.error('❌ No application found')
                return { error: 'No application found' }
            }

            const applicationId = apps[0].id

            // Check if the user already exists
            const { data: existingUser } = await supabase
                .from('app_users')
                .select('*')
                .eq('application_id', applicationId)
                .eq('email', buyerEmail)
                .single()

            if (existingUser) {
                return { success: true, message: 'User already exists', user_id: existingUser.id }
            }

            // Create new user
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
                console.error('❌ Error creating user:', userError)
                throw userError
            }

            // Record the transaction
            const { error: transactionError } = await supabase
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

            if (transactionError) {
                console.warn('⚠️ Error recording transaction:', transactionError)
            }

            return {
                success: true,
                message: 'User created and access granted',
                user_id: newUser.id,
                email: buyerEmail
            }
        }

        // Cancellation/refund events
        const cancelEvents = ['PURCHASE_CANCELED', 'PURCHASE_REFUNDED', 'SUBSCRIPTION_CANCELED']

        if (cancelEvents.includes(event)) {
            // Here you can implement logic to remove access
            // For example, mark the user as inactive or delete

            return { success: true, message: 'Cancellation processed' }
        }

        return { success: true, message: 'Event not processed but received' }

    } catch (error) {
        console.error('❌ Error processing Hotmart webhook:', error)
        throw error
    }
}

// Function to process other webhooks (Eduzz, Kiwify, etc.)
async function processGenericWebhook(platform: string, data: any) {
    // Implement specific logic for each platform
    // For now, just record the webhook

    return {
        success: true,
        message: `${platform} webhook received`,
        data: data
    }
}

Deno.serve(async (req) => {
    const url = new URL(req.url)
    const pathSegments = url.pathname.split('/').filter(Boolean)

    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // POST /webhooks/:platform
        if (req.method === 'POST' && pathSegments.length >= 2 && pathSegments[0] === 'webhooks') {
            const platform = pathSegments[1].toLowerCase()
            const body = await req.json()

            let result

            switch (platform) {
                case 'hotmart':
                    result = await processHotmartWebhook(body)
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

    } catch (error) {
        console.error('❌ Webhook error:', error)
        return new Response(JSON.stringify({
            error: error.message,
            timestamp: new Date().toISOString()
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
