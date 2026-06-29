# Traz Pra Ca - Technical Readiness Summary

This document records the current production-readiness posture after the
architecture hardening round. It is not a deployment approval by itself.

## Strengthened areas

- Order flow now uses controlled status transitions and service boundaries for
  creation, payment sync, notification and delivery dispatch.
- Product availability and stock reservation are enforced server-side.
- Payment webhooks are persisted, sanitized, idempotent and reconciliable.
- Refund flow has explicit pending, success and failure tracking.
- Delivery dispatch records assignments, attempts, acceptance, rejection and
  timeout state.
- WhatsApp sending is behind a notification layer with retry metadata and
  configurable templates.
- Admin dashboard exposes operational incidents for refunds, WhatsApp,
  payments, webhooks, subscriptions and motoboy dispatch.
- Admin operational actions now create audit logs with request context where
  available.
- Runtime production checks prevent server and worker startup without JWT and
  encryption secrets.
- LGPD readiness work exists for data minimization, consent fields and deletion
  request tracking.

## Validation gates currently passing

- Backend build and tests.
- Frontend production build.
- Backend dependency audit at moderate level.
- Whitespace/diff hygiene check.

## Remaining production blockers

- Real Mercado Pago credentials and webhook verification must be tested in a
  homologation environment with real callback URLs.
- Official WhatsApp API credentials, templates and message status callbacks need
  end-to-end testing.
- PostgreSQL migrations must be applied and verified against a real staging
  database before production data exists.
- Redis-backed queues must be verified under the deployed worker process.
- Terms of Use and Privacy Policy text still require legal review and frontend
  publication.
- Data retention rules for orders, audit logs, addresses, payment references and
  deletion requests still need formal policy.

## Recommended next round

- Run staging with one merchant, one customer and one deliverer using real
  PostgreSQL, Redis, Mercado Pago sandbox and WhatsApp sandbox.
- Add integration tests around order creation plus payment webhook plus merchant
  rejection plus refund.
- Add admin workflow for customer deletion request review and completion.
- Add observability around queue depth, failed jobs and webhook retry counts.
- Reduce frontend bundle size after the business-critical backend flows are
  stable.
