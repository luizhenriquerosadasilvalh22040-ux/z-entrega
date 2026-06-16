import { Router } from 'express';
import { ProductController } from '../controllers/ProductController';
import { authenticate } from '../middlewares/auth';
import { validate } from '../middlewares/validation';
import { createProductSchema, updateProductSchema } from '../validators/product';

const router = Router();

// Públicos (qualquer cliente pode pesquisar ou ver o menu)
router.get('/search', ProductController.search);
router.get('/merchant/:merchantId', ProductController.listByMerchant);

// Protegidos (apenas o próprio lojista)
router.use(authenticate);
router.post('/', validate(createProductSchema), ProductController.create);
router.put('/:id', validate(updateProductSchema), ProductController.update);
router.put('/:id/stock', ProductController.updateStock);
router.delete('/:id', ProductController.delete);

export default router;
