# Sistema de Gestão para Pizzarias — Documento de Requisitos

> Primeiro vertical de uma plataforma boutique de SaaS por nicho. Versão 0.1 (rascunho para validação).

---

## 1. Visão geral

O objetivo é construir um SaaS de gestão operacional para pizzarias, com foco em um diferencial claro de mercado: **comunicação automática com o cliente final via WhatsApp** ao longo de todo o ciclo do pedido (recebido, em produção, a caminho, entregue).

Este documento trata da pizzaria como **primeiro nicho**, mas a arquitetura é desenhada para que a base seja reaproveitada nos próximos verticais (pet shop, salão de beleza, etc.). Por isso, ao longo do texto há uma separação explícita entre:

- **Plataforma core (reutilizável):** autenticação, multi-tenancy, perfis e permissões (RBAC), gestão de filiais, motor de notificações, billing/assinatura, auditoria.
- **Módulo de nicho (pizzaria):** cardápio, pedidos, fluxo de cozinha/entrega, estoque de insumos, analytics específico.

A regra prática: tudo que se repetiria igual em um pet shop deve nascer no core.

---

## 2. Objetivos e indicadores de sucesso

| Objetivo | Como medir |
|---|---|
| Reduzir ligações de "cadê minha pizza?" | % de pedidos com notificação entregue / abertura de mensagem |
| Acelerar o lançamento de pedidos no balcão | Tempo médio de criação de pedido |
| Dar visibilidade gerencial | Uso recorrente do dashboard de análise |
| Viabilizar multi-nicho | % de código/core reaproveitado no segundo vertical |

---

## 3. Personas e papéis

| Papel | Quem é | Escopo de acesso |
|---|---|---|
| **Super Admin** | Você (dono da plataforma) | Tudo, em todos os tenants. Único que gerencia o catálogo de Perfis-modelo e planos. |
| **Admin da Pizzaria (Tenant Owner)** | Dono(a) da pizzaria | Tudo dentro do próprio tenant e de todas as suas filiais. |
| **Gerente de Filial** | Gerente de uma unidade | Operação de uma filial específica. |
| **Atendente / Caixa** | Quem lança o pedido | Criar/editar pedidos, consultar e cadastrar clientes. |
| **Cozinha / Produção** | Pizzaiolo | Visualiza fila de produção, avança status do pedido. |
| **Entregador** | Motoboy | Vê pedidos prontos para entrega, marca "a caminho" e "entregue". |

> Os papéis acima são **sugestões de Perfis-modelo**. O sistema de Perfis (item 5.3) permite criar/ajustar permissões livremente. Funcionário sem acesso à ferramenta (ex.: ajudante de cozinha) é cadastrado apenas como registro de RH, sem login e sem perfil, conforme você descreveu.

---

## 4. Conceito de multi-tenancy (decisão estrutural)

A hierarquia proposta:

```
Super Admin (plataforma)
   └── Tenant = Pizzaria (cliente/assinante)
          └── Filial 1, Filial 2, ... (unidades)
                 └── Funcionários, Pedidos, Estoque (sempre ligados a uma filial)
```

Pontos-chave:

- **Tenant** é a unidade de cobrança e isolamento de dados. Uma pizzaria com 3 unidades é **um** tenant com **3 filiais**.
- Cardápio e clientes podem ser **compartilhados no nível do tenant** ou **específicos por filial** (decisão em aberto, ver item 13). Recomendação: cardápio por filial (preços variam por unidade), cliente compartilhado no tenant.
- Estoque e pedidos são **sempre por filial**.
- Isolamento de dados entre tenants é requisito de segurança não negociável.

---

## 5. Requisitos funcionais — Plataforma core

### 5.1 Autenticação e login

