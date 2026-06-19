import { Router } from 'express';
import { PaymentController } from '../controllers/PaymentController';

const router = Router();

// Rota de Webhook para confirmação de pagamento do Asaas
router.post('/webhook', PaymentController.webhook);

export default router;
