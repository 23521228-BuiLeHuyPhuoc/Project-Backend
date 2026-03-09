const router=require('express').Router();

const tourRoutes=require('./tour.route');

const homeRoutes=require('./home.route');

const cartRoutes=require('./cart.route');

const contactRoutes=require('./contact.route');
const categoryRoutes=require('./category.route');
const settingMiddleware=require('../../middlewares/client/setting.middlewares');
const categoryMiddleware=require('../../middlewares/client/category.middleware');
const searchRoutes=require('./search.route');
router.use(settingMiddleware.websiteInfo);
router.use(categoryMiddleware.list);
router.use('/', homeRoutes );
router.use('/cart', cartRoutes );
router.use('/category', categoryRoutes );
router.use('/tour', tourRoutes );
router.use('/contact',contactRoutes);
router.use('/search',searchRoutes);

module.exports=router;