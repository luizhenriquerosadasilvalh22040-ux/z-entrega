import { Router } from 'express';
import { PromotionController } from '../controllers/PromotionController';
import { authenticate } from '../middlewares/auth';
import { validate } from '../middlewares/validation';
import { createPromotionSchema, updatePromotionSchema } from '../validators/promotion';

const router = Router();

// Públicos (ver promoções ativas da loja)
router.get('/merchant/:merchantId', PromotionController.listActiveByMerchant);
router.get('/merchant/:merchantId/all', PromotionController.listByMerchant);

// Protegidos (apenas o próprio lojista)
router.use(authenticate);
router.post('/', validate(createPromotionSchema), PromotionController.create);
router.put('/:id', validate(updatePromotionSchema), PromotionController.update);

export default router;
