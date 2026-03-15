const router=require('express').Router();
const orderController=require("../../controllers/client/order.controller");
router.post('/create',orderController.createPost);
router.get('/success', orderController.success);
router.get('/payment-zalopay/:orderId', orderController.paymentZaloPay);
router.post('/payment-zalopay-result', orderController.paymentZaloPayResultPost)
router.get('/payment-vnpay/:orderId', orderController.paymentVnPay);
router.get('/payment-vnpay-result', orderController.paymentVnPayResult);
module.exports=router;