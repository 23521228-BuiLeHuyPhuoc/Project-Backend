const router=require('express').Router();
const authMiddleware=require('../../middlewares/admin/auth.middlewares');
const permissionMiddleware=require('../../middlewares/admin/permission.middleware');
const accountRoutes=require('./account.route');
const dashboardRoutes=require('./dashboard.route');
const categoryRoutes=require('./category.route');
const tourRoutes=require('./tour.route');
const orderRoutes=require('./order.route');
const userRoutes=require('./user.route');
const contactRoutes=require('./contact.route');
const settingRoutes=require('./setting.route');
const profileRoutes=require('./profile.route');
const uploadRoutes=require('./upload.route');
const voucherRoutes=require('./voucher.route');
const notificationRoutes=require('./notification.route');
const articleRoutes=require('./article.route');
const reviewRoutes=require('./review.route');
router.use((req,res,next)=>{
    res.setHeader("Cache-Control","no-store");
    next();
})
router.use('/account', accountRoutes);
router.use(authMiddleware.verifyToken);
router.use(permissionMiddleware.authorizeByPath);
router.use('/profile',profileRoutes);
router.use('/setting',settingRoutes);
router.use('/contact',contactRoutes);
router.use('/user',userRoutes);
router.use('/order',orderRoutes);
router.use('/tour',tourRoutes);
router.use('/dashboard',dashboardRoutes);
router.use('/category',categoryRoutes);
router.use('/upload',uploadRoutes);
router.use('/voucher',voucherRoutes);
router.use('/notification',notificationRoutes);
router.use('/article',articleRoutes);
router.use('/review',reviewRoutes);
router.use((req,res)=>{
    res.render("admin/pages/error-404",{
        pageTitle:"Không tìm thấy trang"
    })
})
module.exports=router;
