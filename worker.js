// Cloudflare Worker para proxy de domínios personalizados
// 100.000 requests por dia - GRÁTIS!

addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
    const url = new URL(request.url)
    const hostname = url.hostname



    // Se for domínio do Worker, clicknich.com ou localhost, passar direto
    if (hostname.includes('workers.dev') ||
        hostname.includes('clicknich.com') ||
        hostname === 'localhost') {
        return fetch(request)
    }

    // Verificar se domínio personalizado existe
    try {
        const domainCheck = await fetch(
            `https://cgeqtodbisgwvhkaahiy.supabase.co/functions/v1/domains/by-domain/${hostname}`,
            {
                headers: {
                    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZXF0b2RiaXNnd3Zoa2FhaGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTk1MDIsImV4cCI6MjA4NDY5NTUwMn0.Ov6_rRlThZUBIoL4oT6BGozEhvTUdFsWB6KylDXpFoY'
                }
            }
        )

        if (!domainCheck.ok) {
            return new Response(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Domínio não configurado</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
              .container { background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 500px; margin: 0 auto; }
              h1 { color: #e74c3c; margin-bottom: 20px; }
              p { color: #666; line-height: 1.6; }
              a { color: #3498db; text-decoration: none; }
              a:hover { text-decoration: underline; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>🚫 Domínio não configurado</h1>
              <p>O domínio <strong>${hostname}</strong> não está configurado no sistema.</p>
              <p>Configure seu domínio personalizado em:</p>
              <p><a href="https://clicknich.com/domains" target="_blank">HuskyApp - Domínios</a></p>
            </div>
          </body>
        </html>
      `, {
                status: 404,
                headers: {
                    'content-type': 'text/html; charset=utf-8',
                    'cache-control': 'no-cache'
                }
            })
        }

        // Fazer proxy para o Netlify
        const targetUrl = `https://clicknich.com${url.pathname}${url.search}`

        const modifiedHeaders = new Headers()
        for (const [key, value] of request.headers.entries()) {
            // Não passar headers que podem causar problemas
            if (!['host', 'cf-ray', 'cf-ipcountry', 'cf-visitor'].includes(key.toLowerCase())) {
                modifiedHeaders.set(key, value)
            }
        }

        // Adicionar headers necessários
        modifiedHeaders.set('host', 'clicknich.com')
        modifiedHeaders.set('x-forwarded-host', hostname)
        modifiedHeaders.set('x-original-host', hostname)
        modifiedHeaders.set('x-custom-domain', hostname)

        const modifiedRequest = new Request(targetUrl, {
            method: request.method,
            headers: modifiedHeaders,
            body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null
        })

        const response = await fetch(modifiedRequest)

        // Modificar HTML para injetar informação do domínio personalizado
        const contentType = response.headers.get('content-type') || ''

        if (contentType.includes('text/html')) {
            let html = await response.text()

            // Injetar script que define o domínio personalizado
            const domainScript = `
        <script>
          window.__CUSTOM_DOMAIN__ = "${hostname}";
          window.__IS_CUSTOM_DOMAIN__ = true;

        </script>
      `

            html = html.replace('<head>', '<head>' + domainScript)

            // Criar nova resposta com HTML modificado
            const newResponse = new Response(html, {
                status: response.status,
                statusText: response.statusText
            })

            // Copiar headers importantes
            for (const [key, value] of response.headers.entries()) {
                if (!['content-length', 'content-encoding'].includes(key.toLowerCase())) {
                    newResponse.headers.set(key, value)
                }
            }

            // Headers adicionais
            newResponse.headers.set('Access-Control-Allow-Origin', '*')
            newResponse.headers.set('X-Proxied-By', 'Cloudflare-Worker')
            newResponse.headers.set('X-Custom-Domain', hostname)

            return newResponse
        }

        // Para outros tipos de conteúdo, retornar normalmente
        const newResponse = new Response(response.body, {
            status: response.status,
            statusText: response.statusText
        })

        // Copiar headers
        for (const [key, value] of response.headers.entries()) {
            newResponse.headers.set(key, value)
        }

        // Headers adicionais
        newResponse.headers.set('Access-Control-Allow-Origin', '*')
        newResponse.headers.set('X-Proxied-By', 'Cloudflare-Worker')

        return newResponse

    } catch (error) {
        console.error('Erro no proxy:', error)
        return new Response(`
      <html>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1>⚠️ Erro interno</h1>
          <p>Ocorreu um erro ao processar sua solicitação.</p>
          <p>Erro: ${error.message}</p>
        </body>
      </html>
    `, {
            status: 500,
            headers: { 'content-type': 'text/html' }
        })
    }
}