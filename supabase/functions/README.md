# Supabase Edge Functions

## 🚀 Deploy das Edge Functions

### 1. **Instalar Supabase CLI:**
```bash
npm install -g supabase
```

### 2. **Login no Supabase:**
```bash
supabase login
```
  ![alt text](image.png)
### 3. **Link com seu projeto:**
```bash
cd /home/gabriel/Documentos/huskyapp
supabase link --project-ref cgeqtodbisgwvhkaahiy
```

### 4. **Deploy das funções:**
```bash
supabase functions deploy applications
supabase functions deploy products
supabase functions deploy apps
```

### 5. **Testar localmente (opcional):**
```bash
supabase start
supabase functions serve --env-file .env.local
```

## 📋 Edge Functions criadas:

### **applications** (`/functions/v1/applications`)
- `GET /applications` - Listar apps do usuário
- `POST /applications` - Criar novo app
- `GET /applications/:id` - Buscar app por ID
- `GET /applications/:id/products` - Listar produtos
- `POST /applications/:id/products` - Criar produto
- `GET /applications/:id/banners` - Buscar banners

### **products** (`/functions/v1/products`)
- `PUT /products/:id` - Atualizar produto

### **apps** (`/functions/v1/apps`)
- `GET /apps/slug/:slug` - Buscar app por slug (público)

## 🔧 URLs das funções:
- Base: `https://cgeqtodbisgwvhkaahiy.supabase.co/functions/v1`
- Applications: `https://cgeqtodbisgwvhkaahiy.supabase.co/functions/v1/applications`
- Products: `https://cgeqtodbisgwvhkaahiy.supabase.co/functions/v1/products`
- Apps: `https://cgeqtodbisgwvhkaahiy.supabase.co/functions/v1/apps`

## ⚙️ Configuração:

As funções usam automaticamente:
- `SUPABASE_URL` 
- `SUPABASE_SERVICE_ROLE_KEY`
- Headers de CORS configurados
- Autenticação com Anon Key