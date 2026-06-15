import { Router } from 'express';
import { CustomerController } from '../controllers/CustomerController';
import { authenticate, authorize } from '../middlewares/auth';
import { validate } from '../middlewares/validation';
import {
  updateCustomerProfileSchema,
  updateCustomerAddressSchema
} from '../validators/customer';

const router = Router();

// Apenas autenticados podem ver ou manipular clientes
router.use(authenticate);

// Estatísticas e buscas específicas (admin/internal)
router.get('/stats/count', authorize(['merchant']), CustomerController.count);
router.get('/search/city', authorize(['merchant']), CustomerController.searchByCity);

// Listar todos os clientes (somente lojistas podem ver todos os clientes)
router.get('/', authorize(['merchant']), CustomerController.list);

// Pegar por ID, atualizar e desativar
router.get('/:id', CustomerController.getById);
router.put('/:id/profile', validate(updateCustomerProfileSchema), CustomerController.updateProfile);
router.put('/:id/address', validate(updateCustomerAddressSchema), CustomerController.updateAddress);
router.delete('/:id', CustomerController.deactivate);
router.post('/:id/reactivate', CustomerController.reactivate);

export default router;
