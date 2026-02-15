const router=require('express').Router();

const accountRoutes=require('./account.route');
const dashboardRoutes=require('./dashboard.route');

router.use('/account', accountRoutes);
router.use('/dashboard',dashboardRoutes);
module.exports=router;