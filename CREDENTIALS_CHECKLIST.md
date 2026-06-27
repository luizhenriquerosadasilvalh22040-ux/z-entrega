# Checklist de Credenciais e Dados

Este arquivo separa o que ainda depende de preenchimento manual seu. A regra comercial já está configurada para o MVP: cidade piloto Rondon-PR, taxa fixa de R$ 5,00 para a plataforma, comissão percentual zero, split automático para o lojista via Mercado Pago e motoboys pagos pelo admin fora do sistema.

## Backend API

Preencher na hospedagem do backend:

- `DATABASE_URL`: URL do PostgreSQL.
- `REDIS_URL`: URL do Redis/Valkey.
- `FRONTEND_URL`: URL da Vercel, por exemplo `https://seu-front.vercel.app`.
- `API_PUBLIC_URL`: URL pública da API, por exemplo `https://api.seudominio.com`.
- `JWT_SECRET`: segredo longo e aleatório.
- `ENCRYPTION_KEY`: chave longa para criptografar tokens dos lojistas.
- `DELIVERY_RESPONSE_SECRET`: segredo longo para assinar links dos motoboys.
- `MERCADO_PAGO_WEBHOOK_SECRET`: segredo para proteger o webhook.
- `MERCADO_PAGO_ACCESS_TOKEN`: token da conta marketplace/admin.
- `MERCADO_PAGO_CLIENT_ID`: app OAuth do Mercado Pago.
- `MERCADO_PAGO_CLIENT_SECRET`: app OAuth do Mercado Pago.
- `MERCADO_PAGO_REDIRECT_URI`: `https://api.seudominio.com/api/payments/oauth/callback`.
- `WHATSAPP_PHONE_NUMBER_ID`: ID do número no WhatsApp Cloud API.
- `WHATSAPP_ACCESS_TOKEN`: token da Meta.
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN`: texto secreto para validar webhook do WhatsApp.
- `UPLOADS_PUBLIC_URL`: URL pública dos uploads, por exemplo `https://api.seudominio.com/uploads`.

Valores já definidos para o MVP:

- `SERVICE_CITY=Rondon`
- `SERVICE_STATE=PR`
- `PLATFORM_DELIVERY_FEE=5`
- `PLATFORM_COMMISSION_RATE=0`
- `DELIVERER_PAY_PER_DELIVERY=0`
- `PROCESS_QUEUES=false` na API
- `RUN_SCHEDULER=false` na API

## Worker

Preencher na hospedagem do worker:

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

Valores já definidos para o MVP:

- `PROCESS_QUEUES=true`
- `PIX_SWEEP_INTERVAL_MS=60000`
- `SERVICE_CITY=Rondon`
- `SERVICE_STATE=PR`
- `PLATFORM_DELIVERY_FEE=5`
- `PLATFORM_COMMISSION_RATE=0`
- `DELIVERER_PAY_PER_DELIVERY=0`

## Frontend Vercel

Preencher na Vercel:

- `VITE_API_URL`: `https://api.seudominio.com/api`.
- `VITE_MERCADO_PAGO_PUBLIC_KEY`: public key do Mercado Pago.

Valor já definido para o MVP:

- `VITE_DELIVERY_FEE=5`

## Configurações Externas

Mercado Pago:

- Criar app OAuth.
- Configurar redirect URI: `https://api.seudominio.com/api/payments/oauth/callback`.
- Configurar webhook: `https://api.seudominio.com/api/payments/webhook/mercadopago?secret=VALOR_DE_MERCADO_PAGO_WEBHOOK_SECRET`.
- Cada lojista precisa conectar a própria conta Mercado Pago pelo painel para o split automático funcionar.

WhatsApp Cloud API:

- Configurar webhook da Meta apontando para a API.
- Usar o mesmo `WHATSAPP_WEBHOOK_VERIFY_TOKEN` configurado no backend.
- Validar envio real para cliente, lojista e motoboy.
