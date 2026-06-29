import { Router } from 'express';
import { PaymentController } from '../controllers/PaymentController';
import { authenticate } from '../middlewares/auth';
import { validate } from '../middlewares/validation';
import { subscribeSchema, validateCouponSchema } from '../validators/payment';

const router = Router();

// Rotas de OAuth do Mercado Pago para lojistas
router.get('/oauth/connect', authenticate, PaymentController.oauthConnect);
router.get('/oauth/callback', PaymentController.oauthCallback);

// Rotas de Assinatura do Lojista
router.post('/subscription', authenticate, validate(subscribeSchema), PaymentController.subscribe);
router.post('/subscription/cancel', authenticate, PaymentController.cancelSubscription);

// Rota de Webhook para confirmação de pagamento e assinaturas do Mercado Pago
router.post('/webhook/mercadopago', PaymentController.webhook);

// Rota de validação de cupom (para clientes logados)
router.post('/validate-coupon', authenticate, validate(validateCouponSchema), PaymentController.validateCoupon);

export default router;