- Login por e-mail + senha para usuários administrativos.
- Recuperação de senha por e-mail.
- Sessão com expiração e "lembrar-me".
- Recomendado para depois: 2FA opcional, login social, e magic link para perfis operacionais (entregador) que não querem decorar senha.
- Após login, o usuário cai no contexto da filial à qual pertence; perfis multi-filial escolhem a unidade.

**Regras**
- Bloqueio temporário após N tentativas inválidas.
- Toda autenticação registrada em log de auditoria.

### 5.2 CRUD de Filiais

Campos sugeridos: nome/apelido da unidade, CNPJ, endereço completo, telefone, horário de funcionamento, raio/área de entrega, taxa de entrega, status (ativa/inativa).

**Integração de busca por CNPJ**
Ao informar o CNPJ, o sistema consulta automaticamente uma API pública (BrasilAPI ou ReceitaWS) e preenche razão social, endereço e telefone. Todos os campos permanecem editáveis após o preenchimento automático, dado que a qualidade dos dados da Receita Federal pode variar.

**Regras**
- Só Admin do Tenant (ou Super Admin) cria/edita filiais.
- Não permitir exclusão de filial com pedidos históricos; usar **inativação** (soft delete) para preservar histórico.

### 5.3 CRUD de Perfis e Permissões (RBAC) — escopo Super Admin / Admin

Modelo recomendado: **Perfil → conjunto de Permissões**, onde permissão é a tupla `recurso + ação` (ex.: `pedido:criar`, `cliente:editar`, `estoque:ler`, `analytics:ver`).

- **Super Admin** mantém Perfis-modelo (templates) que já vêm prontos para cada tenant novo.
- **Admin do Tenant** pode clonar/ajustar perfis dentro da própria pizzaria.
- Cada usuário recebe um perfil; o perfil define o que ele vê e faz.
- Permissões devem ser granulares o suficiente para o caso "vê pedidos mas não vê faturamento".

**Por que granular desde o início:** RBAC é o tipo de coisa que dói muito refatorar depois. Vale nascer bem modelado mesmo que a interface comece simples (só os perfis-modelo).

### 5.4 CRUD de Funcionários / Usuários

Campos: nome, CPF, cargo, filial(is) vinculada(s), contato, **tem acesso à ferramenta? (sim/não)**, perfil (obrigatório só se tiver acesso), status.

**Regras**
- Se "tem acesso à ferramenta" = não, o registro existe apenas para RH/operação, sem credenciais e sem perfil (exatamente como você descreveu).
- Se "tem acesso" = sim, exige e-mail e perfil.
- Vínculo a filial controla o que o funcionário enxerga.

### 5.5 Motor de Notificações (WhatsApp, SMS, E-mail) — o coração do produto

Tratado em detalhe no item 7. No core, fica a abstração: um serviço único de notificação que recebe um evento (ex.: "pedido mudou para EM_PRODUCAO") e dispara o canal/template configurado, com registro de status (enviado, entregue, lido, falhou).

### 5.6 Billing / Assinatura (fase posterior, mas reservar lugar)

Plano por tenant, possivelmente por número de filiais ou volume de mensagens. Não é MVP, mas o modelo de dados deve antecipar `plano`, `assinatura`, `limite_mensagens`.

---

## 6. Requisitos funcionais — Módulo Pizzaria

### 6.1 CRUD de Clientes

- **Chave de negócio: telefone** (com normalização para padrão E.164, ex.: +5511999998888). Use telefone como identificador de busca, mas mantenha um ID interno como chave primária técnica.
- Campos: telefone, nome, e-mail (opcional), endereço(s) de entrega (um cliente pode ter vários), data de nascimento (opcional, útil para campanha de aniversário), **alerta de saúde/alergia** (ex.: "alérgico a amendoim" — exibido como aviso ao abrir a ficha no momento do pedido), **consentimento de contato por WhatsApp/SMS (opt-in, LGPD)**.

