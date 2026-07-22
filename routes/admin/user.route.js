const router=require('express').Router();
const userController=require('../../controllers/admin/user.controller');
router.get('/list',userController.list);
router.get('/edit/:id',userController.editPage);
router.patch('/edit/:id',userController.edit);
router.patch('/delete/:id',userController.deletePatch);
router.patch('/change-status',userController.changeStatusPatch);
module.exports=router;
