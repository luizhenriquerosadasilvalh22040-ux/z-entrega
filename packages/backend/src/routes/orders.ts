import { Router } from 'express';
import { OrderController } from '../controllers/OrderController';
import { authenticate } from '../middlewares/auth';
import { validate } from '../middlewares/validation';
import { createOrderSchema, updateOrderStatusSchema } from '../validators/order';

const router = Router();

// Todas as rotas de pedidos requerem autenticação
router.use(authenticate);

// Estatísticas financeiras (somente para lojistas)
router.get('/stats', OrderController.getStats);

// Criar, listar e ver detalhe de pedidos
router.post('/', validate(createOrderSchema), OrderController.create);
router.get('/', OrderController.list);
router.get('/:id', OrderController.getById);

// Atualizar status do pedido
router.post('/:id/status', validate(updateOrderStatusSchema), OrderController.updateStatus);

// Avaliar pedido
router.post('/:id/review', OrderController.createReview);

export default router;
