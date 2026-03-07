const router=require('express').Router();

const tourRoutes=require('./tour.route');

const homeRoutes=require('./home.route');

const cartRoutes=require('./cart.route');
const settingMiddleware=require('../../middlewares/client/setting.middlewares');

router.use(settingMiddleware.websiteInfo);
router.use('/', homeRoutes );
router.use('/cart', cartRoutes );

router.use('/tours', tourRoutes );


module.exports=router;