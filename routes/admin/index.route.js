const router=require('express').Router();
const authMiddleware=require('../../middlewares/admin/auth.middlewares');
const accountRoutes=require('./account.route');
const dashboardRoutes=require('./dashboard.route');
const categoryRoutes=require('./category.route');
const tourRoutes=require('./tour.route');
const orderRoutes=require('./order.route');
const userRoutes=require('./user.route');
const contactRoutes=require('./contact.route');
const settingRoutes=require('./setting.route');
const profileRoutes=require('./profile.route');
router.use('/profile',authMiddleware.verifyToken, profileRoutes);
router.use('/setting',authMiddleware.verifyToken,settingRoutes);
router.use('/contact',authMiddleware.verifyToken,contactRoutes);
router.use('/user',authMiddleware.verifyToken,userRoutes);
router.use('/order',authMiddleware.verifyToken,orderRoutes);
router.use('/tour',authMiddleware.verifyToken,tourRoutes);
router.use('/account', accountRoutes);
router.use('/dashboard',authMiddleware.verifyToken,dashboardRoutes);
router.use('/category',authMiddleware.verifyToken,categoryRoutes);
router.use(authMiddleware.verifyToken,(req,res)=>{
    res.render("admin/pages/error-404",{
        pageTitle:"Không tìm thấy trang"
    })
})
module.exports=router;