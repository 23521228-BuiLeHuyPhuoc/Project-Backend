const router=require('express').Router();
const multer=require('multer');
const cloudinaryHelper=require('../../helpers/cloudinary.helper');
const upload=multer({storage:cloudinaryHelper.storage});
const profileController=require('../../controllers/admin/profile.controller');
router.get('/edit',profileController.edit);
router.patch('/edit',upload.single('avatar'),profileController.editPatch);
router.get('/change-password',profileController.changePassword);
module.exports=router;