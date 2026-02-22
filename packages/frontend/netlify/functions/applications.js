exports.handler = async (event, context) => {


    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-id',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Content-Type': 'application/json'
    }

    if (event.httpMethod === 'OPTIONS') {

        return { statusCode: 200, headers, body: '' }
    }

    try {
        if (event.httpMethod === 'POST') {


            const body = event.body ? JSON.parse(event.body) : {}


            const response = {
                success: true,
                message: 'FUNÇÃO FUNCIONANDO! App criado com sucesso!',
                data: {
                    id: 'test-' + Date.now(),
                    name: body.name || 'App Teste',
                    slug: (body.name || 'app-teste').toLowerCase().replace(/\s+/g, '-'),
                    primary_color: body.primaryColor || '#3B82F6',
                    secondary_color: body.secondaryColor || '#1E40AF',
                    created_at: new Date().toISOString()
                }
            }

            return {
                statusCode: 201,
                headers,
                body: JSON.stringify(response)
            }
        }

        if (event.httpMethod === 'GET') {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'Função applications funcionando!',
                    data: []
                })
            }
        }

        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        }

    } catch (error) {
        console.error('Function error:', error)
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            })
        }
    }
}