> **Nota:** observações do tipo "sem cebola" pertencem ao item do pedido, não ao cliente. O campo `alerta_saude` é reservado para informações permanentes e críticas que o atendente deve ver sempre que abrir a ficha.
- Histórico de pedidos do cliente acessível na ficha.
- Busca rápida por telefone no momento de criar pedido: digitou o número, já traz nome e endereço.

**Regras**
- Telefone único por tenant.
- Opt-in de marketing separado do opt-in transacional (são bases legais diferentes na LGPD; ver item 8).

### 6.2 CRUD de Pizzas / Produtos (cardápio)

Mesmo o nicho sendo pizzaria, o cardápio precisa comportar bebidas, bordas, sobremesas. Sugestão de modelar como **Produto** com **Categoria** (Pizza, Bebida, Borda, Sobremesa).

Campos da pizza: nome, categoria, descrição, **tamanhos** (broto/média/grande/família) com preço por tamanho, sabores disponíveis, possibilidade de **meio a meio** (regra de preço: maior valor entre os dois sabores, ou média — decisão de negócio), adicionais/bordas, foto, disponibilidade (ativo/esgotado), **ficha técnica / insumos consumidos** (liga ao estoque, ver 6.4).

**Regras**
- Preço sempre por tamanho.
- Meio a meio precisa de regra de precificação explícita e configurável.
- "Esgotado" some do cardápio de pedido mas não é excluído.

### 6.3 CRUD de Pedidos

O módulo mais importante operacionalmente. Um pedido tem cabeçalho + itens.

**Cabeçalho:** cliente (por telefone), filial, **modalidade (entrega / retirada / consumo no local)**, endereço de entrega, forma de pagamento (dinheiro/cartão/PIX), troco para, `valor_frete`, `codigo_cupom`, `valor_desconto`, `subtotal_produtos` (soma dos itens), `subtotal_adicionais` (soma dos adicionais de todos os itens), `valor_impostos` (reservado, null no MVP), `total` (calculado), status, timestamps de cada transição.

**Itens:** produto, tamanho, sabor(es), adicionais, quantidade, observações (ex.: "sem cebola"), `preco_produto` (preço base do produto/tamanho), `preco_adicionais` (soma dos adicionais do item), `preco_total_item` (produto + adicionais × quantidade).

> O cabeçalho agrega os valores dos itens. O detalhamento financeiro fica no nível do item; o cabeçalho é a soma. Isso permite análises de ticket separando receita de produtos e receita de adicionais.

> `valor_impostos` existe no schema desde o início como null para não exigir refatoração futura quando a questão fiscal for endereçada.

**Máquina de estados (ver item 9):** cada transição pode disparar uma notificação ao cliente.

**Regras**
- Cálculo automático de todos os subtotais e total — nunca deixar o front calcular sem confirmar no backend.
- Pedido cancelado mantém histórico (soft delete) e, se configurado, devolve insumos ao estoque.
- Edição de pedido após "em produção" deve ser restrita/auditada.

#### Tela de criação de pedido — layout e UX

Layout em duas colunas fixas:
- **Coluna esquerda (~65%):** cliente + busca de itens + cardápio
- **Coluna direita (~35%):** resumo do pedido (carrinho), totais e confirmação

**Seção cliente:** campo de telefone com máscara `(11) 99999-9999` e botão "Consultar". Ao encontrar o cliente, exibe card com nome, telefone e endereço principal. Mesma lógica do modal de clientes (verifica duplicatas, preenche automaticamente se já existe).

**Busca no cardápio:** campo de input com ícone de lupa acima das abas de categoria. Ao digitar, filtra todos os itens por nome ou descrição, ignorando a aba ativa. Ao limpar o campo, retorna ao estado das abas.

**Abas de categoria:** pills horizontais (Todos · Pizzas · Bebidas · Bordas · Sobremesas…). Filtram o grid quando não há texto na busca.

