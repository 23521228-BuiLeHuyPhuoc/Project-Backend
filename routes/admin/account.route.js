const router=require('express').Router();
const accountValidate=require('../../validates/admin/account.validate');

const accountController=require('../../controllers/admin/account.controller');

router.get('/login', accountController.login );
router.post('/login',accountValidate.loginPost,accountController.loginPost);
router.get('/forgot-password', accountController.forgotPassword );
router.post('/forgot-password',accountValidate.forgotPasswordPost,accountController.forgotPasswordPost);
router.get('/otp-password', accountController.otpPassword );
router.post('/otp-password',accountValidate.otpPasswordPost,accountController.otpPasswordPost);
router.get('/reset-password', accountController.resetPassword );
router.post('/reset-password',accountValidate.resetPasswordPost,accountController.resetPasswordPost);

router.post('/logout',accountController.logout);
module.exports=router;
