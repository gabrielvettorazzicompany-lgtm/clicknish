# Funnels Component Architecture

Esta pasta contém a arquitetura refatorada do sistema de funis, seguindo boas práticas de desenvolvimento React com TypeScript.

## 📁 Estrutura de Arquivos

```
src/
├── components/
│   └── funnel/
│       ├── tabs/
│       │   ├── FunnelsTab.tsx      # Tab de listagem de funis
│       │   └── ScriptsTab.tsx      # Tab de scripts de ofertas
│       ├── modals/
│       │   └── CreateFunnelModal.tsx # Modal para criar funil
│       ├── FunnelRow.tsx           # Linha individual da tabela
│       ├── TabNav.tsx              # Navegação entre tabs
│       ├── OfferCard.tsx           # Card de oferta individual
│       ├── OfferModal.tsx          # Modal de criação/edição de ofertas
│       └── OffersConfiguration.tsx # Configuração de ofertas
├── hooks/
│   ├── useFunnels.ts               # Hook para gerenciar state dos funis
│   └── useScriptManager.ts         # Hook para gerenciar scripts
├── types/
│   └── funnel.ts                   # Tipos TypeScript para funis
├── utils/
│   └── funnelUtils.ts              # Funções utilitárias
└── pages/
    └── Funnels.tsx                 # Página principal (refatorada)
```

## 🏗️ Componentes

### `pages/Funnels.tsx`
- **Responsabilidade**: Layout principal e orquestração dos componentes
- **Tamanho**: ~80 linhas (reduzido de 635 linhas)
- **Estado**: Gerenciado pelo hook `useFunnels`

### `hooks/useFunnels.ts`
- **Responsabilidade**: Gerenciamento de estado e operações CRUD de funis
- **Features**: 
  - Estado dos funis (loading, creating, filters)
  - Operações (fetch, create, filter)
  - Estado compartilhado entre componentes

### `hooks/useScriptManager.ts`
- **Responsabilidade**: Gerenciamento de scripts de ofertas
- **Features**:
  - Geração de scripts
  - Cópia para clipboard
  - Estado de "copiado"

### `components/funnel/tabs/FunnelsTab.tsx`
- **Responsabilidade**: Exibição e filtros da lista de funis
- **Features**:
  - Pesquisa e filtros
  - Tabela responsiva
  - Empty states

### `components/funnel/tabs/ScriptsTab.tsx`
- **Responsabilidade**: Geração e exibição de scripts
- **Features**:
  - Cards de script (upsell/downsell)
  - Exemplos de integração
  - Dicas de configuração

### `components/funnel/FunnelRow.tsx`
- **Responsabilidade**: Linha individual da tabela de funis
- **Props**: Dados do funil + ações opcionais
- **Reutilizável**: Pode ser usado em outras tabelas

### `components/funnel/modals/CreateFunnelModal.tsx`
- **Responsabilidade**: Modal para criação de novos funis
- **Features**:
  - Validação de formulário
  - Estados de loading
  - Gerenciamento próprio do form state

### `components/funnel/TabNav.tsx`
- **Responsabilidade**: Navegação entre as tabs
- **Configurável**: Lista de tabs facilmente modificável
- **Acessível**: Indicadores visuais de tab ativa

## 🔧 Utilitários

### `utils/funnelUtils.ts`
- **Constantes**: Lista de moedas, badges de status
- **Funções**: Formatação de data, geração de scripts
- **Reutilizáveis**: Funções puras sem dependências

### `types/funnel.ts`
- **Interfaces**: Tipos TypeScript bem definidos
- **Extensível**: Fácil adição de novos tipos
- **Type Safety**: Previne erros de tipo

## 🎯 Benefícios da Refatoração

### ✅ Antes vs Depois

| Aspecto | Antes | Depois |
|---------|-------|--------|
| **Linhas de código** | 635 linhas | ~80 linhas no arquivo principal |
| **Responsabilidades** | Tudo em um arquivo | Separadas por domínio |
| **Reutilização** | Baixa | Alta |
| **Testabilidade** | Difícil | Fácil (componentes isolados) |
| **Manutenibilidade** | Baixa | Alta |
| **Performance** | Renderização desnecessária | Otimizada por componente |

### 🚀 Melhorias Implementadas

1. **Separação de Responsabilidades**
   - Cada componente tem uma responsabilidade única
   - Hooks customizados para lógica de negócio
   - Utilitários para funções puras

2. **Reutilização de Código**
   - Componentes podem ser reutilizados
   - Hooks podem ser compartilhados
   - Utilitários são funções puras

3. **Type Safety**
   - Tipos TypeScript bem definidos
   - Props tipadas corretamente
   - Estado tipado e validado

4. **Performance**
   - Componentes menores = re-renderizações mais eficientes
   - Hooks otimizados com dependências corretas
   - Lazy loading potential para tabs

5. **Manutenibilidade**
   - Fácil localizar e modificar funcionalidades
   - Adição de novas features sem impactar existentes
   - Debugging simplificado

## 🧪 Como Usar

### Adicionar Nova Tab
1. Criar componente em `components/funnel/tabs/`
2. Adicionar tipo em `types/funnel.ts`
3. Incluir na lista de tabs em `TabNav.tsx`
4. Adicionar case no switch de `Funnels.tsx`

### Adicionar Novo Campo no Funil
1. Atualizar interface `Funnel` em `types/funnel.ts`
2. Modificar `CreateFunnelModal.tsx` se necessário
3. Atualizar `FunnelRow.tsx` para exibição
4. Ajustar hook `useFunnels.ts` se for campo editável

### Adicionar Nova Funcionalidade
1. Criar componente específico
2. Criar hook se houver lógica de estado complexa
3. Adicionar tipos necessários
4. Integrar no componente pai apropriado

## 📝 Convenções

- **Nomes**: PascalCase para componentes, camelCase para funções
- **Arquivos**: Um componente por arquivo
- **Props**: Sempre tipadas com interface
- **Hooks**: Prefixo `use` + nome descritivo
- **Utilitários**: Funções puras exportadas
- **Tipos**: Interface para objetos, type para unions

Esta arquitetura proporciona uma base sólida e escalável para o sistema de funis! 🎉