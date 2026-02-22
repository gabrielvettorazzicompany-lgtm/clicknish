import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-action',
}

interface PurchaseData {
    id: string
    product_id: string
    user_id: string
    payment_id: string
    created_at: string
    purchase_type: 'marketplace' | 'product'
    product_name?: string
    product_image?: string
}

serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const body = await req.json()
        const { token, purchaseId, action } = body

        // Determine action from body or header
        const resolvedAction = action || req.headers.get('x-action') || 'validate'



        if (!token || !purchaseId) {
            return new Response(
                JSON.stringify({ error: 'Missing token or purchaseId' }),
                {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
            )
        }

        // Increment view count
        if (resolvedAction === 'increment-view') {
            const { data: incrementResult, error: incrementError } = await supabase.rpc(
                'increment_thankyou_view',
                {
                    p_token: token,
                    p_purchase_id: purchaseId
                }
            )

            if (incrementError) {
                console.error('Increment error:', incrementError)
                return new Response(
                    JSON.stringify({ error: 'Failed to increment view' }),
                    {
                        status: 500,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    }
                )
            }

            return new Response(
                JSON.stringify({ success: incrementResult }),
                {
                    status: 200,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
            )
        }

        // Default action: validate


        const { data: validationData, error: validationError } = await supabase.rpc(
            'validate_thankyou_access',
            {
                p_token: token,
                p_purchase_id: purchaseId
            }
        )

        if (validationError) {
            console.error('❌ Validation RPC error:', validationError)
            return new Response(
                JSON.stringify({ error: 'Validation failed', details: validationError.message }),
                {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
            )
        }



        if (!validationData || validationData.length === 0) {
            return new Response(
                JSON.stringify({
                    valid: false,
                    error: 'INVALID_TOKEN',
                    message: 'Invalid or expired access token'
                }),
                {
                    status: 403,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
            )
        }

        const validation = validationData[0]

        if (!validation.is_valid) {
            return new Response(
                JSON.stringify({
                    valid: false,
                    error: validation.error_code,
                    message: getErrorMessage(validation.error_code)
                }),
                {
                    status: 403,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
            )
        }

        // Fetch purchase data
        const purchaseData = await fetchPurchaseData(
            supabase,
            purchaseId,
            validation.purchase_type
        )

        if (!purchaseData) {
            console.error('❌ Purchase not found for:', purchaseId, 'type:', validation.purchase_type)
            return new Response(
                JSON.stringify({ error: 'Purchase not found' }),
                {
                    status: 404,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
            )
        }



        return new Response(
            JSON.stringify({
                valid: true,
                viewsRemaining: validation.views_remaining,
                expiresAt: validation.expires_at,
                purchase: purchaseData
            }),
            {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )

    } catch (error) {
        console.error('❌ Error:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )
    }
})

// Helper function to fetch purchase data
async function fetchPurchaseData(
    supabase: any,
    purchaseId: string,
    purchaseType: string
): Promise<PurchaseData | null> {
    try {
        // All purchases are now in user_product_access
        const { data, error } = await supabase
            .from('user_product_access')
            .select(`
                id,
                product_id,
                member_area_id,
                application_id,
                user_id,
                payment_id,
                created_at
            `)
            .eq('id', purchaseId)
            .single()

        if (error) throw error

        // Determine product name based on type
        let productName: string | undefined
        let productImage: string | undefined
        const resolvedPurchaseType = purchaseType || (data.member_area_id ? 'marketplace' : 'product')

        if (data.member_area_id) {
            const { data: memberArea } = await supabase
                .from('member_areas')
                .select('name, image_url')
                .eq('id', data.member_area_id)
                .single()
            productName = memberArea?.name
            productImage = memberArea?.image_url
        } else if (data.application_id) {
            const { data: app } = await supabase
                .from('applications')
                .select('name')
                .eq('id', data.application_id)
                .single()
            productName = app?.name
        }

        return {
            id: data.id,
            product_id: data.product_id || data.member_area_id || data.application_id,
            user_id: data.user_id,
            payment_id: data.payment_id,
            created_at: data.created_at,
            purchase_type: resolvedPurchaseType as 'marketplace' | 'product',
            product_name: productName,
            product_image: productImage
        }
    } catch (error) {
        console.error('Error fetching purchase data:', error)
        return null
    }
}

// Helper function to get error messages
function getErrorMessage(errorCode: string): string {
    const messages: Record<string, string> = {
        'INVALID_TOKEN': 'Invalid or expired access token',
        'TOKEN_EXPIRED': 'This link has expired',
        'MAX_VIEWS_EXCEEDED': 'Maximum number of views exceeded'
    }
    return messages[errorCode] || 'Access denied'
}
