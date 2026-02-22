# 🔒 Sistema de Segurança - Edge Functions

## Proteções Implementadas

### 1. **Rate Limiting por IP**
Limita o número de requisições que um IP pode fazer em determinado período.

**Configurações por endpoint:**

| Edge Function | Max Requisições | Janela | Bloqueio |
|--------------|----------------|--------|----------|
| `process-payment` | 5/min | 1 min | 10 min |
| `process-upsell` | 10/min | 1 min | 5 min |
| `track-checkout` | 50/min | 1 min | 3 min |

### 2. **Detecção de IP Real**
O sistema detecta o IP real do cliente mesmo através de:
- Cloudflare (`cf-connecting-ip`)
- Proxies reversos (`x-forwarded-for`)
- Balanceadores de carga (`x-real-ip`)

### 3. **Bloqueio Automático**
IPs que excederem o rate limit são automaticamente bloqueados temporariamente.

### 4. **Resposta Padronizada**
Requisições bloqueadas retornam:
```json
{
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "Muitas requisições. Tente novamente mais tarde."
}
```

Com header `Retry-After` indicando quando tentar novamente.

## Como Funciona

### Middleware de Segurança
```typescript
import { securityMiddleware } from '../_shared/security-middleware.ts'

const securityCheck = await securityMiddleware(req, {
    rateLimit: {
        maxRequests: 5,
        windowMs: 60000,
        blockDurationMs: 600000
    }
})

if (!securityCheck.allowed) {
    return securityCheck.response!
}
```

### Validação de Origem (Opcional)
Pode ser ativada para validar domínios permitidos:
```typescript
const securityCheck = await securityMiddleware(req, {
    requireOrigin: true,
    allowedOrigins: [
        'https://members.clicknich.com',
        'https://app.clicknich.com'
    ]
})
```

## Segurança no Frontend

### O que NÃO é problema:
✅ Requisições HTTP visíveis no DevTools Network  
✅ APIs públicas (Supabase, Stripe) no código  
✅ Anon Key do Supabase no frontend  

**Por quê?** A segurança está no **backend**:
- Row Level Security (RLS) no Supabase
- Rate limiting nas Edge Functions
- Validação de tokens JWT
- Stripe não permite pagamentos sem webhook de confirmação

### O que seria problema:
❌ Service Role Key no frontend  
❌ Secret Keys da Stripe no código  
❌ Tokens de acesso nas URLs  
❌ Dados sensíveis em localStorage sem criptografia  

## Monitoramento

### Logs de Segurança
Os bloqueios são registrados automaticamente:
- IP bloqueado
- Endpoint tentado
- Timestamp
- Razão do bloqueio

### Métricas Recomendadas
Para ambiente de produção, considere adicionar:
- Dashboard de IPs bloqueados
- Alertas de tentativas de abuso
- Análise de padrões de ataque

## Boas Práticas

1. **Nunca exponha:**
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `STRIPE_SECRET_KEY`
   - Tokens de admin

2. **Sempre use:**
   - RLS policies no Supabase
   - HTTPS/TLS em produção
   - Validação de dados no backend

3. **Monitore:**
   - Logs das Edge Functions
   - Tentativas de acesso bloqueadas
   - Padrões anormais de tráfego

## Ajustes de Rate Limit

Para alterar os limites, edite os valores em cada edge function:

```typescript
rateLimit: {
    maxRequests: 10,      // Número de requisições
    windowMs: 60000,      // 1 minuto
    blockDurationMs: 300000  // 5 minutos
}
```

## Deploy

Após qualquer alteração nas edge functions:

```bash
# Deploy individual
supabase functions deploy process-payment

# Deploy todas
supabase functions deploy --all
```

## Suporte

Em caso de usuários legítimos sendo bloqueados:
1. Verificar logs no Supabase Dashboard
2. Ajustar limites se necessário
3. Considerar whitelist de IPs confiáveis

---

**Última atualização:** Fevereiro 2026  
**Versão:** 1.0.0