**Grid de produtos:** 2 colunas. Cada card exibe nome, descrição curta, foto (ícone mk-wedge quando sem foto) e os botões de tamanho com preço (P · M · G · F). Produtos esgotados aparecem com overlay cinza e badge "Esgotado", não são clicáveis. Produtos inativos não aparecem.

#### Fluxo de pizza meio a meio

**Regra base:** uma pizza só pode compor meio a meio se o campo `permite_meio_a_meio = true` no cadastro do produto. Todos os produtos aparecem no cardápio — a diferença está no botão de ação.

**Passo 1 — Selecionar o primeiro sabor:**
O operador clica em um tamanho (ex: G · R$ 56,90). Um card de pré-seleção aparece no resumo (coluna direita) com dois botões:
- **"Adicionar inteiro"** — adiciona o item completo ao carrinho normalmente
- **"½ + ½"** — disponível e clicável apenas se `permite_meio_a_meio = true`; desabilitado com tooltip *"Este sabor não permite meio a meio"* quando false

**Passo 2 — Modo ½+½ ativo:**
Ao clicar em "½ + ½", o carrinho entra em estado *aguardando segundo sabor*. O card de pré-seleção mostra:
- "½ [Nome do sabor 1]" com o tamanho travado (não pode ser alterado)
- O primeiro sabor **não desaparece** ao navegar, pesquisar ou mudar de aba no cardápio

**Passo 3 — Selecionar o segundo sabor:**
No grid de produtos, ao invés dos botões de tamanho, cada card exibe um botão **"Adicionar como ½"**. Produtos que não aceitam meio a meio mostram o botão desabilitado com tooltip *"Este sabor não permite meio a meio"*. O operador clica em qualquer produto com `permite_meio_a_meio = true` para compor a segunda metade.

**Passo 4 — Item composto no carrinho:**
O item entra no carrinho como:
> **½ Calabresa + ½ Margherita** · Grande
> Preço = maior valor entre os dois sabores para o tamanho selecionado

O operador pode cancelar a seleção em qualquer passo, voltando ao estado normal do carrinho.

**Regra de preço meio a meio:** maior valor entre os dois sabores para o tamanho escolhido (regra padrão; configurabilidade por tenant é item de roadmap futuro — ver item 13, decisão 6).

### 6.4 CRUD de Estoque de Produtos / Insumos

Dois níveis a decidir (ver item 13):

1. **Estoque simples:** controle de itens vendáveis prontos (ex.: lata de refrigerante).
2. **Estoque por ficha técnica:** cada pizza consome insumos (queijo, molho, massa), e a venda baixa o estoque dos insumos. Mais poderoso, mais complexo.

Recomendação para o MVP: começar com **estoque simples + ficha técnica opcional**, evoluindo para baixa automática por ficha técnica na fase 2.

Campos: insumo/produto, unidade de medida (gramas, unidades, ml, etc.), quantidade atual, **estoque mínimo (alerta)**, custo, fornecedor (opcional), filial.

A ficha técnica (`ficha_tecnica`) registra a quantidade em gramas (ou na unidade do insumo) consumida por pizza/produto. Isso permite:

- Calcular quantas pizzas de cada tipo o estoque atual comporta.
- **Projeção por dia da semana (Fase 2):** cruzando a ficha técnica com o histórico de vendas (média das últimas N sextas-feiras, por exemplo), o sistema projeta se o estoque atual cobre a demanda esperada do próximo período de pico e antecipa o alerta antes que o insumo acabe.

**Regras**
- Alerta quando estoque atual < mínimo configurado.
- Alerta preditivo (Fase 2): quando a projeção indica que o estoque não cobre a demanda estimada para os próximos dias.
- Movimentações registradas (entrada, saída por venda, ajuste, perda).

### 6.5 Módulo de Análise / Dashboards

Visões sugeridas, todas filtráveis por período e filial:

