const router=require('express').Router();
const multer=require('multer');
const upload=multer();
const categoryController=require('../../controllers/admin/category.controller');

router.get('/list',categoryController.list);
router.get('/create',categoryController.create);
router.post('/create',upload.single('avatar'),categoryController.createPost);
module.exports=router;