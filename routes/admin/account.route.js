const router=require('express').Router();
const accountValidate=require('../../validates/admin/account.validate');

const accountController=require('../../controllers/admin/account.controller');

const accountMiddleware=require('../../middlewares/admin/auth.middlewares');
router.get('/login', accountController.login );
router.post('/login',accountValidate.loginPost,accountController.loginPost);
router.get('/register', accountController.register );
router.post('/register',accountValidate.registerPost ,accountController.registerPost );
router.get('/register-initial', accountController.registerInitial );
router.get('/forgot-password', accountController.forgotPassword );
router.post('/forgot-password', accountController.forgotPasswordPost);
router.get('/otp-password', accountController.otpPassword );
router.post('/otp-password',accountController.otpPasswordPost);
router.get('/reset-password', accountController.resetPassword );
router.post('/reset-password',accountMiddleware.verifyToken,accountValidate.resetPasswordPost,accountController.resetPasswordPost);

router.post('/logout',accountController.logout);
module.exports=router;