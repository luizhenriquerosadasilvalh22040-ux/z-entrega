import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { validate } from '../middlewares/validation';
import { authenticate } from '../middlewares/auth';
import { otpRateLimiter } from '../middlewares/rateLimiter';
import {
  customerRegisterSchema,
  merchantRegisterSchema,
  loginSchema,
  refreshSchema,
  customerRequestOtpSchema,
  customerVerifyOtpSchema
} from '../validators/auth';

const router = Router();

// Registro e login de Clientes
router.post('/customer/register', validate(customerRegisterSchema), AuthController.registerCustomer);
router.post('/customer/login', validate(loginSchema), AuthController.loginCustomer);
router.post('/customer/request-otp', otpRateLimiter, validate(customerRequestOtpSchema), AuthController.requestCustomerOtp);
router.post('/customer/verify-otp', validate(customerVerifyOtpSchema), AuthController.verifyCustomerOtp);

// Registro e login de Lojistas
router.post('/merchant/register', validate(merchantRegisterSchema), AuthController.registerMerchant);
router.post('/merchant/login', validate(loginSchema), AuthController.loginMerchant);

// Login de Administrador Geral
router.post('/admin/login', validate(loginSchema), AuthController.loginAdmin);

// Refresh token e logout
router.post('/refresh', validate(refreshSchema), AuthController.refresh);
router.post('/logout', validate(refreshSchema), AuthController.logout);

// Obter dados do usuário autenticado atual
router.get('/me', authenticate, AuthController.me);

export default router;
