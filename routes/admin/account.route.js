const router=require('express').Router();


const accountController=require('../../controllers/admin/account.controller');

router.get('/', accountController.account );

module.exports=router;