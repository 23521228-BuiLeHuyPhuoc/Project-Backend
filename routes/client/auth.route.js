const router=require('express').Router();
const authController=require('../../controllers/client/auth.controller');
const authValidate=require('../../validates/client/auth.validate');

router.get('/login',authController.login);
router.post('/login',authValidate.loginPost,authController.loginPost);
router.get('/register',authController.register);
router.post('/register',authValidate.registerPost,authController.registerPost);
router.get('/forgot-password',authController.forgotPassword);
router.post('/forgot-password',authValidate.forgotPasswordPost,authController.forgotPasswordPost);
router.get('/otp-password',authController.otpPassword);
router.post('/otp-password',authValidate.otpPasswordPost,authController.otpPasswordPost);
router.get('/reset-password',authController.resetPassword);
router.post('/reset-password',authValidate.resetPasswordPost,authController.resetPasswordPost);
router.post('/logout',authController.logout);

module.exports=router;
