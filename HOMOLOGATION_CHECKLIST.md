# Checklist de Homologacao Real

Este checklist define as tarefas antes do deploy de producao do Traz Pra Ca.
O objetivo desta fase nao e publicar para usuarios finais, e sim validar o
fluxo completo com servicos reais em ambiente controlado.

## 1. Escopo da homologacao

- Usar 1 lojista real ou piloto.
- Usar 1 cliente de teste.
- Usar 1 motoboy escalado pelo admin.
- Validar pedido completo via pagina publica da loja: `/store/{merchantId}`.
- Validar o marketplace da cidade como canal adicional, nao como dependencia principal.
- Manter WhatsApp como canal oficial de comunicacao.

## 2. Banco PostgreSQL / Supabase

- Criar projeto Supabase para homologacao.
- Usar somente PostgreSQL gerenciado nesta fase.
- Nao migrar autenticacao para Supabase Auth neste momento.
- Configurar `DATABASE_URL` do backend com usuario e senha de banco adequados.
- Aplicar migrations Prisma no banco:

```bash
npm run prisma:migrate --prefix packages/backend
```

- Validar que as tabelas principais existem:
  - `merchants`
  - `customers`
  - `products`
  - `orders`
  - `order_items`
  - `payment_webhook_events`
  - `payment_refunds`
  - `delivery_assignments`
  - `notifications`
  - `audit_logs`
  - `whatsapp_templates`
- Conferir indices criticos de webhook, pedidos, pagamentos e entregas.
- Confirmar que backups do Supabase estao habilitados conforme o plano escolhido.
- Nao expor tabelas via Data API para uso do frontend neste momento.
- Se algum schema/tabela for exposto no Supabase, habilitar RLS e politicas por papel antes de liberar acesso.

## 3. Redis / filas / worker

- Provisionar Redis/Valkey gerenciado com TLS quando exigido pelo provedor.
- Configurar `REDIS_URL` na API e no worker.
- Rodar API com:
  - `PROCESS_QUEUES=false`
  - `RUN_SCHEDULER=false`
- Rodar worker separado com:
  - `PROCESS_QUEUES=true`
  - `PIX_SWEEP_INTERVAL_MS=60000`
- Confirmar que notificacoes WhatsApp entram na fila.
- Confirmar que jobs falhos ficam rastreaveis no painel/admin ou logs.
- Simular motoboy sem resposta e validar timeout/retry para proximo motoboy.

## 4. Mercado Pago sandbox

- Criar app OAuth do Mercado Pago para homologacao.
- Configurar redirect URI:

```text
https://api-homologacao.seudominio.com/api/payments/oauth/callback
```

- Configurar webhook:

```text
https://api-homologacao.seudominio.com/api/payments/webhook/mercadopago?secret=VALOR_DE_MERCADO_PAGO_WEBHOOK_SECRET
```

- Preencher no backend:
  - `MERCADO_PAGO_ACCESS_TOKEN`
  - `MERCADO_PAGO_CLIENT_ID`
  - `MERCADO_PAGO_CLIENT_SECRET`
  - `MERCADO_PAGO_REDIRECT_URI`
  - `MERCADO_PAGO_WEBHOOK_SECRET`
- Preencher no frontend:
  - `VITE_MERCADO_PAGO_PUBLIC_KEY`
- Conectar a conta Mercado Pago do lojista pelo painel.
- Testar Pix aprovado.
- Testar Pix pendente.
- Testar pagamento rejeitado/cancelado.
- Testar cartao aprovado.
- Testar cartao rejeitado.
- Testar webhook duplicado e confirmar idempotencia.
- Testar pedido pago recusado pelo lojista e confirmar refund.
- Confirmar que `MOCK_PAYMENT` nao esta ativo no ambiente de homologacao real.

## 5. WhatsApp Cloud API

- Configurar app Meta/WhatsApp Cloud API para homologacao.
- Configurar webhook da Meta apontando para:

```text
https://api-homologacao.seudominio.com/api/whatsapp/webhook
```

