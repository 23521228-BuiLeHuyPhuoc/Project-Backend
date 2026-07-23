const router=require('express').Router();

const trackingController=require('../../controllers/client/tracking.controller');
const trackingValidate=require('../../validates/client/tracking.validate');
const adminApiAuth=require('../../middlewares/admin/api-auth.middleware');

router.post('/events',trackingValidate.events,trackingController.events);
router.get('/stats',adminApiAuth.requireAdmin,trackingController.stats);

module.exports=router;