- Pizzas/produtos mais vendidos (ranking + gráfico de barras).
- Faturamento por dia/semana/mês (linha).
- Ticket médio.
- Distribuição por modalidade (entrega vs retirada vs local).
- Horários de pico (heatmap dia x hora).
- Taxa de entrega de notificações WhatsApp e tempo médio de cada etapa do pedido (diferencial: provar que o cliente está sendo bem informado).
- Clientes recorrentes vs novos.

**Alertas operacionais inteligentes (Fase 2 / data mining)**

O `pedido_status_hist` grava o timestamp de cada transição. Com esse dado, é possível:

- Calcular o tempo médio de cada etapa (ex.: EM_PRODUCAO → PRONTO) com base em janela histórica (últimas N semanas).
- Comparar a média recente (últimos 7 dias) com o baseline histórico.
- Disparar alerta para o Admin/Gerente quando uma etapa estiver consistentemente acima do threshold configurável (ex.: 30% acima da média).

Exemplos de insight:
- "O tempo de EM_PRODUCAO→PRONTO passou de 4 min para 6 min nos últimos 3 dias."
- "O status PRONTO→SAIU_PARA_ENTREGA está demorando 15 min acima da média — possível gargalo na saída dos entregadores."

**Integração com LLM para análise ativa (add-on / Fase 3)**

Como camada opcional e premium, os dados agregados de performance operacional (sem dados pessoais brutos) podem ser enviados a um modelo LLM (ex.: Claude Haiku para custo controlado) que gera uma análise textual contextualizada sobre os gargalos identificados e sugere ações. O consumo seria limitado por tenant e por plano, podendo ser oferecido como add-on de assinatura.

**Regras**
- Respeitar permissão `analytics:ver` (nem todo perfil enxerga faturamento).
- Dados sempre escopados ao tenant/filial do usuário.
- Alertas operacionais disponíveis apenas para Admin e Gerente de Filial.

---

## 7. Integração WhatsApp / SMS / E-mail (detalhamento)

Este é o diferencial central, então merece atenção especial. Há decisões técnicas e regulatórias importantes.

### 7.1 WhatsApp

Existem dois caminhos principais:

| Opção | Prós | Contras |
|---|---|---|
| **WhatsApp Cloud API (oficial Meta)** | Oficial, estável, escalável, sem risco de ban | Exige aprovação de conta Business, templates pré-aprovados, custo por conversa, processo de onboarding |
| **Provedores BSP (Twilio, 360dialog, Z-API, etc.)** | Onboarding mais fácil, abstraem a API | Custo adicional do intermediário; alguns não oficiais têm risco |

**Recomendação:** ir de API oficial (Cloud API ou via BSP oficial). Evitar bibliotecas não oficiais (risco de banimento da conta do cliente, o que seria desastroso para um SaaS).

**Conceitos críticos a embutir no produto:**

- **Templates (HSM):** mensagens proativas (fora da janela de 24h) precisam de template pré-aprovado pela Meta. As mensagens de status de pedido ("sua pizza saiu para entrega") são proativas, logo **precisam ser templates aprovados**. Isso precisa estar no roadmap de operação, não é só código.
- **Janela de 24h:** se o cliente responder, abre-se uma janela de 24h para conversa livre. Útil se quiser permitir confirmação de pedido por resposta.
- **Opt-in obrigatório:** o cliente precisa ter consentido em receber mensagens. Liga ao campo de consentimento do cadastro (item 6.1) e à LGPD.
- **Custo por conversa:** o modelo de cobrança da Meta é por conversa iniciada. Isso impacta o billing do seu SaaS (quem paga a conversa: você repassa ou inclui no plano?).

### 7.2 SMS e E-mail

- **SMS:** fallback para quando o cliente não tem WhatsApp ou a mensagem falha. Provedores: Zenvia, Twilio, AWS SNS. Custo por SMS.
- **E-mail:** mais para confirmação de pedido detalhada, recibo, e comunicação com o admin da pizzaria. Provedores: Amazon SES, Resend, SendGrid.

