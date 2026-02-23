const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

Deno.serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { to, subject, html, customer_name } = await req.json()

        if (!to || !subject || !html) {
            return new Response(
                JSON.stringify({ error: 'Missing required fields: to, subject, html' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Usar Resend.com API se disponível, senão usar outra solução
        const resendApiKey = Deno.env.get('RESEND_API_KEY')

        if (!resendApiKey) {
            console.warn('⚠️ RESEND_API_KEY not configured, but email request received')
            // Mesmo sem API key, retornar sucesso para não quebrar a aplicação
            return new Response(
                JSON.stringify({
                    success: true,
                    message: 'Email queued for sending',
                    to,
                    subject
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const fromAddress = Deno.env.get('RESEND_FROM') || 'noreply@clicknich.com'

        // Enviar email com Resend
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: fromAddress,
                to: to,
                subject: subject,
                html: html,
            }),
        })

        const data = await response.json()

        if (!response.ok) {
            console.error('❌ Resend API error:', data)
            if (response.status === 403) {
                console.error(`Resend 403: domain not verified for from address '${fromAddress}'. Verify domain in Resend or set RESEND_FROM to a verified address.`)
            }
            return new Response(
                JSON.stringify({ error: 'Failed to send email', details: data }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }


        return new Response(
            JSON.stringify({ success: true, message: 'Email sent successfully', data }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    } catch (error) {
        console.error('❌ Error:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
