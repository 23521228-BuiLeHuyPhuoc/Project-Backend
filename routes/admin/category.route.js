const router=require('express').Router();
const multer=require('multer');
const categoryValidate=require('../../validates/admin/category.validate');
const cloudinaryHelper=require('../../helpers/cloudinary.helper');
const upload=multer({storage:cloudinaryHelper.storage});

const categoryController=require('../../controllers/admin/category.controller');

router.get('/list',categoryController.list);
router.get('/create',categoryController.create);
router.post('/create',upload.single('avatar'),categoryValidate.createPost,categoryController.createPost);
module.exports=router;