### 7.3 Arquitetura de notificação (recomendada)

```
Evento de pedido  →  Motor de Notificação  →  seleciona canal+template
                                            →  fila/worker (assíncrono)
                                            →  provedor (WhatsApp/SMS/Email)
                                            →  registra status (enviado/entregue/lido/falhou)
                                            →  fallback se falhar (ex.: WhatsApp falhou → SMS)
```

Pontos:
- Disparo **assíncrono** (fila), nunca travando a criação do pedido.
- **Webhooks de status** do provedor atualizam o registro (entregue/lido).
- Templates configuráveis por tenant (a pizzaria pode personalizar o texto dentro do limite do template aprovado).
- Mapa configurável: qual transição de status dispara qual mensagem.

---

## 8. Requisitos não-funcionais

### 8.1 Segurança
- Isolamento total de dados entre tenants.
- Senhas com hash forte (bcrypt/argon2), nunca em texto puro.
- HTTPS em tudo; segredos fora do código.
- Autorização verificada no backend a cada requisição (nunca confiar só no front).

### 8.2 LGPD (importante, dado o volume de dados pessoais)
- **Base legal:** notificação transacional de pedido tende a se apoiar em execução de contrato/legítimo interesse; **marketing exige consentimento explícito**. Separe os dois opt-ins.
- Direito de o cliente solicitar exclusão dos dados.
- Política de retenção de dados de pedidos.
- Registro de consentimento (quando, como, qual canal).
- O dono da pizzaria é controlador; você (plataforma) é operador. Vale um contrato/termo refletindo isso.

### 8.3 Disponibilidade e performance
- Operação de balcão não pode ficar lenta no horário de pico (sexta/sábado à noite).
- Notificações assíncronas para não impactar a UX do caixa.
- Backups automáticos e plano de recuperação.

### 8.4 Auditoria
- Log de quem fez o quê (criou/editou/cancelou pedido, alterou estoque, mudou perfil).

### 8.5 Observabilidade
- Métricas de entrega de mensagens (essencial, é o produto).
- Alertas de falha de integração com provedores.

---

## 9. Máquina de estados do pedido (núcleo do diferencial)

| Estado | Significado | Notificação ao cliente |
|---|---|---|
| `RECEBIDO` | Pedido criado | "Recebemos seu pedido! 🍕" |
| `CONFIRMADO` | Pizzaria aceitou | "Pedido confirmado, já vamos preparar" |
| `EM_PRODUCAO` | Na cozinha | "Sua pizza está sendo preparada" |
| `PRONTO` | Pronto (retirada/saída) | Retirada: "Pode buscar"; Entrega: aguarda saída |
| `SAIU_PARA_ENTREGA` | Com o entregador | "Saiu para entrega, chega em ~X min" |
| `ENTREGUE` / `CONCLUIDO` | Finalizado | "Bom apetite! Avalie seu pedido" |
| `CANCELADO` | Cancelado | "Seu pedido foi cancelado" + motivo |

**Regras**
- Transições válidas configuráveis (não dá pra ir de RECEBIDO direto a ENTREGUE).
- Cada transição grava timestamp (alimenta o analytics de tempo por etapa).
- Cada transição consulta o mapa de notificação e dispara (ou não) a mensagem.
- O texto enviado deve respeitar os templates aprovados do WhatsApp.
- O status `ENTREGUE` **não é obrigatório como ação do motoboy** — o ciclo do pedido não trava por falta dessa marcação. O motoboy pode marcar manualmente ao concluir a entrega, mas se não o fizer, o sistema avança automaticamente para `ENTREGUE` após um tempo configurável pelo tenant (padrão sugerido: 90 minutos após `SAIU_PARA_ENTREGA`). Isso garante que o WhatsApp de conclusão seja enviado e o analytics seja alimentado mesmo sem ação do entregador.

