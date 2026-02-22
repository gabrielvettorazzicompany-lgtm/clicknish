# Dashboard Components

Componentes modulares para o Dashboard, seguindo boas práticas de organização e reutilização.

## Estrutura

### Componentes

- **StatCard.tsx** - Card genérico para exibir estatísticas (vendas, ticket médio, pedidos, saldo)
- **DashboardFilters.tsx** - Filtros do topo (tipo, produto, período, ocultar valores)
- **FinancialSummary.tsx** - Resumo financeiro com métricas (conversão, chargeback, reembolsos)
- **PaymentMethods.tsx** - Lista de métodos de pagamento com percentuais
- **DailySalesChart.tsx** - Gráfico de vendas diárias em SVG
- **InstallmentsCard.tsx** - Card de parcelas no cartão (placeholder)

### Hooks Customizados

- **useDashboardProducts.ts** - Hook para buscar produtos/apps do usuário
- **useDashboardStats.ts** - Hook para buscar estatísticas do dashboard

## Benefícios da Refatoração

### ✅ Organização
- Separação clara de responsabilidades
- Componentes pequenos e focados
- Fácil localização de código

### ✅ Reutilização
- Componentes podem ser usados em outras páginas
- Props bem definidas e tipadas
- Lógica encapsulada em hooks

### ✅ Manutenibilidade
- Alterações isoladas em componentes específicos
- Testes mais fáceis de implementar
- Menor acoplamento entre partes do código

### ✅ Performance
- Hooks personalizados para gerenciar estados complexos
- Queries otimizadas em paralelo no useDashboardStats
- Componentes leves e focados

## Uso

```tsx
import StatCard from '@/components/dashboard/StatCard'
import { TrendingUp } from 'lucide-react'

<StatCard
  title="Total em vendas"
  value="R$ 16,70"
  subtitle="durante este período!"
  icon={TrendingUp}
  loading={false}
/>
```

## Estrutura de Pastas

```
src/
├── components/
│   └── dashboard/
│       ├── StatCard.tsx
│       ├── DashboardFilters.tsx
│       ├── FinancialSummary.tsx
│       ├── PaymentMethods.tsx
│       ├── DailySalesChart.tsx
│       ├── InstallmentsCard.tsx
│       └── README.md
├── hooks/
│   ├── useDashboardProducts.ts
│   └── useDashboardStats.ts
└── pages/
    └── Dashboard.tsx (agora muito mais limpo!)
```

## Próximos Passos

- [ ] Implementar lógica real de parcelamento
- [ ] Adicionar animações aos componentes
- [ ] Implementar testes unitários
- [ ] Adicionar Storybook para documentação visual
- [ ] Melhorar gráfico com biblioteca como Recharts ou Chart.js
