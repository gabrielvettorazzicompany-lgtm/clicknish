# Order Bump Components

Componentes refatorados para gerenciamento de Order Bumps em funis de vendas.

## 📁 Estrutura de Pastas

```
order-bump/
├── hooks/
│   └── useOrderBumps.ts          # Hook customizado com toda lógica de state e API
├── types.ts                       # Definições de tipos TypeScript
├── OrderBumpCard.tsx              # Card individual de order bump (drag & drop)
├── OrderBumpForm.tsx              # Formulário de criação/edição
├── OrderBumpList.tsx              # Lista com drag & drop
├── OrderBumpPreview.tsx           # Preview visual da oferta
└── index.ts                       # Barrel export
```

## 🧩 Componentes

### OrderBumpSection.tsx (Principal - 133 linhas)
**Antes:** 800+ linhas  
**Depois:** 133 linhas  

Componente principal que orquestra os demais. Apenas gerencia estado local do formulário (aberto/fechado, edição).

### useOrderBumps (Hook)
Encapsula toda lógica de:
- Busca de produtos (marketplace + applications)
- Busca de order bumps existentes
- Busca de checkouts por produto
- Delete de order bumps
- Reordenação (drag & drop)

### OrderBumpForm
Formulário completo com:
- Seleção de produto
- Seleção de checkout
- Aplicação de desconto
- Customização de textos
- Imagem do produto
- Preview em tempo real

### OrderBumpList
Lista de order bumps com:
- Drag & drop para reordenação
- Estados de loading
- Delegação de eventos (edit/delete)

### OrderBumpCard
Card individual com:
- Suporte a drag & drop
- Exibição de informações do produto
- Botões de ação (editar/excluir)
- Indicador de posição

### OrderBumpPreview
Preview visual da oferta mostrando:
- Checkbox
- Imagem (opcional)
- Textos customizados
- Cálculo de preço com desconto

## 🔧 Uso

```tsx
import OrderBumpSection from '@/components/funnel/OrderBumpSection'

<OrderBumpSection 
    funnelId={funnelId} 
    onUpdate={handleUpdate} 
/>
```

## ✅ Benefícios da Refatoração

1. **Manutenibilidade**: Componentes pequenos e focados
2. **Reusabilidade**: Componentes podem ser usados isoladamente  
3. **Testabilidade**: Lógica separada em hook facilita testes
4. **Performance**: Menos re-renders desnecessários
5. **Legibilidade**: Código mais limpo e organizado

## 📝 Padrões Utilizados

- **Custom Hooks**: Lógica reutilizável
- **Composition**: Componentes pequenos que se combinam
- **Single Responsibility**: Cada componente tem uma única responsabilidade
- **Barrel Exports**: Imports limpos através de index.ts
- **TypeScript**: Type safety completo
