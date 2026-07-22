const router=require('express').Router();
const orderController=require("../../controllers/client/order.controller");
const authMiddleware=require('../../middlewares/client/auth.middleware');
router.post('/create',authMiddleware.requireAuth,orderController.createPost);
router.get('/success',authMiddleware.requireAuth,orderController.success);
router.get('/payment-zalopay/:orderId',authMiddleware.requireAuth,orderController.paymentZaloPay);
router.post('/payment-zalopay-result', orderController.paymentZaloPayResultPost)
router.get('/payment-vnpay/:orderId',authMiddleware.requireAuth,orderController.paymentVnPay);
router.get('/payment-vnpay-result', orderController.paymentVnPayResult);
module.exports=router;
