const router=require('express').Router();

const cartController=require('../../controllers/client/cart.controller');
const authMiddleware=require('../../middlewares/client/auth.middleware');

router.use(authMiddleware.requireAuth);
router.get('/',cartController.cart);
router.get('/detail',cartController.cartDetail);
router.post('/add',cartController.addPost);
router.patch('/items/:itemId',cartController.updatePatch);
router.delete('/items/:itemId',cartController.deleteItem);
module.exports=router;
