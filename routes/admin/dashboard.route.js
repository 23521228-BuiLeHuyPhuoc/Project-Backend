const router=require('express').Router();
const dashboardController=require('../../controllers/admin/dashboard.controller');
router.get('/',dashboardController.dashboard);
router.post('/revenue-chart',dashboardController.revenueChart);
module.exports=router;