import { Router } from 'express';
import { AdminController } from '../controllers/AdminController';
import { authenticate, authorize } from '../middlewares/auth';

const router = Router();

// Todas as rotas de administrador exigem autenticação e a role 'admin'
router.use(authenticate, authorize(['admin']));

router.get('/stats', AdminController.getStats);
router.get('/settings', AdminController.getSettings);
router.put('/settings', AdminController.updateSettings);

router.get('/deliverers', AdminController.listDeliverers);
router.post('/deliverers', AdminController.createDeliverer);
router.put('/deliverers/:id', AdminController.updateDeliverer);
router.put('/deliverers/:id/active-today', AdminController.toggleActiveToday);
router.delete('/deliverers/:id', AdminController.deleteDeliverer);

export default router;
