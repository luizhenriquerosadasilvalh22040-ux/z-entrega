import { Router } from 'express';
import { PaymentController } from '../controllers/PaymentController';
import { authenticate } from '../middlewares/auth';

const router = Router();

// Rota de Webhook para confirmação de pagamento do Asaas
router.post('/webhook', PaymentController.webhook);

// Rota de validação de cupom (para clientes logados)
router.post('/validate-coupon', authenticate, PaymentController.validateCoupon);

export default router;
