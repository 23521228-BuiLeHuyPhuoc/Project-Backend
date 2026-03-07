const router=require('express').Router();

const tourRoutes=require('./tour.route');

const homeRoutes=require('./home.route');

const cartRoutes=require('./cart.route');
const settingMiddleware=require('../../middlewares/client/setting.middlewares');
const categoryMiddleware=require('../../middlewares/client/category.middleware');
router.use(settingMiddleware.websiteInfo);
router.use(categoryMiddleware.list);
router.use('/', homeRoutes );
router.use('/cart', cartRoutes );

router.use('/tours', tourRoutes );


module.exports=router;