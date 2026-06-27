# Deploy do Z Entrega

## Arquitetura recomendada

- Frontend: Vercel.
- Backend API: serviço web Node.js.
- Worker: processo separado para filas, WhatsApp, timeout de motoboy e expiração de PIX.
- Banco: PostgreSQL gerenciado, como Supabase ou DigitalOcean Managed PostgreSQL.
- Redis/Valkey: serviço gerenciado, como Upstash, Render Key Value, Railway Redis ou DigitalOcean Managed Caching.

## Serviços

### API

Diretório: `packages/backend`

Build:

```bash
npm ci
npm run build
```

Start:

```bash
npm run start
```

Variáveis obrigatórias:

- `NODE_ENV=production`
- `DATABASE_URL`
- `REDIS_URL`
- `FRONTEND_URL`
- `API_PUBLIC_URL`
- `JWT_SECRET`
- `ENCRYPTION_KEY`
- `DELIVERY_RESPONSE_SECRET`
- `MERCADO_PAGO_WEBHOOK_SECRET`
- `PROCESS_QUEUES=false`
- `RUN_SCHEDULER=false`
- `JSON_BODY_LIMIT=2mb`
- `MAX_UPLOAD_BYTES=1500000`
- `UPLOADS_PUBLIC_URL=https://api.seudominio.com/uploads`
- `SERVICE_CITY=Rondon`
- `SERVICE_STATE=PR`
- `PLATFORM_DELIVERY_FEE=5`
- `PLATFORM_COMMISSION_RATE=0`
- `DELIVERER_PAY_PER_DELIVERY=0`
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN`

### Worker

Diretório: `packages/backend`

Build:

```bash
npm ci
npm run build
```

Start:

```bash
npm run start:worker
```

Variáveis obrigatórias:

- `NODE_ENV=production`
- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `ENCRYPTION_KEY`
- `DELIVERY_RESPONSE_SECRET`
- `MERCADO_PAGO_WEBHOOK_SECRET`
- `MERCADO_PAGO_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
- `PROCESS_QUEUES=true`
- `PIX_SWEEP_INTERVAL_MS=60000`

## URLs externas

Configure o frontend da Vercel com:

```bash
VITE_API_URL=https://api.seudominio.com/api
VITE_DELIVERY_FEE=5
VITE_MERCADO_PAGO_PUBLIC_KEY=APP_USR...
```

Configure o Mercado Pago com:

```text
https://api.seudominio.com/api/payments/webhook/mercadopago?secret=VALOR_DE_MERCADO_PAGO_WEBHOOK_SECRET
```

Configure o OAuth do Mercado Pago com:

```text
https://api.seudominio.com/api/payments/oauth/callback
```

## Observações importantes

- Não rode filas no processo da API em produção; use o worker.
- Não deixe `MOCK_PAYMENT=true` em produção.
- A regra comercial atual é cidade piloto `Rondon-PR`, taxa fixa de R$ 5,00 para a plataforma, comissão percentual zero e split automático do Mercado Pago para repasse do lojista em pagamentos online.
- Motoboys são escalados e pagos pelo admin fora do sistema; o app registra operação, notifica e distribui pedidos, mas não faz payout de motoboy.
- Use `rediss://` quando o Redis gerenciado exigir TLS.
- Use segredos longos e diferentes para `JWT_SECRET`, `ENCRYPTION_KEY` e `DELIVERY_RESPONSE_SECRET`.
- O upload local em `/uploads` funciona para MVP/staging, mas pode sumir em plataformas sem disco persistente. Para produção com muitos lojistas, migre imagens para S3, Cloudflare R2, Supabase Storage ou DigitalOcean Spaces.
- Rode migrações antes do primeiro deploy de produção:

```bash
npm run prisma:migrate --prefix packages/backend
```
