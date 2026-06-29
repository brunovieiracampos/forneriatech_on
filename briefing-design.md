# Briefing de Design — SaaS de Gestão para Pizzarias

---

## Conceito central

**"Ferramenta que parece de casa."**

Profissional o suficiente para o dono confiar os números do negócio. Acolhedor o suficiente para o atendente não ter medo de usar. Nunca frio, nunca burocrático. A sensação deve ser de uma ferramenta que foi feita para *esse* negócio, não adaptada de um template genérico.

---

## Referências visuais

- **Stripe** — estrutura limpa, hierarquia clara, confiança sem burocracia
- **Cielo** — profissional, acessível, contexto brasileiro de negócio
- **Bahama Bucks** — calor, personalidade, não-corporativo, acolhedor

---

## Paleta de cores

Base inspirada no ambiente da pizzaria — forno, massa, manjericão, brasa — executada de forma sofisticada, não literal.

| Nome | Hex | Uso |
|---|---|---|
| **Brasa** | `#C45C2E` | Acento principal, CTAs, status ativos |
| **Carvão** | `#1E1E1E` | Texto principal, sidebar |
| **Massa** | `#F5EFE6` | Background principal |
| **Creme** | `#EDE3D4` | Cards, superfícies secundárias |
| **Manjericão** | `#3D6B4F` | Sucesso, status "entregue", positivo |
| **Cinza Neutro** | `#6B6B6B` | Texto secundário, labels |
| **Alerta** | `#E8A020` | Warnings, atenção |
| **Erro** | `#C0392B` | Erros, cancelamentos |

> Tom geral: fundo quente (não branco frio), acentos com calor. Pastéis naturais, não pastéis de papel de presente. A brasa aparece com parcimônia — nos botões primários e nos elementos-âncora.

---

## Tipografia

Par da família DM — contraste de personalidade sem dissonância.

- **Display / Títulos / Números grandes:** DM Serif Display — serifada com personalidade, dá peso e confiança aos números e títulos
- **Corpo / Interface / Labels:** DM Sans — legível em tamanhos pequenos, combina naturalmente com a DM Serif

> Ambas disponíveis no Google Fonts.

---

## Tokens shadcn

```css
--background: #F5EFE6;
--card: #EDE3D4;
--primary: #C45C2E;
--primary-foreground: #FFFFFF;
--secondary: #EDE3D4;
--muted: #D9CFC3;
--accent: #3D6B4F;
--radius: 0.5rem;
--font-sans: 'DM Sans', sans-serif;
```

---

## Shell (estrutura base)

- **Sidebar esquerda** — fundo carvão (`#1E1E1E`), ícones + labels, logo no topo, seletor de filial logo abaixo
- **Topbar** — fundo massa, nome da tela à esquerda, usuário + notificações à direita
- **Área de conteúdo** — fundo massa, cards em creme, borda sutil de 1px em `#D9CFC3`, sem sombras pesadas

---

## Telas âncora (nesta ordem)

1. **Shell completo** — sidebar + topbar + seletor de filial. Define o sistema inteiro.
2. **Criação de pedido** — busca de cliente por telefone, seleção de itens, resumo lateral com totais em tempo real, botão de confirmar. Fluxo rápido, poucos cliques, pensado para balcão com fila.
3. **Painel da cozinha (KDS)** — cards de pedido em fila, status visível de longe, botão grande de avançar status. Alto contraste, tipografia grande, mínimo de ruído.
4. **Dashboard do dono** — faturamento do dia, pedidos por status, ticket médio, pizzas mais vendidas. Números grandes em DM Serif, gráfico de linha sóbrio.
5. **Tela CRUD representativa** — cadastro de cliente. Serve de molde para os outros CRUDs.

---

## Elemento-assinatura: a jornada do pedido

O diferencial do produto é o cliente saber onde está a pizza. A jornada de status merece um componente visual próprio — não um badge genérico.

**Conceito:** linha do tempo horizontal com ícones minimalistas para cada etapa.
- Etapa atual → destaque em brasa
- Etapas concluídas → manjericão
- Etapas futuras → cinza neutro

Aparece no topo do detalhe do pedido e como elemento menor nos cards do KDS. É o componente que vai aparecer nas demos e no marketing — vale gastar criatividade aqui.

---

## O que evitar

- Fundo branco puro (`#FFFFFF`) — usar o massa quente
- Accent em roxo/indigo/violet — default de todo SaaS moderno
- Sombras flutuantes pesadas nos cards
- Fonte Inter
- Espaçamento excessivamente arejado — o produto é denso por necessidade (balcão, cozinha)
