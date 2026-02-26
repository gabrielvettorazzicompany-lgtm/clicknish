# Dashboard Hooks

Hooks personalizados para gerenciar estado e lógica do Dashboard.

## useDashboardProducts

Hook para buscar e gerenciar a lista de produtos/apps do usuário.

### Uso

```tsx
const { products, loading } = useDashboardProducts(user?.id)
```

### Retorno

- `products`: Array de produtos com `id`, `name` e `type` (marketplace | app | community)
- `loading`: Boolean indicando se está carregando

### O que faz

- Busca produtos do marketplace (`member_areas`)
- Busca aplicações (`applications`)
- Combina em uma lista única
- Atualiza automaticamente quando o userId muda

---

## useDashboardStats

Hook para buscar e calcular todas as estatísticas do dashboard.

### Uso

```tsx
const { stats, loading } = useDashboardStats(
  user?.id,
  selectedPeriod,
  selectedProduct,
  selectedType,
  products
)
```

### Parâmetros

- `userId`: ID do usuário logado
- `selectedPeriod`: Período selecionado ('always', 'today', 'yesterday', '7days', '30days')
- `selectedProduct`: ID do produto selecionado ou 'all'
- `selectedType`: Tipo selecionado ('all', 'checkout')
- `products`: Array de produtos (do useDashboardProducts)

### Retorno

```typescript
{
  stats: {
    totalSales: number
    salesCount: number
    conversionRate: number
    checkouts: number
    paymentMethods: Array<{
      name: string
      icon: string
      conversion: number
      value: number
    }>
    abandonedCheckouts: number
    refundRate: number
    chargebackRate: number
    medRate: number
    dailySales: Array<{
      date: string
      value: number
      formattedDate: string
    }>
  },
  loading: boolean
}
```

### O que faz

1. Calcula filtro de data baseado no período
2. Busca vendas do marketplace e apps em paralelo
3. Busca checkouts do marketplace e apps em paralelo
4. Remove duplicatas de vendas de apps (por payment_id)
5. Calcula totais e conversão
6. Agrupa vendas por método de pagamento
7. Gera dados para gráfico de vendas diárias (últimos 7 dias)
8. Atualiza automaticamente quando qualquer filtro muda

### Otimizações

- **Queries em paralelo**: Usa `Promise.all` para buscar dados simultaneamente
- **Deduplicação**: Remove vendas duplicadas de apps
- **Filtros no banco**: Aplica filtros diretamente nas queries do Supabase
- **Cache automático**: React cuida do cache entre re-renders

## Vantagens dos Hooks

✅ **Separação de Lógica**: UI separada da lógica de negócio  
✅ **Reutilização**: Mesma lógica em diferentes componentes  
✅ **Testabilidade**: Hooks podem ser testados isoladamente  
✅ **Type Safety**: Totalmente tipado com TypeScript  
✅ **Performance**: Otimizações automáticas do React  

## Exemplo Completo

```tsx
import { useDashboardProducts } from '@/hooks/useDashboardProducts'
import { useDashboardStats } from '@/hooks/useDashboardStats'

function MyDashboard() {
  const { user } = useAuthStore()
  const [period, setPeriod] = useState('always')
  const [product, setProduct] = useState('all')
  
  const { products, loading: loadingProducts } = useDashboardProducts(user?.id)
  const { stats, loading: loadingStats } = useDashboardStats(
    user?.id,
    period,
    product,
    'all',
    products
  )
  
  return (
    <div>
      <h1>Total: {stats.totalSales}</h1>
      <p>Loading: {loadingStats ? 'Sim' : 'Não'}</p>
    </div>
  )
}
```
