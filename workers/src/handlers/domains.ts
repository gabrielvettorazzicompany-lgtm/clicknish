// @ts-nocheck
/**
 * Handler: Domains
 * Gestão de domínios customizados para apps
 */

import { createClient } from '../lib/supabase'
import type { Env } from '../index'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

function jsonResponse(data: any, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
}

export async function handleDomains(
    request: Request,
    env: Env,
    ctx: ExecutionContext
): Promise<Response> {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
    const url = new URL(request.url)

    // Remove /api/domains prefix to get relative path
    const pathAfterFunction = url.pathname.replace(/^\/api\/domains\/?/, '')
    const pathSegments = pathAfterFunction ? pathAfterFunction.split('/').filter(Boolean) : []

    try {
        // GET /domains/by-domain/:domain - Find app by custom domain (public)
        if (request.method === 'GET' && pathSegments.length === 2 && pathSegments[0] === 'by-domain') {
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
                return jsonResponse({ error: 'Domain not found' }, 404)
            }

            return jsonResponse(domainRecord.applications)
        }

        // For other routes, require user-id
        const userId = request.headers.get('x-user-id')

        if (!userId) {
            return jsonResponse({ error: 'User ID is required' }, 401)
        }

        // GET /domains - List user domains
        if (request.method === 'GET' && pathSegments.length === 0) {
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
                return jsonResponse({ error: 'Error fetching domains' }, 500)
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

            return jsonResponse(formattedDomains)
        }

        // POST /domains - Add new domain
        if (request.method === 'POST' && pathSegments.length === 0) {
            const body = await request.json()
            const { domain, app_id } = body

            if (!domain || !app_id) {
                return jsonResponse({ error: 'Domain and App ID are required' }, 400)
            }

            // Check if the app belongs to the user
            const { data: app, error: appError } = await supabase
                .from('applications')
                .select('id, name, owner_id')
                .eq('id', app_id)
                .eq('owner_id', userId)
                .single()

            if (appError || !app) {
                return jsonResponse({ error: 'App not found or does not belong to user' }, 404)
            }

            // Check if the domain already exists
            const { data: existingDomain } = await supabase
                .from('app_domains')
                .select('*')
                .eq('domain', domain)
                .single()

            if (existingDomain) {
                return jsonResponse({ error: 'This domain is already in use' }, 409)
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
                return jsonResponse({ error: 'Error creating domain' }, 500)
            }

            // Return created domain with app name
            const domainWithApp = {
                ...newDomain,
                app_name: app.name
            }

            return jsonResponse(domainWithApp, 201)
        }

        // POST /domains/verify/:id - Verify DNS configuration
        if (request.method === 'POST' && pathSegments.length === 2 && pathSegments[0] === 'verify') {
            const domainId = pathSegments[1]

            // Check if the domain belongs to the user
            const { data: domain, error: findError } = await supabase
                .from('app_domains')
                .select('*, applications(slug)')
                .eq('id', domainId)
                .eq('user_id', userId)
                .single()

            if (findError || !domain) {
                return jsonResponse({ error: 'Domain not found' }, 404)
            }

            // Simulate DNS verification
            let dnsStatus = 'pending'
            let errorMessage = null

            try {
                const domainAge = Date.now() - new Date(domain.created_at).getTime()
                const fiveMinutes = 5 * 60 * 1000

                if (domainAge > fiveMinutes) {
                    dnsStatus = 'active'

                    await supabase
                        .from('app_domains')
                        .update({
                            status: 'active',
                            verified_at: new Date().toISOString(),
                            error_message: null
                        })
                        .eq('id', domainId)
                } else {
                    dnsStatus = 'pending'
                    errorMessage = 'Waiting for DNS propagation (may take up to 24 hours)'
                }

            } catch (error) {
                dnsStatus = 'error'
                errorMessage = 'Error in DNS verification'

                await supabase
                    .from('app_domains')
                    .update({
                        status: 'error',
                        error_message: errorMessage
                    })
                    .eq('id', domainId)
            }

            return jsonResponse({
                status: dnsStatus,
                error_message: errorMessage,
                verified_at: dnsStatus === 'active' ? new Date().toISOString() : null
            })
        }

        // DELETE /domains/:id - Remove domain
        if (request.method === 'DELETE' && pathSegments.length === 1) {
            const domainId = pathSegments[0]

            // Check if the domain belongs to the user
            const { data: domain, error: findError } = await supabase
                .from('app_domains')
                .select('*')
                .eq('id', domainId)
                .eq('user_id', userId)
                .single()

            if (findError || !domain) {
                return jsonResponse({ error: 'Domain not found' }, 404)
            }

            // Remove domain
            const { error: deleteError } = await supabase
                .from('app_domains')
                .delete()
                .eq('id', domainId)
                .eq('user_id', userId)

            if (deleteError) {
                return jsonResponse({ error: 'Error removing domain' }, 500)
            }

            return jsonResponse({ success: true })
        }

        return jsonResponse({ error: 'Not Found' }, 404)

    } catch (error: any) {
        console.error('Domains handler error:', error)
        return jsonResponse({
            error: error.message,
            timestamp: new Date().toISOString()
        }, 500)
    }
}
