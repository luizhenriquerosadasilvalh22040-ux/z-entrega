import { Router } from 'express';
import { MerchantController } from '../controllers/MerchantController';
import { authenticate } from '../middlewares/auth';
import { validate } from '../middlewares/validation';
import {
  updateMerchantProfileSchema,
  updateOperatingHoursSchema,
  updatePaymentMethodsSchema
} from '../validators/merchant';

const router = Router();

// Obter estatísticas públicas/privadas
router.get('/stats/count', MerchantController.count);
router.get('/stats/verified', MerchantController.countVerified);

// Listagem e busca de lojistas são públicas (para clientes verem)
router.get('/', MerchantController.list);
router.get('/:id', MerchantController.getById);
router.get('/:id/reviews', MerchantController.getReviews);

// Rotas protegidas (apenas o próprio lojista)
router.use(authenticate);

router.put('/:id/profile', validate(updateMerchantProfileSchema), MerchantController.updateProfile);
router.put('/:id/operating-hours', validate(updateOperatingHoursSchema), MerchantController.updateOperatingHours);
router.put('/:id/payment-method', validate(updatePaymentMethodsSchema), MerchantController.updatePaymentMethods);
router.put('/:id/logo', MerchantController.updateLogo);
router.put('/:id/cover', MerchantController.updateCover);
router.delete('/:id', MerchantController.deactivate);
router.post('/:id/reactivate', MerchantController.reactivate);

export default router;
