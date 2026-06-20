import { Router } from 'express';
import { AdminController } from '../controllers/AdminController';
import { authenticate, authorize } from '../middlewares/auth';

import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { notificationQueue } from '../services/NotificationService';
import { deliveryTimeoutQueue } from '../queues/deliveryQueue';

const router = Router();

// Todas as rotas de administrador exigem autenticação e a role 'admin'
router.use(authenticate, authorize(['admin']));

// Configura Bull Board para monitoramento de filas
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/api/admin/queues');

createBullBoard({
  queues: [
    new BullAdapter(notificationQueue),
    new BullAdapter(deliveryTimeoutQueue)
  ],
  serverAdapter: serverAdapter
});

router.use('/queues', serverAdapter.getRouter());

router.get('/stats', AdminController.getStats);
router.get('/settings', AdminController.getSettings);
router.put('/settings', AdminController.updateSettings);

router.get('/deliverers', AdminController.listDeliverers);
router.get('/deliverers/daily-report', AdminController.getDeliverersDailyReport);
router.post('/deliverers', AdminController.createDeliverer);
router.put('/deliverers/:id', AdminController.updateDeliverer);
router.put('/deliverers/:id/active-today', AdminController.toggleActiveToday);
router.delete('/deliverers/:id', AdminController.deleteDeliverer);

router.get('/orders/active', AdminController.listActiveOrders);

router.get('/merchants', AdminController.listMerchants);
router.put('/merchants/:id/verify', AdminController.toggleVerifyMerchant);
router.put('/merchants/:id/subscription-price', AdminController.updateMerchantSubscriptionPrice);

// Cupons de Desconto
router.get('/coupons', AdminController.listCoupons);
router.post('/coupons', AdminController.createCoupon);
router.delete('/coupons/:id', AdminController.deleteCoupon);

export default router;
