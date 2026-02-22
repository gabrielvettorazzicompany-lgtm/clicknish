import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'



const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

Deno.serve(async (req) => {
    const url = new URL(req.url)
    const pathAfterFunction = url.pathname.replace(/^\/domains\/?/, '')
    const pathSegments = pathAfterFunction ? pathAfterFunction.split('/').filter(Boolean) : []



    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // GET /domains/by-domain/:domain - Find app by custom domain (public)
        if (req.method === 'GET' && pathSegments.length === 2 && pathSegments[0] === 'by-domain') {
            const domain = pathSegments[1]



            const { data: domainRecord, error } = await supabase
                .from('app_domains')
                .select(`
                    *,
                    applications (
                        id,
                        name,
                        slug,
                        description
                    )
                `)
                .eq('domain', domain)
                .eq('status', 'active')
                .single()

            if (error || !domainRecord) {
                console.error('❌ Domain not found:', error)
                return new Response(JSON.stringify({ error: 'Domain not found' }), {
                    status: 404,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }



            return new Response(JSON.stringify(domainRecord.applications), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // For other routes, require user-id
        const userId = req.headers.get('x-user-id')



        if (!userId) {
            console.error('❌ User ID not provided in headers')
            return new Response(JSON.stringify({ error: 'User ID is required' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // GET /domains - List user domains
        if (req.method === 'GET' && pathSegments.length === 0) {


            const { data: domains, error } = await supabase
                .from('app_domains')
                .select(`
                    *,
                    applications (
                        name,
                        slug
                    )
                `)
                .eq('user_id', userId)
                .order('created_at', { ascending: false })

            if (error) {
                console.error('❌ Error fetching domains:', error)
                return new Response(JSON.stringify({ error: 'Error fetching domains' }), {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }

            // Transform data to the format expected by frontend
            const formattedDomains = domains.map(domain => ({
                id: domain.id,
                domain: domain.domain,
                app_id: domain.app_id,
                app_name: domain.applications?.name || 'App not found',
                status: domain.status,
                created_at: domain.created_at,
                verified_at: domain.verified_at,
                error_message: domain.error_message
            }))



            return new Response(JSON.stringify(formattedDomains), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // POST /domains - Add new domain
        if (req.method === 'POST' && pathSegments.length === 0) {
            const body = await req.json()
            const { domain, app_id } = body



            if (!domain || !app_id) {
                return new Response(JSON.stringify({ error: 'Domain and App ID are required' }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }

            // Debug: First let's check if the app exists (without user filter)
            const { data: appCheck, error: appCheckError } = await supabase
                .from('applications')
                .select('id, name, owner_id')
                .eq('id', app_id)
                .single()



            // Check if the app belongs to the user
            const { data: app, error: appError } = await supabase
                .from('applications')
                .select('id, name, owner_id')
                .eq('id', app_id)
                .eq('owner_id', userId)
                .single()



            if (appError || !app) {
                console.error('❌ App not found or does not belong to the user. AppError:', appError)
                console.error('❌ UserId sent:', userId)
                console.error('❌ App ID sent:', app_id)

                if (appCheck && appCheck.owner_id !== userId) {
                    console.error('❌ App belongs to user:', appCheck.owner_id, 'but was sent:', userId)
                    return new Response(JSON.stringify({
                        error: `App belongs to user ${appCheck.owner_id}, but ${userId} was sent`
                    }), {
                        status: 403,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    })
                }

                return new Response(JSON.stringify({
                    error: 'App not found',
                    debug: {
                        app_id: app_id,
                        userId: userId,
                        appExists: !!appCheck,
                        appOwner: appCheck?.owner_id
                    }
                }), {
                    status: 404,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }

            // Check if the domain already exists
            const { data: existingDomain } = await supabase
                .from('app_domains')
                .select('*')
                .eq('domain', domain)
                .single()

            if (existingDomain) {
                return new Response(JSON.stringify({ error: 'This domain is already in use' }), {
                    status: 409,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }

            // Create new domain
            const { data: newDomain, error: createError } = await supabase
                .from('app_domains')
                .insert({
                    domain: domain,
                    app_id: app_id,
                    user_id: userId,
                    status: 'pending'
                })
                .select()
                .single()

            if (createError) {
                console.error('❌ Error creating domain:', createError)
                return new Response(JSON.stringify({ error: 'Error creating domain' }), {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }



            // Return created domain with app name
            const domainWithApp = {
                ...newDomain,
                app_name: app.name
            }

            return new Response(JSON.stringify(domainWithApp), {
                status: 201,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // POST /domains/verify/:id - Verify DNS configuration
        if (req.method === 'POST' && pathSegments.length === 2 && pathSegments[0] === 'verify') {
            const domainId = pathSegments[1]



            // Check if the domain belongs to the user
            const { data: domain, error: findError } = await supabase
                .from('app_domains')
                .select('*, applications(slug)')
                .eq('id', domainId)
                .eq('user_id', userId)
                .single()

            if (findError || !domain) {
                return new Response(JSON.stringify({ error: 'Domain not found' }), {
                    status: 404,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }

            // Simulate DNS verification (in production, use a real DNS library)
            let dnsStatus = 'pending'
            let errorMessage = null

            try {
                // Here you would implement real DNS verification
                // For example: check if domain.domain points to clicknich.com

                // For now, simulate based on time (for testing)
                const domainAge = Date.now() - new Date(domain.created_at).getTime()
                const fiveMinutes = 5 * 60 * 1000

                if (domainAge > fiveMinutes) {
                    // Simulate that after 5 minutes it becomes active
                    dnsStatus = 'active'

                    // Update status in database
                    const { error: updateError } = await supabase
                        .from('app_domains')
                        .update({
                            status: 'active',
                            verified_at: new Date().toISOString(),
                            error_message: null
                        })
                        .eq('id', domainId)

                    if (updateError) {
                        console.error('❌ Error updating status:', updateError)
                    }
                } else {
                    // Still pending
                    dnsStatus = 'pending'
                    errorMessage = 'Waiting for DNS propagation (may take up to 24 hours)'
                }

            } catch (error) {
                console.error('❌ Error in DNS verification:', error)
                dnsStatus = 'error'
                errorMessage = 'Error in DNS verification'

                // Update error status in database
                await supabase
                    .from('app_domains')
                    .update({
                        status: 'error',
                        error_message: errorMessage
                    })
                    .eq('id', domainId)
            }



            return new Response(JSON.stringify({
                status: dnsStatus,
                error_message: errorMessage,
                verified_at: dnsStatus === 'active' ? new Date().toISOString() : null
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // DELETE /domains/:id - Remove domain
        if (req.method === 'DELETE' && pathSegments.length === 1) {
            const domainId = pathSegments[0]



            // Check if the domain belongs to the user
            const { data: domain, error: findError } = await supabase
                .from('app_domains')
                .select('*')
                .eq('id', domainId)
                .eq('user_id', userId)
                .single()

            if (findError || !domain) {
                console.error('❌ Domain not found:', findError)
                return new Response(JSON.stringify({ error: 'Domain not found' }), {
                    status: 404,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }

            // Remove domain
            const { error: deleteError } = await supabase
                .from('app_domains')
                .delete()
                .eq('id', domainId)
                .eq('user_id', userId)

            if (deleteError) {
                console.error('❌ Error removing domain:', deleteError)
                return new Response(JSON.stringify({ error: 'Error removing domain' }), {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }



            return new Response(JSON.stringify({ success: true }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        return new Response(JSON.stringify({ error: 'Not Found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error) {
        console.error('Domains function error:', error)
        return new Response(JSON.stringify({
            error: error.message,
            timestamp: new Date().toISOString()
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})