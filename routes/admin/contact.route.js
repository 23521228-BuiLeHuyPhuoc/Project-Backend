const router=require('express').Router();
const contactController=require('../../controllers/admin/contact.controller');
router.get('/list',contactController.list);
router.get('/detail/:id',contactController.detail);
router.patch('/status/:id',contactController.statusPatch);
router.patch('/delete/:id',contactController.deletePatch);
module.exports=router;
