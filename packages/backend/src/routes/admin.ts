import { Router } from 'express';
import { AdminController } from '../controllers/AdminController';
import { authenticate, authorize } from '../middlewares/auth';
import { validate } from '../middlewares/validation';
import {
  createCouponSchema,
  createDelivererSchema,
  toggleActiveTodaySchema,
  toggleVerifyMerchantSchema,
  updateDelivererSchema,
  updateMerchantSubscriptionPriceSchema,
  updateSettingsSchema,
  updateWhatsAppTemplateSchema
} from '../validators/admin';

import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
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
    new BullMQAdapter(notificationQueue),
    new BullMQAdapter(deliveryTimeoutQueue)
  ],
  serverAdapter: serverAdapter
});

router.use('/queues', serverAdapter.getRouter());

router.get('/stats', AdminController.getStats);
router.get('/operational-issues', AdminController.getOperationalIssues);
router.post('/notifications/:id/requeue', AdminController.requeueFailedNotification);
router.post('/refunds/:id/retry', AdminController.retryFailedRefund);
router.post('/orders/:id/dispatch-ready', AdminController.dispatchReadyOrder);
router.post('/operational-reconciliation/run', AdminController.runOperationalReconciliation);
router.get('/whatsapp-templates', AdminController.listWhatsAppTemplates);
router.put('/whatsapp-templates/:key', validate(updateWhatsAppTemplateSchema), AdminController.updateWhatsAppTemplate);
router.get('/settings', AdminController.getSettings);
router.put('/settings', validate(updateSettingsSchema), AdminController.updateSettings);

router.get('/deliverers', AdminController.listDeliverers);
router.get('/deliverers/daily-report', AdminController.getDeliverersDailyReport);
router.post('/deliverers', validate(createDelivererSchema), AdminController.createDeliverer);
router.put('/deliverers/:id', validate(updateDelivererSchema), AdminController.updateDeliverer);
router.put('/deliverers/:id/active-today', validate(toggleActiveTodaySchema), AdminController.toggleActiveToday);
router.delete('/deliverers/:id', AdminController.deleteDeliverer);

router.get('/orders/active', AdminController.listActiveOrders);

router.get('/merchants', AdminController.listMerchants);
router.put('/merchants/:id/verify', validate(toggleVerifyMerchantSchema), AdminController.toggleVerifyMerchant);
router.put('/merchants/:id/subscription-price', validate(updateMerchantSubscriptionPriceSchema), AdminController.updateMerchantSubscriptionPrice);

// Cupons de Desconto
router.get('/coupons', AdminController.listCoupons);
router.post('/coupons', validate(createCouponSchema), AdminController.createCoupon);
router.delete('/coupons/:id', AdminController.deleteCoupon);

export default router;
