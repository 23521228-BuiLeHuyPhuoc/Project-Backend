const router=require('express').Router();

const tourRoutes=require('./tour.route');

const homeRoutes=require('./home.route');


router.use('/tours', tourRoutes );
router.use('/', homeRoutes );

module.exports=router;