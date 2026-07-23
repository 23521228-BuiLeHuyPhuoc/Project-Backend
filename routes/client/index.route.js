const router=require('express').Router();

const tourRoutes=require('./tour.route');

const homeRoutes=require('./home.route');

const cartRoutes=require('./cart.route');

const contactRoutes=require('./contact.route');
const categoryRoutes=require('./category.route');
const settingMiddleware=require('../../middlewares/client/setting.middlewares');
const categoryMiddleware=require('../../middlewares/client/category.middleware');
const searchRoutes=require('./search.route');
const orderRoutes=require('./order.route');
const authRoutes=require('./auth.route');
const newsRoutes=require('./news.route');
const accountRoutes=require('./account.route');
const trackingRoutes=require('./tracking.route');
const recommendationRoutes=require('./recommendation.route');
const authMiddleware=require('../../middlewares/client/auth.middleware');
const trackingMiddleware=require('../../middlewares/client/tracking.middleware');
router.use(authMiddleware.optionalAuth);
router.use('/api/tracking',trackingRoutes);
router.use('/api/recommendation',recommendationRoutes);
router.use(settingMiddleware.websiteInfo);
router.use(categoryMiddleware.list);
router.use(trackingMiddleware.trackInteractions);
router.use((req,res,next)=>{
  res.locals.currentPath=req.path;
  next();
});
router.use('/auth',authRoutes);
router.use('/account',accountRoutes);
router.get('/login',(req,res)=>res.redirect('/auth/login'));
router.get('/register',(req,res)=>res.redirect('/auth/register'));
router.use('/', homeRoutes );
router.use('/tin-tuc',newsRoutes);
router.use('/cart', cartRoutes );
router.use('/category', categoryRoutes );
router.use('/tour', tourRoutes );
router.use('/contact',contactRoutes);
router.use('/order',orderRoutes);
router.use('/search',searchRoutes);

module.exports=router;
