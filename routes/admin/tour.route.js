const router=require('express').Router();
const multer=require('multer');
const cloudinaryHelper=require('../../helpers/cloudinary.helper');
const upload=multer({storage:cloudinaryHelper.storage});
const uploadField=upload.fields([
    {name:"avatar",maxCount:1},
    {name:"images",maxCount:10}
])
const tourController=require('../../controllers/admin/tour.controller');
const tourValidate=require('../../validates/admin/tour.validate');
router.get('/list',tourController.list);
router.get('/create',tourController.create);
router.post('/create',uploadField,tourValidate.createPost,tourController.createPost);
router.get('/edit/:id',tourController.edit);
router.patch('/edit/:id',uploadField,tourValidate.editPatch,tourController.editPatch);


router.get('/trash',tourController.trash);
router.patch('/change-status',tourController.changeStatusPatch);
router.patch('/trash/change-status',tourController.changeStatusTrashPatch);
router.patch('/trash/:id',tourController.trashPatch);
router.patch('/trash/undo/:id',tourController.trashUndoPatch);
module.exports=router;