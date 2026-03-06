const SettingWebsiteInfo=require('../../models/setting-website-info.model');
const permissionConfig=require('../../config/permission');
const Role=require('../../models/roles.model');
const slugify=require('slugify');
const bcrypt=require('bcrypt');
const AccountAdmin=require('../../models/account-admin.model');
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
module.exports.accountAdminList=async (req,res)=>{
    const dsAccount=await AccountAdmin.find({
        deleted:false
    })
    const roleList=await Role.find({
        deleted:false
    })
    res.render("admin/pages/setting-account-admin-list",{
        pageTitle:"Tài khoản quản trị",
        dsAccount:dsAccount,
        roleList:roleList
    })
}
module.exports.accountAdminCreate=async (req,res)=>{
    const roleList=await Role.find({
        deleted:false
    })
    res.render("admin/pages/setting-account-admin-create",{
        pageTitle:"Tạo mới tài khoản quản trị",
        roleList:roleList
    })
}
module.exports.roleList=async (req,res)=>{
    const dataFind={
            deleted:false,

        }
    if(req.query.search){
    const keyword=slugify(req.query.search,{
                lower:true,
                replacement:"-",
                trim:true
            });
    const regex=new RegExp(keyword,"i");
    dataFind.slug=regex;
        }
        
    const roleList=await Role.find(dataFind
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
module.exports.roleEdit=async (req,res)=>{
    const id=req.params.id;
    const record=await Role.findOne({
        _id:id,
        deleted:false
    })
    res.render("admin/pages/setting-role-edit",{
        permissionList:permissionConfig.permissionList,
        pageTitle:"Sửa vai trò quản trị",
        record:record
    })

}
module.exports.roleEditPatch=async (req,res)=>{
    const id=req.params.id;
    req.body.updatedBy=req.account.id;
    req.body.updatedAt=Date.now();
    await Role.updateOne({
        _id:id,
        deleted:false
    },req.body)
    req.flash("success","Cập nhật vai trò quản trị thành công");
    res.json({
        code:"success"
    })
}
module.exports.roleDeletePatch=async (req,res)=>{
    const id=req.params.id;
    await Role.updateOne({
        _id:id,
        deleted:false
    },{
        deleted:true,
        deletedBy:req.account.id,
        deletedAt:Date.now()
    })
    req.flash("success","Xóa vai trò quản trị thành công");
    res.json({
        code:"success"
    })
}
module.exports.roleChangeStatusPatch=async (req,res)=>{
    const {changeStatus,idList}=req.body;
    if(changeStatus=="action-delete"){
        await Role.updateMany({
            _id:{$in:idList},
            deleted:false
        },{
            deleted:true,
            deletedBy:req.account.id,
            deletedAt:Date.now()
        })
    }
    req.flash("success","Xoá vai trò quản trị thành công");

    res.json({
        code:"success"
    });
}
module.exports.accountAdminCreatePost=async (req,res)=>{
    const findRecord=await AccountAdmin.findOne({
        email:req.body.email,
        deleted:false
    });
    if(findRecord){
        return res.json({
            code:"error"
        })
    }
    const random=await bcrypt.genSalt(10);
    req.body.password=await bcrypt.hash(req.body.password,random);
    req.body.createdBy=req.account.id;
    req.body.updatedBy=req.account.id;
    if(req.file){
        req.body.avatar=req.file.path;
    }
    else{
        req.body.avatar="";
    }
    const newRecord=new AccountAdmin(req.body);
    await newRecord.save();
    req.flash("success","Tạo mới tài khoản quản trị thành công");
    res.json({
        code:"success"
    })
}
module.exports.accountAdminEdit=async (req,res)=>{
    const id=req.params.id;
    const record=await AccountAdmin.findOne({
        _id:id,
        deleted:false
    })
    const roleList=await Role.find({
        deleted:false
    })
    res.render("admin/pages/setting-account-admin-edit",{
        pageTitle:"Sửa tài khoản quản trị",
        record:record,
        roleList:roleList
    })
}
module.exports.accountEditPatch=async(req,res)=>{
    const id=req.params.id;
    const record=await AccountAdmin.findOne({
        _id:id,
        deleted:false
    })
    req.body.updatedBy=req.account.id;
    req.body.updatedAt=Date.now();
    const compare= await bcrypt.compare(req.body.password,record.password);
    if(compare==1)
    {
        delete req.body.password
    }
    else{
        const salt=await bcrypt.genSalt(10);
        const passEncrypt=await bcrypt.hash(req.body.password,salt);
        req.body.password=passEncrypt;
    }
    if(req.file){
        req.body.avatar=req.file.path;
    }else{
        delete req.body.avatar;
    }
    if(record){
    await AccountAdmin.updateOne({_id:record._id},req.body);
    }
    else{
        return;
    }
    req.flash("success","Thành công!");
    res.json({
        code:"success"
    })
}