---

## 10. Stack tecnológica sugerida

Proposta enxuta e moderna, fácil de evoluir e que cobre bem multi-tenancy:

| Camada | Decisão | Observação |
|---|---|---|
| Frontend (admin) | Next.js (React) + TypeScript | App responsivo; balcão pode rodar em tablet |
| UI | Tailwind + shadcn/ui | Agiliza padronização entre nichos |
| Backend/API | Next.js API routes | Full-stack no mesmo projeto; simplifica o MVP |
| Banco | **Supabase (PostgreSQL)** | Já usado para Auth — centraliza a operação |
| ORM | **Drizzle** | |
| Auth | **Supabase Auth** | Já incluso no Supabase |
| Fila/jobs | **Database Webhooks → Supabase Edge Functions** | MVP sem custo adicional; migra para BullMQ+Redis se volume exigir retry sofisticado |
| WhatsApp | **Cloud API oficial (Meta)** | Ver item 7; API oficial desde o início |
| SMS | Zenvia / Twilio | Fallback |
| E-mail | **Resend** | Tier gratuito cobre bem o MVP; migração de plano/serviço conforme crescimento |
| Infra | **Vercel + Supabase** | Simplicidade operacional; Supabase cobre banco, auth e storage |

**Multi-tenancy:** coluna `tenant_id` em todas as tabelas + RLS no Supabase. Caminho mais simples de operar e recomendado para começar — escala bem para o volume de uma boutique SaaS com muitos tenants pequenos. Schema por tenant só faria sentido se houvesse exigência regulatória de isolamento físico, o que não é o caso aqui.

**Arquitetura de módulos:** estrutura de pastas e banco separados entre `/core` (auth, tenants, usuários, perfis, notificações) e `/modules/pizzaria` (cardápio, pedidos, estoque) desde o início. Abstrações e interfaces genéricas somente quando o segundo nicho chegar — por ora, separação via estrutura, não via padrões complexos.

---

## 11. Esboço do modelo de dados

Entidades principais (alto nível, não é o DDL final):

```
PLATAFORMA CORE
- tenant            (id, nome, plano_id, status)
- plano             (id, nome, limite_filiais, limite_mensagens, preco)
- filial            (id, tenant_id, nome, cnpj, endereco, taxa_entrega, ...)
- usuario           (id, tenant_id, nome, email, senha_hash, tem_acesso, perfil_id, status)
- usuario_filial    (usuario_id, filial_id)        // vínculo N:N
- perfil            (id, tenant_id|null, nome, is_template)
- permissao         (id, recurso, acao)            // ex.: pedido, criar
- perfil_permissao  (perfil_id, permissao_id)
- notificacao       (id, tenant_id, pedido_id, canal, template, status, enviado_em, ...)
- log_auditoria     (id, tenant_id, usuario_id, acao, entidade, antes, depois, criado_em)

MÓDULO PIZZARIA
- cliente           (id, tenant_id, telefone, nome, email, alerta_saude,
                     opt_in_transacional, opt_in_marketing, ...)
- endereco_cliente  (id, cliente_id, logradouro, ...)
- categoria         (id, tenant_id, nome)           // Pizza, Bebida, Borda...
- produto           (id, filial_id|tenant_id, categoria_id, nome, ativo, ...)
- produto_tamanho   (id, produto_id, tamanho, preco)
- sabor             (id, produto_id, nome, preco_extra)
- ficha_tecnica     (produto_id, insumo_id, quantidade)   // liga estoque
- pedido            (id, filial_id, cliente_id, modalidade, status,
                     subtotal_produtos, subtotal_adicionais, valor_frete,
                     codigo_cupom, valor_desconto, valor_impostos,
                     total, pagamento, troco_para, criado_em, ...)
- pedido_status_hist(id, pedido_id, status, criado_em)    // alimenta analytics
- item_pedido       (id, pedido_id, produto_id, tamanho, sabores, adicionais,
                     qtd, obs, preco_produto, preco_adicionais, preco_total_item)
- insumo            (id, filial_id, nome, unidade, qtd_atual, qtd_minima, custo)
- mov_estoque       (id, insumo_id, tipo, quantidade, motivo, criado_em)
```

