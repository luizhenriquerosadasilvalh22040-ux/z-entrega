# Privacy and LGPD Readiness

This project stores personal data for delivery operations: phone numbers,
addresses, order history, payment references, merchant documents and operational
logs. The current implementation must be treated as privacy-aware, not as a
complete legal compliance package.

## Implemented technical controls

- API serializers do not expose password hashes, OTP verification codes, CPF,
  CNPJ or encrypted document values in standard customer, merchant and deliverer
  responses.
- Customer and merchant registration records explicit acceptance timestamps for
  terms of use and privacy policy.
- Marketing consent is stored separately from required operational consent.
- Customer deactivation records a deletion request timestamp for operational
  follow-up.
- Sensitive admin seed behavior requires an explicit `ADMIN_PASSWORD` instead of
  printing generated credentials.

## Required before production

- Publish reviewed Terms of Use and Privacy Policy text in the frontend.
- Link acceptance UI to the backend-required `termsAccepted` and
  `privacyAccepted` flags.
- Define data retention rules for orders, invoices, disputes, audit logs and
  delivery evidence.
- Add an admin workflow for reviewing and completing customer deletion requests.
- Document subprocessors: Mercado Pago, WhatsApp/Meta, hosting provider,
  database provider and observability tools.
- Review operational logs to ensure phone numbers, addresses, tokens and payment
  data are not printed unnecessarily.
- Add a privacy contact channel for data subject requests.
