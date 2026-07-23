const router=require('express').Router();

const trackingController=require('../../controllers/client/tracking.controller');
const trackingValidate=require('../../validates/client/tracking.validate');

router.post('/events',trackingValidate.events,trackingController.events);

module.exports=router;
