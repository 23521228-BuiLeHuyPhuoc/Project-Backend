const router=require('express').Router();
const orderController=require("../../controllers/client/order.controller");
router.post('/create',orderController.createPost);
router.get('/success', orderController.success);
router.get('/payment-zalopay/:orderId', orderController.paymentZaloPay);
router.post('/zalopay-callback', orderController.callbackZaloPay);
router.get('/zalopay-return', orderController.zalopayReturn);
module.exports=router;