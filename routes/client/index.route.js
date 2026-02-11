const router=require('express').Router();

const tourRoutes=require('./tour.route');

const homeRoutes=require('./home.route');

router.use('/', homeRoutes );
router.use('/tours', tourRoutes );

module.exports=router;