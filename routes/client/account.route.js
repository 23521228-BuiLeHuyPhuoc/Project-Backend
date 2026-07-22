const router=require('express').Router();
const accountController=require('../../controllers/client/account.controller');
const favoriteController=require('../../controllers/client/favorite.controller');
const notificationController=require('../../controllers/client/notification.controller');
const reviewController=require('../../controllers/client/review.controller');
const voucherController=require('../../controllers/client/voucher.controller');
const accountMiddleware=require('../../middlewares/client/account.middleware');
const authMiddleware=require('../../middlewares/client/auth.middleware');
const accountValidate=require('../../validates/client/account.validate');

router.use(authMiddleware.requireAuth);
router.use(accountMiddleware.meta);

router.get('/',accountController.dashboard);
router.get('/stats',accountController.stats);

router.get('/orders',accountController.orders);
router.get('/orders/:id',accountController.orderDetail);
router.post('/orders/:id/cancel',accountController.cancelOrder);

router.get('/vouchers',voucherController.list);
router.post('/vouchers/:id/claim',voucherController.claim);
router.delete('/vouchers/:id',voucherController.remove);

router.get('/notifications',notificationController.list);
router.patch('/notifications/read-all',notificationController.readAll);
router.patch('/notifications/:id/read',notificationController.read);
router.delete('/notifications/:id',notificationController.remove);

router.get('/reviews',reviewController.list);
router.post('/reviews',accountValidate.reviewCreate,reviewController.create);
router.patch('/reviews/:id',accountValidate.reviewUpdate,reviewController.update);
router.delete('/reviews/:id',reviewController.remove);

router.get('/favorites',favoriteController.list);
router.post('/favorites/:tourId/toggle',favoriteController.toggle);

router.get('/profile',accountController.profile);
router.patch('/profile',accountValidate.profile,accountController.updateProfile);

module.exports=router;
