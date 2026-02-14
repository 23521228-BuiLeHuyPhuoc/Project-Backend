const router=require('express').Router();

const accountRoutes=require('./account.route');


router.use('/account', accountRoutes);

module.exports=router;