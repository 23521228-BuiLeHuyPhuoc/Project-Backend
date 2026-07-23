const SettingWebsiteInfo=require('../../models/setting-website-info.model');
const Permission=require('../../models/permission.model');
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
    let findObj={
        deleted:false
    }
    if(req.query.status)
    {
        findObj.status=req.query.status
        
    }
    if(req.query.role){
        findObj.role=req.query.role
    }
    const dateFromTo={};
    if(req.query.fromDate)
    {
        dateFromTo.$gte=new Date(req.query.fromDate);
    }
    if(req.query.toDate)
    {
        dateFromTo.$lte=new Date (req.query.toDate);
    }

    const dsAccount=await AccountAdmin.find(findObj)
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
                trim:true,
                locale:"vi" 
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
const getPermissionGroups=permissionList=>{
    const groups=new Map();
    permissionList.forEach(item=>{
        const group=item.group || "Khác";
        if(!groups.has(group)){
            groups.set(group,[]);
        }
        groups.get(group).push(item);
    });
    return Array.from(groups,([name,permissions])=>({name,permissions}));
};

module.exports.roleCreate=async(req,res)=>{
    const permissionList=await Permission.find({
        deleted:false,
        status:"active"
    }).sort({group:1,label:1}).lean();
    res.render("admin/pages/setting-role-create",{
        permissionGroups:getPermissionGroups(permissionList),
        pageTitle:"Tạo mới vai trò quản trị"
    })
}
module.exports.roleCreatePost=async (req,res)=>{
    const requestedPermissions=Array.isArray(req.body.permissions) ? req.body.permissions : [];
    const validPermissions=await Permission.find({
        code:{$in:requestedPermissions},
        deleted:false,
        status:"active"
    }).distinct("code");
    req.body.permissions=validPermissions;
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
    const permissionList=await Permission.find({
        deleted:false,
        status:"active"
    }).sort({group:1,label:1}).lean();
    res.render("admin/pages/setting-role-edit",{
        permissionGroups:getPermissionGroups(permissionList),
        pageTitle:"Sửa vai trò quản trị",
        record:record
    })

}
module.exports.roleEditPatch=async (req,res)=>{
    const id=req.params.id;
    const requestedPermissions=Array.isArray(req.body.permissions) ? req.body.permissions : [];
    req.body.permissions=await Permission.find({
        code:{$in:requestedPermissions},
        deleted:false,
        status:"active"
    }).distinct("code");
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
    const password=String(req.body.password || "");
    const confirmPassword=String(req.body.confirmPassword || "");
    const isStrongPassword=password.length>=8
        && /[A-Z]/.test(password)
        && /[a-z]/.test(password)
        && /\d/.test(password)
        && /[@$!%*?&]/.test(password);

    if(!isStrongPassword){
        return res.status(400).json({
            code:"error",
            message:"Mật khẩu phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt!"
        });
    }
    if(password!==confirmPassword){
        return res.status(400).json({
            code:"error",
            message:"Mật khẩu xác nhận không khớp!"
        });
    }

    const findRecord=await AccountAdmin.findOne({
        email:req.body.email,
        deleted:false
    });
    if(findRecord){
        return res.json({
            code:"error",
            message:"Email đã tồn tại!"
        })
    }
    const random=await bcrypt.genSalt(10);
    const accountData={...req.body};
    delete accountData.confirmPassword;
    accountData.password=await bcrypt.hash(password,random);
    accountData.createdBy=req.account.id;
    accountData.updatedBy=req.account.id;
    if(req.file){
        accountData.avatar=req.file.path;
    }
    else{
        accountData.avatar="";
    }
    const newRecord=new AccountAdmin(accountData);
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
module.exports.changeStatusPatch=async(req,res)=>{
    const status=req.body.status;
    const idList=req.body.idList;
    console.log(status);
    console.log(idList);

    const accountList=await AccountAdmin.find({
        _id: {$in:idList}
    })
    if(status=="active"||status=="inactive")
    {
    if(accountList){
    await AccountAdmin.updateMany({
        _id:{$in:idList}
    },{
        status:req.body.status
    })
}
    }
    if(status=="delete")
    {
        if(accountList){
            await AccountAdmin.updateMany({
                _id:{$in:idList}
            },{
                deleted:true
            })
        }
    }
    req.flash("Thanh công","Đổi trạng thái thành công!");
    res.json({
        code:"success"
    })

}
