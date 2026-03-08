const router=require('express').Router();

const contactController=require('../../controllers/client/contact.controller');

router.post('/create', contactController.sendMail );

module.exports=router;