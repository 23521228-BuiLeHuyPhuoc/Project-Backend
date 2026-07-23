const router=require('express').Router();
const orderController=require('../../controllers/admin/order.controller');
router.get('/list',orderController.list);
router.get('/cancelled',orderController.cancelled);
router.get('/edit/:id',orderController.edit);
router.patch('/edit/:id',orderController.editPatch);
router.post('/confirm/:id/:decision',orderController.confirmCashOrder);
module.exports=router;
