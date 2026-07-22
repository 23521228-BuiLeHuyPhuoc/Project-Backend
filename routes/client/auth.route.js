const router=require('express').Router();
const authController=require('../../controllers/client/auth.controller');
const authValidate=require('../../validates/client/auth.validate');

router.get('/login',authController.login);
router.post('/login',authValidate.loginPost,authController.loginPost);
router.get('/register',authController.register);
router.post('/register',authValidate.registerPost,authController.registerPost);
router.post('/logout',authController.logout);

module.exports=router;
