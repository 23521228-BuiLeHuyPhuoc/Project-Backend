const router=require('express').Router();

const accountRoutes=require('./account.route');
const dashboardRoutes=require('./dashboard.route');
const categoryRoutes=require('./category.route');
const tourRoutes=require('./tour.route');
const orderRoutes=require('./order.route');
const userRoutes=require('./user.route');
const contactRoutes=require('./contact.route');
const settingRoutes=require('./setting.route');
const profileRoutes=require('./profile.route');
router.use('/profile', profileRoutes);
router.use('/setting',settingRoutes);
router.use('/contact',contactRoutes);
router.use('/user',userRoutes);
router.use('/order',orderRoutes);
router.use('/tour',tourRoutes);
router.use('/account', accountRoutes);
router.use('/dashboard',dashboardRoutes);
router.use('/category',categoryRoutes);
router.use((req,res)=>{
    res.render("admin/pages/error-404",{
        pageTitle:"Không tìm thấy trang"
    })
})
module.exports=router;