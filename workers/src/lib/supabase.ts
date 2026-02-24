/**
 * Cliente Supabase para Cloudflare Workers
 * Versão leve sem dependências pesadas
 */

export interface SupabaseConfig {
    url: string
    serviceKey: string
}

export class SupabaseClient {
    private url: string
    private serviceKey: string

    constructor(config: SupabaseConfig) {
        this.url = config.url
        this.serviceKey = config.serviceKey
    }

    /**
     * Query genérica para tabelas
     */
    from(table: string) {
        return new SupabaseQuery(this.url, this.serviceKey, table)
    }

    /**
     * Chamar RPC function
     */
    async rpc(fn: string, params?: Record<string, any>) {
        const response = await fetch(`${this.url}/rest/v1/rpc/${fn}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': this.serviceKey,
                'Authorization': `Bearer ${this.serviceKey}`,
            },
            body: JSON.stringify(params || {}),
        })

        const data = await response.json()
        return { data, error: response.ok ? null : data }
    }

    /**
     * Admin auth operations
     */
    get auth() {
        return {
            admin: {
                createUser: async (options: {
                    email: string
                    email_confirm?: boolean
                    user_metadata?: Record<string, any>
                }) => {
                    const response = await fetch(`${this.url}/auth/v1/admin/users`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'apikey': this.serviceKey,
                            'Authorization': `Bearer ${this.serviceKey}`,
                        },
                        body: JSON.stringify(options),
                    })

                    const data = await response.json()
                    if (!response.ok) {
                        return { data: null, error: data }
                    }
                    return { data: { user: data }, error: null }
                },

                listUsers: async (options?: { perPage?: number; page?: number }) => {
                    const params = new URLSearchParams()
                    if (options?.perPage) params.set('per_page', String(options.perPage))
                    if (options?.page) params.set('page', String(options.page))

                    const response = await fetch(`${this.url}/auth/v1/admin/users?${params}`, {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                            'apikey': this.serviceKey,
                            'Authorization': `Bearer ${this.serviceKey}`,
                        },
                    })

                    const data = await response.json()
                    if (!response.ok) {
                        return { data: null, error: data }
                    }
                    return { data: { users: data.users || data }, error: null }
                },

                /**
                 * Busca usuário por email - MUITO mais eficiente que listUsers
                 */
                getUserByEmail: async (email: string) => {
                    const response = await fetch(`${this.url}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                            'apikey': this.serviceKey,
                            'Authorization': `Bearer ${this.serviceKey}`,
                        },
                    })

                    const data = await response.json()
                    if (!response.ok) {
                        return { data: null, error: data }
                    }

                    // Retorna o primeiro usuário encontrado ou null
                    const users = data.users || data || []
                    const user = Array.isArray(users) ? users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase()) : null
                    return { data: { user }, error: null }
                },

                deleteUser: async (userId: string) => {
                    const response = await fetch(`${this.url}/auth/v1/admin/users/${userId}`, {
                        method: 'DELETE',
                        headers: {
                            'Content-Type': 'application/json',
                            'apikey': this.serviceKey,
                            'Authorization': `Bearer ${this.serviceKey}`,
                        },
                    })

                    if (!response.ok) {
                        const data = await response.json()
                        return { data: null, error: data }
                    }
                    return { data: { user: null }, error: null }
                },

                getUserById: async (userId: string) => {
                    const response = await fetch(`${this.url}/auth/v1/admin/users/${userId}`, {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                            'apikey': this.serviceKey,
                            'Authorization': `Bearer ${this.serviceKey}`,
                        },
                    })

                    const data = await response.json()
                    if (!response.ok) {
                        return { data: null, error: data }
                    }
                    return { data: { user: data }, error: null }
                },

                updateUserById: async (userId: string, attributes: {
                    email?: string
                    password?: string
                    email_confirm?: boolean
                    phone_confirm?: boolean
                    user_metadata?: Record<string, any>
                    app_metadata?: Record<string, any>
                    ban_duration?: string
                }) => {
                    const response = await fetch(`${this.url}/auth/v1/admin/users/${userId}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'apikey': this.serviceKey,
                            'Authorization': `Bearer ${this.serviceKey}`,
                        },
                        body: JSON.stringify(attributes),
                    })

                    const data = await response.json()
                    if (!response.ok) {
                        return { data: null, error: data }
                    }
                    return { data: { user: data }, error: null }
                }
            },

            signInWithPassword: async (credentials: { email: string; password: string }) => {
                const response = await fetch(`${this.url}/auth/v1/token?grant_type=password`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': this.serviceKey,
                    },
                    body: JSON.stringify(credentials),
                })

                const data = await response.json()
                if (!response.ok) {
                    return { data: null, error: data }
                }
                return {
                    data: {
                        user: data.user,
                        session: {
                            access_token: data.access_token,
                            refresh_token: data.refresh_token,
                            expires_at: data.expires_at,
                            expires_in: data.expires_in,
                            token_type: data.token_type
                        }
                    },
                    error: null
                }
            }
        }
    }
}

class SupabaseQuery {
    private url: string
    private serviceKey: string
    private table: string
    private queryParams: string[] = []
    private selectColumns: string = '*'
    private method: string = 'GET'
    private bodyData: any = null
    private upsertOptions: { onConflict?: string; ignoreDuplicates?: boolean } = {}
    private returnData: boolean = false
    private singleResult: boolean = false
    private maybeSingleResult: boolean = false

    constructor(url: string, serviceKey: string, table: string) {
        this.url = url
        this.serviceKey = serviceKey
        this.table = table
    }

    select(columns: string = '*') {
        this.selectColumns = columns
        // Don't change method if we're doing insert/update (for returning data)
        if (this.method === 'GET' || !this.bodyData) {
            this.method = 'GET'
        }
        this.returnData = true
        return this
    }

    insert(data: Record<string, any> | Record<string, any>[]) {
        this.method = 'POST'
        this.bodyData = data
        return this
    }

    update(data: Record<string, any>) {
        this.method = 'PATCH'
        this.bodyData = data
        return this
    }

    upsert(data: Record<string, any> | Record<string, any>[], options?: { onConflict?: string; ignoreDuplicates?: boolean }) {
        this.method = 'POST'
        this.bodyData = data
        this.upsertOptions = options || {}
        return this
    }

    delete() {
        this.method = 'DELETE'
        return this
    }

    eq(column: string, value: any) {
        this.queryParams.push(`${column}=eq.${value}`)
        return this
    }

    neq(column: string, value: any) {
        this.queryParams.push(`${column}=neq.${value}`)
        return this
    }

    in(column: string, values: any[]) {
        this.queryParams.push(`${column}=in.(${values.join(',')})`)
        return this
    }

    is(column: string, value: any) {
        this.queryParams.push(`${column}=is.${value}`)
        return this
    }

    order(column: string, options?: { ascending?: boolean }) {
        const dir = options?.ascending === false ? 'desc' : 'asc'
        this.queryParams.push(`order=${column}.${dir}`)
        return this
    }

    limit(count: number) {
        this.queryParams.push(`limit=${count}`)
        return this
    }

    single() {
        this.singleResult = true
        this.returnData = true
        return this
    }

    maybeSingle() {
        this.maybeSingleResult = true
        this.returnData = true
        return this
    }

    /**
     * Executar a query
     */
    async then<T>(resolve: (result: { data: T | null; error: any }) => void) {
        try {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'apikey': this.serviceKey,
                'Authorization': `Bearer ${this.serviceKey}`,
            }

            // Prefer header para retornar dados após insert/update
            if (this.returnData && (this.method === 'POST' || this.method === 'PATCH')) {
                headers['Prefer'] = 'return=representation'
            }

            // Upsert via Prefer header
            if (this.upsertOptions.onConflict) {
                headers['Prefer'] = `resolution=merge-duplicates,return=representation`
            }

            let url = `${this.url}/rest/v1/${this.table}`

            // Adicionar select columns
            if (this.selectColumns && this.selectColumns !== '*') {
                this.queryParams.push(`select=${this.selectColumns}`)
            }

            // Adicionar query params
            if (this.queryParams.length > 0) {
                url += `?${this.queryParams.join('&')}`
            }

            const fetchOptions: RequestInit = {
                method: this.method,
                headers,
            }

            // Only add body for POST/PATCH/PUT methods
            if (this.bodyData && (this.method === 'POST' || this.method === 'PATCH' || this.method === 'PUT')) {
                fetchOptions.body = JSON.stringify(this.bodyData)
            }

            const response = await fetch(url, fetchOptions)

            let data = await response.json()

            if (!response.ok) {
                resolve({ data: null, error: data })
                return
            }

            // Handle single/maybeSingle
            if (this.singleResult || this.maybeSingleResult) {
                if (Array.isArray(data)) {
                    data = data[0] || null
                }
            }

            resolve({ data, error: null })
        } catch (error: any) {
            resolve({ data: null, error: { message: error.message } })
        }
    }
}

/**
 * Factory function
 */
export function createClient(url: string, serviceKey: string): SupabaseClient {
    return new SupabaseClient({ url, serviceKey })
}