- Preencher no backend:
  - `WHATSAPP_PHONE_NUMBER_ID`
  - `WHATSAPP_ACCESS_TOKEN`
  - `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
  - `WHATSAPP_APP_SECRET`
- Validar assinatura `X-Hub-Signature-256` nos callbacks.
- Criar/aprovar templates necessarios na Meta quando exigido.
- Testar envio de OTP para cliente.
- Testar notificacao de pedido para lojista.
- Testar notificacao de pedido aceito para cliente.
- Testar notificacao de pedido recusado para cliente.
- Testar pedido pronto e envio para motoboy.
- Testar aceite/rejeicao do motoboy pelo link assinado.
- Confirmar que falhas de envio aparecem em `notifications` e no painel operacional.

## 6. Variaveis obrigatorias da API

- `NODE_ENV=production`
- `DATABASE_URL`
- `REDIS_URL`
- `FRONTEND_URL`
- `API_PUBLIC_URL`
- `JWT_SECRET`
- `ENCRYPTION_KEY`
- `DELIVERY_RESPONSE_SECRET`
- `MERCADO_PAGO_WEBHOOK_SECRET`
- `MERCADO_PAGO_ACCESS_TOKEN`
- `MERCADO_PAGO_CLIENT_ID`
- `MERCADO_PAGO_CLIENT_SECRET`
- `MERCADO_PAGO_REDIRECT_URI`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
- `WHATSAPP_APP_SECRET`
- `UPLOADS_PUBLIC_URL`
- `SERVICE_CITY=Rondon`
- `SERVICE_STATE=PR`
- `PLATFORM_DELIVERY_FEE=5`
- `PLATFORM_COMMISSION_RATE=0`
- `DELIVERER_PAY_PER_DELIVERY=0`

## 7. Frontend homologacao

- Configurar `VITE_API_URL` apontando para a API de homologacao.
- Configurar `VITE_DELIVERY_FEE=5`.
- Configurar `VITE_MERCADO_PAGO_PUBLIC_KEY`.
- Validar login/cadastro do cliente por WhatsApp.
- Validar login do lojista.
- Validar dashboard do lojista.
- Validar secao "Divulgar minha loja".
- Validar copia do link publico da loja.
- Validar compra pela URL publica `/store/{merchantId}`.
- Validar tela de acompanhamento do pedido.
- Validar painel admin para incidentes operacionais.

## 8. Storage de imagens

- Para homologacao simples, upload local pode ser usado se o provedor tiver disco persistente.
- Para ambiente mais proximo de producao, configurar storage externo:
  - Supabase Storage
  - Cloudflare R2
  - S3
  - DigitalOcean Spaces
- Confirmar validacao de tipo/tamanho de imagem.
- Confirmar URL publica de logo, banner e produtos.
- Confirmar que arquivos nao somem apos restart/deploy.

## 9. LGPD, termos e politica

- Publicar Politica de Privacidade.
- Publicar Termos de Uso.
- Validar consentimento no cadastro de cliente.
- Validar consentimento no cadastro de lojista.
- Documentar retencao de:
  - telefones
  - enderecos
  - pedidos
  - logs de auditoria
  - referencias de pagamento
- Definir processo administrativo para pedido de exclusao de dados.
- Confirmar que respostas da API nao expõem senha, CPF/CNPJ cru, tokens ou dados sensiveis.

## 10. Roteiro de teste ponta a ponta

1. Admin cria ou valida motoboy.
2. Admin escala motoboy para o dia.
3. Lojista cria conta.
4. Lojista aceita termos.
5. Lojista configura loja, horarios, imagens e produtos.
6. Lojista conecta Mercado Pago.
7. Lojista ativa assinatura.
8. Lojista copia o link em "Divulgar minha loja".
9. Cliente acessa `/store/{merchantId}`.
10. Cliente monta carrinho.
11. Cliente valida WhatsApp.
12. Cliente paga por Pix.
13. Webhook confirma pagamento.
14. Lojista recebe notificacao.
15. Lojista aceita pedido.
16. Cliente recebe WhatsApp de pedido aceito.
17. Lojista marca pedido pronto.
18. Sistema envia pedido para motoboy.
19. Motoboy aceita entrega.
20. Pedido avanca para entrega.
21. Pedido e finalizado.
22. Admin confere auditoria, notificacoes e incidentes.

## 11. Criterios para liberar deploy de producao

- Todos os testes automatizados passam.
- Build frontend passa.
- Migrations aplicadas em banco real sem erro.
- Pedido online aprovado funciona de ponta a ponta.
- Pedido recusado pelo lojista gera refund ou incidente operacional claro.
- Webhook duplicado nao duplica pedido, pagamento ou refund.
- WhatsApp envia mensagens reais e registra falhas.
- Worker processa filas reais.
- Motoboy nao recebe duplicidade apos aceite.
- Admin consegue enxergar falhas operacionais.
- Lojista consegue divulgar loja via link publico.
- Termos e politica estao publicados.
- Secrets reais estao fora do repositorio.
- Backups do banco estao configurados.
- Existe plano de rollback.

## 12. Decisao tecnica atual

Supabase atende bem como PostgreSQL gerenciado para homologacao e MVP. A melhor
decisao agora e usar Supabase Database primeiro, sem substituir a autenticacao
existente. Supabase Storage pode ser adotado depois para imagens, se o provedor
do backend nao oferecer disco persistente confiavel.
