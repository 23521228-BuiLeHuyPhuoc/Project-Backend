const router=require('express').Router();

const tourRoutes=require('./tour.route');

const homeRoutes=require('./home.route');

const cartRoutes=require('./cart.route');

router.use('/cart', cartRoutes );

router.use('/tours', tourRoutes );
router.use('/', homeRoutes );

module.exports=router;