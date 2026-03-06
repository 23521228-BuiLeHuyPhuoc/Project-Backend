const router=require('express').Router();
const multer=require('multer');
const cloudinaryHelper=require('../../helpers/cloudinary.helper');
const upload=multer({storage:cloudinaryHelper.storage});
const settingController=require('../../controllers/admin/setting.controller');
const uploadField=upload.fields([
    {name:"logo",maxCount:1},
    {name:"favicon",maxCount:1}
])
router.get('/list',settingController.list);
router.get('/website-info',settingController.websiteInfo);
router.patch('/website-info',uploadField,settingController.websiteInfoPatch);
router.get('/account-admin/list',settingController.accountAdminList);
router.patch('/role/delete/:id',settingController.roleDeletePatch);
router.get('/account-admin/create',settingController.accountAdminCreate);
router.get('/account-admin/edit/:id',settingController.accountAdminEdit);
router.patch('/account-admin/edit/:id',upload.single('avatar'),settingController.accountEditPatch);
router.post('/account-admin/create',upload.single('avatar'),settingController.accountAdminCreatePost);
router.get('/role/edit/:id',settingController.roleEdit);
router.patch('/role/edit/:id',settingController.roleEditPatch);
router.get('/role/list',settingController.roleList);
router.get('/role/create',settingController.roleCreate);
router.post('/role/create',settingController.roleCreatePost);
router.patch('/role/change-status',settingController.roleChangeStatusPatch);
module.exports=router;