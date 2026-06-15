import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { validate } from '../middlewares/validation';
import { authenticate } from '../middlewares/auth';
import {
  customerRegisterSchema,
  merchantRegisterSchema,
  loginSchema,
  refreshSchema
} from '../validators/auth';

const router = Router();

// Registro e login de Clientes
router.post('/customer/register', validate(customerRegisterSchema), AuthController.registerCustomer);
router.post('/customer/login', validate(loginSchema), AuthController.loginCustomer);

// Registro e login de Lojistas
router.post('/merchant/register', validate(merchantRegisterSchema), AuthController.registerMerchant);
router.post('/merchant/login', validate(loginSchema), AuthController.loginMerchant);

// Refresh token e logout
router.post('/refresh', validate(refreshSchema), AuthController.refresh);
router.post('/logout', validate(refreshSchema), AuthController.logout);

// Obter dados do usuário autenticado atual
router.get('/me', authenticate, AuthController.me);

export default router;
