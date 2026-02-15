const router=require('express').Router();

const accountRoutes=require('./account.route');
const dashboardRoutes=require('./dashboard.route');
const categoryRoutes=require('./category.route');
const tourRoutes=require('./tour.route');
const orderRoutes=require('./order.route');
const userRoutes=require('./user.route');
const contactRoutes=require('./contact.route');
router.use('/contact',contactRoutes);
router.use('/user',userRoutes);
router.use('/order',orderRoutes);
router.use('/tour',tourRoutes);
router.use('/account', accountRoutes);
router.use('/dashboard',dashboardRoutes);
router.use('/category',categoryRoutes);
module.exports=router;