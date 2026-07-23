const router=require('express').Router();

const contactController=require('../../controllers/client/contact.controller');
const contactValidate=require('../../validates/client/contact.validate');

router.get('/',contactController.index);
router.post('/create',contactController.subscribe);
router.post('/message',contactValidate.createMessage,contactController.createMessage);

module.exports=router;
