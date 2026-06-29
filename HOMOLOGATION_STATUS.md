# Status da Homologacao

Atualizado em: 2026-06-29

Este arquivo registra o estado atual da entrada em homologacao. Nao incluir
segredos, tokens, senhas, chaves privadas ou credenciais reais neste documento.

## Bloco 0 - Preparacao local

Status: concluido.

- Repositorio local limpo antes da execucao.
- Backend build e testes executados com sucesso.
- Frontend build executado com sucesso.
- Checklist de homologacao real criado em `HOMOLOGATION_CHECKLIST.md`.
- Funcionalidade "Divulgar minha loja" commitada e publicada.

Validacoes executadas:

```bash
npm test --prefix packages/backend
npm run build --prefix packages/frontend
```

Resultado:

- Backend: 80 testes passaram.
- Frontend: build passou.
- Aviso conhecido: bundle principal do frontend acima de 500 kB e dynamic import inefetivo em `apiClient.ts`.

## Supabase / PostgreSQL

Projeto identificado:

- Nome: `z-entrega`
- Project ref: `asfjbaheqvjizemwodzl`
- Regiao: `sa-east-1`
- Status: `ACTIVE_HEALTHY`

Estado encontrado inicialmente:

- O banco possui tabelas antigas do dominio.
- A tabela `_prisma_migrations` nao existe.
- A lista de migrations do Supabase esta vazia.

Tabelas criticas presentes:

- `customers`
- `merchants`
- `notifications`
- `orders`
- `products`

Tabelas criticas ausentes:

- `audit_logs`
- `delivery_assignments`
- `payment_refunds`
- `payment_webhook_events`
- `whatsapp_templates`

Decisao tecnica:

- Nao aplicar migrations Prisma via SQL solto pelo MCP do Supabase.
- O projeto usa Prisma; aplicar DDL fora do `prisma migrate deploy` pode gerar drift e quebrar evolucao futura.
- Antes de alterar este banco, obter a `DATABASE_URL` direta do Supabase e decidir uma das estrategias:
  - recriar/limpar banco de homologacao e aplicar `prisma migrate deploy`; ou
  - criar migration de alinhamento cuidadosamente, preservando dados se houver dados importantes.

Recomendacao:

- Para homologacao sem dados importantes, usar um banco limpo ou resetado.
- Aplicar migrations pelo Prisma para criar `_prisma_migrations` corretamente.

Atualizacao em 2026-06-29:

- A conexao direta PostgreSQL foi validada.
- O banco existente tinha dados de teste/piloto e nao foi resetado.
- As migrations SQL incrementais foram aplicadas manualmente com Prisma `db execute`.
- As migrations foram registradas no historico Prisma com `migrate resolve --applied`.
- `prisma migrate status` retornou: `Database schema is up to date!`
- `_prisma_migrations` agora existe.
- As tabelas criticas agora existem:
  - `audit_logs`
  - `delivery_assignments`
  - `payment_refunds`
  - `payment_webhook_events`
  - `whatsapp_templates`
- Colunas criticas de status foram convertidas para enums PostgreSQL:
  - `orders.status`
  - `orders.payment_status`
  - `orders.deliverer_status`
  - `merchants.subscription_status`
  - `deliverers.delivery_status`
  - `notifications.status`
  - `coupons.discountType`

## Mercado Pago sandbox

Status: parcialmente validado.

- Access token de teste validado contra a API oficial do Mercado Pago.
- Resposta HTTP: 200.
- Conta retornou como ativa no site `MLB`/Brasil.

Pendencia observada:

- A conta retornou pendencia `address_pending` em alguns blocos de permissao.
- Antes do teste ponta a ponta, revisar no painel do Mercado Pago se os dados de endereco/cadastro exigidos para cobranca sandbox estao completos.

Nao armazenado:

- Access token.
- Public key.
- Usuario/senha do comprador de teste.
- Codigo de verificacao.

## Bloqueios para Bloco 1

Para iniciar homologacao real com servicos integrados, ainda falta:

- `REDIS_URL` real para worker/fila.
- URL publica de API de homologacao.
- URL publica de frontend de homologacao.
- Credenciais WhatsApp Cloud API.
- Segredos gerados para:
  - `JWT_SECRET`
  - `ENCRYPTION_KEY`
  - `DELIVERY_RESPONSE_SECRET`
  - `MERCADO_PAGO_WEBHOOK_SECRET`
  - `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
  - `WHATSAPP_APP_SECRET`

## Proximo passo recomendado

Executar o Bloco 1 em ordem:

1. Conferir se o admin, lojistas, produtos e motoboys existentes devem ser usados no teste piloto.
2. Configurar Redis e separar API/worker.
3. Configurar ambiente publico de API homologacao.
4. Configurar ambiente publico de frontend homologacao.
5. Configurar Mercado Pago sandbox nas envs.
6. Configurar WhatsApp Cloud API.
7. Executar pedido ponta a ponta com 1 lojista, 1 cliente e 1 motoboy.
