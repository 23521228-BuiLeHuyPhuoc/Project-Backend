const router=require('express').Router();
const multer=require('multer');
const categoryValidate=require('../../validates/admin/category.validate');
const cloudinaryHelper=require('../../helpers/cloudinary.helper');
const upload=multer({storage:cloudinaryHelper.storage});

const categoryController=require('../../controllers/admin/category.controller');

router.get('/list',categoryController.list);
router.get('/create',categoryController.create);
router.post('/create',upload.single('avatar'),categoryValidate.createPost,categoryController.createPost);
router.get('/edit/:id',categoryController.edit);
router.patch('/edit/:id',upload.single('avatar'),categoryValidate.editPatch,categoryController.editPatch);

module.exports=router;