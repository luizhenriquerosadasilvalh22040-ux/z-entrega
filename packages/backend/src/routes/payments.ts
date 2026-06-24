import { Router } from 'express';
import { PaymentController } from '../controllers/PaymentController';
import { authenticate } from '../middlewares/auth';

const router = Router();

// Rotas de OAuth do Mercado Pago para lojistas
router.get('/oauth/connect', PaymentController.oauthConnect);
router.get('/oauth/callback', PaymentController.oauthCallback);

// Rotas de Assinatura do Lojista
router.post('/subscription', authenticate, PaymentController.subscribe);
router.post('/subscription/cancel', authenticate, PaymentController.cancelSubscription);

// Rota de Webhook para confirmação de pagamento e assinaturas do Mercado Pago
router.post('/webhook/mercadopago', PaymentController.webhook);

// Rota de validação de cupom (para clientes logados)
router.post('/validate-coupon', authenticate, PaymentController.validateCoupon);

export default router;