---

## 12. Roadmap proposto (fases)

**Fase 0 — Fundação (core reaproveitável)**
- Multi-tenancy, login, RBAC com perfis-modelo, CRUD de filiais e funcionários.

**Fase 1 — MVP Pizzaria**
- CRUD de clientes (chave telefone), cardápio (produto + tamanhos + sabores), pedidos com máquina de estados, estoque simples.
- **Notificação WhatsApp nas transições de status** (o diferencial já no MVP).
- Dashboard básico (mais vendidos + faturamento).

**Fase 2 — Diferenciação**
- Fallback SMS/e-mail, baixa de estoque por ficha técnica, projeção preditiva de estoque por dia da semana, analytics avançado (tempos por etapa, picos), alertas operacionais de gargalo (baseline × média recente), templates configuráveis por tenant.
- **Módulo de logística inteligente:** o operador seleciona quais pedidos prontos saem juntos, o sistema calcula e exibe a rota otimizada com base nos endereços. Registro do motoboy é opcional — não obrigatório para liberar a rota, para não travar a operação. Fluxo: (1) tela/modal de seleção de pedidos prontos → (2) tela de rota otimizada com mapa + lista de paradas ordenadas + campo opcional de motoboy. Integração com API de mapas (Google Maps ou similar). Design da tela a ser feito ainda nesta fase, antes do desenvolvimento.

**Fase 3 — Escala/comercial**
- Billing/assinatura, cardápio digital público para o cliente final pedir sozinho, integração LLM para análise ativa de operação (add-on premium), multi-nicho (segundo vertical reusando o core).
- **Modo offline (aplicação companion PWA):** Progressive Web App separado e leve, com as funcionalidades essenciais para operação sem internet — criar cliente e criar pedido. Escolha de PWA pela simplicidade: sem instalação manual, funcionalidades limitadas cobrem bem o caso de uso. Ao reestabelecer conexão, sincroniza com o sistema principal via rotina de sync. Rotinas de atualização diária entre as duas ferramentas. Decisões técnicas de conflito de dados e estratégia de sync a definir antes do desenvolvimento.

---

## 13. Premissas e decisões em aberto (validar com você)

Estas decisões mudam o desenho; vale confirmar antes das telas:

1. ✅ **Canal de pedido:** MVP com **atendente** (balcão/telefone); cardápio público para o cliente final na Fase 3.
2. ✅ **Modalidades:** entrega, retirada e consumo no local — **todas no MVP**.
3. ✅ **Pagamento:** sistema apenas **registra** a forma de pagamento no MVP. Integração com gateway em fase futura.
4. ✅ **Estoque:** começa **simples** (sem ficha técnica obrigatória no MVP); ficha técnica + baixa automática + projeção preditiva na Fase 2.
5. ✅ **Cardápio:** **por filial** (preços variam por unidade).
6. ✅ **Meio a meio:** regra padrão é **maior valor entre os sabores**. Configurabilidade por tenant é item de roadmap futuro.
7. ✅ **WhatsApp:** **API oficial (Meta Cloud API)** desde o início. Mais burocrático no onboarding, mas sem risco de banimento.
8. ⏳ **Custeio das mensagens WhatsApp:** decisão pendente. O modelo de dados já prevê `limite_mensagens` no plano para suportar qualquer direção (incluso no plano, cobrado por volume, ou add-on). Definição para quando houver mais clareza sobre o modelo comercial.

---

*Documento vivo. À medida que validarmos as decisões do item 13, ele evolui para a base das telas e do desenvolvimento.*
