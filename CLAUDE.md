@AGENTS.md

# Forneria — Instruções para o Claude

## O que é este projeto

SaaS de gestão operacional para pizzarias. Primeiro vertical de uma plataforma multi-nicho. O core (auth, tenancy, permissões) é reutilizável; o módulo de pizzaria (cardápio, pedidos, cozinha) é específico do nicho.

Documentos de referência:
- Requisitos completos: `../requisitos-pizzaria-saas.md`
- Briefing de design: `../briefing-design.md`
- Padrões de UI do projeto: `.claude/skills/forneria-ui-patterns.md`
- Designs: `../designer/project/screenshots/`

---

## Stack

- **Next.js 16** (App Router) — leia `node_modules/next/dist/docs/` antes de escrever código Next.js; esta versão tem breaking changes
- **TypeScript**
- **Drizzle ORM** + PostgreSQL via Supabase
- **Supabase Auth** (`@supabase/ssr`)
- **Zod** para validação
- Estilos: **inline styles apenas** — sem Tailwind, sem CSS modules
- Fontes: DM Sans + DM Serif Display via `<link>` do Google Fonts (não usar `next/font`)

---

## Variáveis de ambiente obrigatórias

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
TENANT_ID        # UUID do tenant ativo (fixo no .env.local)
FILIAL_ID        # UUID da filial ativa (fixo no .env.local)
```

---

## Estrutura de pastas relevante

```
src/
  app/
    (auth)/login/         # Tela de login
    (dashboard)/          # Todas as telas autenticadas
      layout.tsx          # Sidebar + shell
      cardapio/           # Módulo cardápio
      clientes/           # Módulo clientes
      pedidos/            # Módulo pedidos (em construção)
    api/auth/login/       # Route Handler de autenticação
  core/
    cep.ts                # Busca de CEP via ViaCEP (reutilizável)
  db/
    index.ts              # Instância do Drizzle
    schema/
      core.ts             # Tenants, filiais, usuários
      pizzaria.ts         # Cardápio, clientes, pedidos, estoque
    migrations/           # Geradas pelo Drizzle Kit
  lib/
    supabase/             # Clientes Supabase (server/client)
  proxy.ts                # Middleware de auth (export const config, não proxyConfig)
```

---

## Regras permanentes de desenvolvimento

### Antes de implementar qualquer feature
1. Ler o design correspondente em `../designer/project/screenshots/`
2. Verificar impacto no schema (`src/db/schema/pizzaria.ts`)
3. Listar arquivos a criar ou alterar
4. Implementar
5. Rodar `npx tsc --noEmit` — zero erros antes do commit

### Formulários e validação
- Nunca usar `required` HTML nativo — validar sempre no `submit`
- Toda validação deve existir em **duas camadas**: frontend (UX) + Zod no Server Action (segurança)
- Campos obrigatórios com erro: borda `#C0392B` + mensagem "Campo obrigatório" abaixo, some ao digitar

### Server Actions
- Arquivo `actions.ts` separado por módulo, com `'use server'`
- Zod valida antes de qualquer operação no banco
- `revalidatePath` ao final de toda action que muta dados
- Nunca confiar no frontend para calcular totais financeiros — recalcular no backend

### Banco de dados
- Toda query usa `TENANT_ID` e/ou `FILIAL_ID` do env para isolar dados
- Snapshots imutáveis em pedidos: `sabores` e `adicionais` em JSONB (preserva o estado no momento da venda)
- Não usar exclusão física em pedidos — soft delete ou inativação

### Commits
- Fazer commit + push ao final de cada feature ou correção relevante
- Mensagem em português, descritiva, com `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`

---

## Módulos implementados

| Módulo | Status | Arquivos principais |
|--------|--------|---------------------|
| Autenticação | ✅ | `app/(auth)/login/`, `app/api/auth/login/`, `proxy.ts` |
| Cardápio | ✅ | `app/(dashboard)/cardapio/` |
| Clientes | ✅ | `app/(dashboard)/clientes/` |
| Pedidos | 🔲 Em construção | `app/(dashboard)/pedidos/` |
| Dashboard | 🔲 Pendente | — |
| KDS (Painel Cozinha) | 🔲 Pendente | — |

---

## Regras de negócio críticas

### Clientes
- Telefone é chave única por tenant (normalizado para apenas dígitos no banco)
- Ao criar pedido: buscar cliente por telefone primeiro — se existe, preenche; se não, cadastra
- `alerta_saude` é informação permanente e crítica — exibir como aviso sempre que abrir a ficha

### Cardápio
- Preço é sempre por tamanho (broto/media/grande/familia)
- `esgotado = true`: aparece no cardápio com overlay, não é clicável
- `ativo = false`: não aparece no cardápio de criação de pedido

### Pedidos — Meio a meio
- Só permitido se `permite_meio_a_meio = true` no produto
- Tamanho é definido no primeiro sabor e travado para o segundo
- Preço = maior valor entre os dois sabores no tamanho escolhido
- Fluxo: seleciona tamanho → escolhe "½+½" → carrinho entra em modo pendente → seleciona segundo sabor → item composto entra no carrinho
- O primeiro sabor selecionado permanece visível mesmo ao navegar/pesquisar no cardápio

### Pedidos — Cálculos (sempre no backend)
- `subtotal_produtos` = soma de `preco_total_item` dos itens
- `total` = `subtotal_produtos` + `subtotal_adicionais` + `valor_frete` - `valor_desconto`
- Frontend exibe em tempo real mas backend recalcula e valida antes de persistir

---

## CEP
Usar sempre `src/core/cep.ts`. Nunca importar a lógica de CEP diretamente nos componentes.
Fluxo obrigatório: CEP → API → preenche endereço → foco no campo Número.
