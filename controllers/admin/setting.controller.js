const SettingWebsiteInfo=require('../../models/setting-website-info.model');
const permissionConfig=require('../../config/permission');
const Role=require('../../models/roles.model');
module.exports.list=(req,res)=>{
    res.render("admin/pages/setting-list",{
        pageTitle:"Cài đặt chung"
    })
}
module.exports.websiteInfo=async(req,res)=>{
    const settingWebsiteInfo=await SettingWebsiteInfo.findOne();
    
    res.render("admin/pages/setting-website-info",{
        settingWebsiteInfo:settingWebsiteInfo,
        pageTitle:"Thông tin website"
    })
}
module.exports.websiteInfoPatch=async(req,res)=>{
    if(req.files&&req.files.logo){
        req.body.logo=req.files.logo[0].path;
    }else
    {
        delete req.body.logo;
    }
    if(req.files&&req.files.favicon){
        req.body.favicon=req.files.favicon[0].path;
    }
    else{
        delete req.body.favicon;
    }
    
    const total=await SettingWebsiteInfo.countDocuments();
    if( total==0){
    const newRecord=new SettingWebsiteInfo(req.body);
   await newRecord.save();
    }
    else
    {
        const recordonly=await SettingWebsiteInfo.findOne();
        await SettingWebsiteInfo.updateOne(
            {
                _id:recordonly._id
            },req.body)
    }
    console.log(req.body);
    req.flash("success","Cập nhật thông tin website thành công");    
    res.json({
            code:"success",
    })

}
module.exports.accountAdminList=(req,res)=>{
    res.render("admin/pages/setting-account-admin-list",{
        pageTitle:"Tài khoản quản trị"
    })
}
module.exports.accountAdminCreate=(req,res)=>{
    res.render("admin/pages/setting-account-admin-create",{
        pageTitle:"Tạo mới tài khoản quản trị"
    })
}
module.exports.roleList=async (req,res)=>{
    const roleList=await Role.find(
        {deleted:false}
    ).sort({createdAt:"desc"});
    res.render("admin/pages/setting-role-list",{
        pageTitle:"Vai trò quản trị",
        roleList:roleList
    })
}
module.exports.roleCreate=(req,res)=>{
    res.render("admin/pages/setting-role-create",{
        permissionList:permissionConfig.permissionList,
        pageTitle:"Tạo mới vai trò quản trị"
    })
}
module.exports.roleCreatePost=async (req,res)=>{
    req.body.createdBy=req.account.id;
    req.body.updatedBy=req.account.id;
    const newRecord=new Role(req.body);
    await newRecord.save();
    req.flash("success","Tạo mới vai trò quản trị thành công");
    res.json({
        code:"success"
    })
}