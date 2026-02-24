// @ts-nocheck
import { createClient } from '../lib/supabase'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

export async function handleApps(request: Request, env: any, pathSegments: string[]): Promise<Response> {
    if (request.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

        // GET /api/apps/slug/:slugOrId - Get app by slug or ID (public access)
        if (request.method === 'GET' && pathSegments.length === 2 && pathSegments[0] === 'slug') {
            const slugOrId = pathSegments[1]
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId)

            let data = null
            let error = null

            if (isUUID) {
                const result = await supabase
                    .from('applications')
                    .select('*')
                    .eq('id', slugOrId)
                    .single()
                data = result.data
                error = result.error
            } else {
                const result = await supabase
                    .from('applications')
                    .select('*')
                    .eq('slug', slugOrId)
                    .single()
                data = result.data
                error = result.error
            }

            if (error || !data) {
                return new Response(JSON.stringify({ error: 'App not found' }), {
                    status: 404,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }

            return new Response(JSON.stringify(data), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // POST /api/apps/verify-access - Verify user access to app (email-only)
        if (request.method === 'POST' && pathSegments.length === 1 && pathSegments[0] === 'verify-access') {
            const body = await request.json()
            const { email, appId } = body

            const { data: appUser, error: userError } = await supabase
                .from('app_users')
                .select('*')
                .eq('email', email)
                .eq('application_id', appId)
                .single()

            if (userError || !appUser) {
                return new Response(JSON.stringify({ error: 'Unauthorized access' }), {
                    status: 401,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }

            return new Response(JSON.stringify({
                success: true,
                user: {
                    id: appUser.user_id,
                    email: appUser.email,
                    application_id: appUser.application_id
                },
                access_token: 'mock_token_' + Date.now(),
                refresh_token: 'mock_refresh_' + Date.now(),
                expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // POST /api/apps/free-signup - Create free account
        if (request.method === 'POST' && pathSegments.length === 1 && pathSegments[0] === 'free-signup') {
            const body = await request.json()
            const { email, appId } = body

            if (!email || !appId) {
                return new Response(JSON.stringify({ error: 'Email and appId are required' }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }

            // Check if the app exists and has free_registration enabled
            const { data: app, error: appError } = await supabase
                .from('applications')
                .select('free_registration')
                .eq('id', appId)
                .single()

            if (appError || !app) {
                return new Response(JSON.stringify({ error: 'App not found' }), {
                    status: 404,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }

            if (!app.free_registration) {
                return new Response(JSON.stringify({ error: 'Free registration is not enabled for this app' }), {
                    status: 403,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }

            // Check if the user already exists
            const { data: existingUser } = await supabase
                .from('app_users')
                .select('*')
                .eq('email', email)
                .eq('application_id', appId)
                .single()

            if (existingUser) {
                return new Response(JSON.stringify({
                    success: true,
                    message: 'User already registered, logging in',
                    user: {
                        id: existingUser.user_id,
                        email: existingUser.email,
                        application_id: existingUser.application_id
                    },
                    access_token: 'mock_token_' + Date.now(),
                    refresh_token: 'mock_refresh_' + Date.now(),
                    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }

            // Create new free user
            const userId = crypto.randomUUID()

            const { data: newUser, error: createError } = await supabase
                .from('app_users')
                .insert({
                    email: email,
                    application_id: appId,
                    created_at: new Date().toISOString()
                })
                .select()
                .single()

            if (createError) {
                return new Response(JSON.stringify({ error: 'Error creating account: ' + createError.message }), {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }

            return new Response(JSON.stringify({
                success: true,
                message: 'Free account created successfully',
                user: {
                    id: userId,
                    email: email,
                    application_id: appId
                },
                access_token: 'mock_token_' + Date.now(),
                refresh_token: 'mock_refresh_' + Date.now(),
                expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            }), {
                status: 201,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        return new Response(JSON.stringify({ error: 'Not Found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error: any) {
        console.error('Apps function error:', error)
        return new Response(JSON.stringify({
            error: error.message,
            timestamp: new Date().toISOString()
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
}
