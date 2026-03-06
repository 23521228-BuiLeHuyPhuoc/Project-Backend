const AccountAdmin = require("../../models/account-admin.model");
const Role=require("../../models/roles.model");
const bcrypt=require('bcrypt');
module.exports.edit=async (req,res)=>{
    const roleList=await Role.find({
        deleted:false,
    })
    res.render("admin/pages/profile-edit",{
        pageTitle:"Thông tin cá nhân",
        roleList:roleList
    })
}
module.exports.changePassword=(req,res)=>{
    res.render("admin/pages/profile-change-password",{
        pageTitle:"Đổi mật khẩu"
    })
}
module.exports.editPatch=async(req,res)=>{
    
    if(req.file){
        req.body.avatar=req.file.path;
    }
    else{
        delete req.body.avatar;
    }
    const existRecord=await AccountAdmin.findOne({
        _id:req.account.id,
        deleted:false
    })
    if(existRecord){
        const updateData={
            fullName:req.body.fullName,
            email:req.body.email,
            phone:req.body.phone
        };
        if(req.body.avatar){
            updateData.avatar=req.body.avatar;
        }
        await AccountAdmin.updateOne({_id:existRecord._id},updateData);
    }
    req.flash("success","Cập nhật thông tin cá nhân thành công");
    res.json({
        code:"success",
    })

}
module.exports.changePasswordPatch=async(req,res)=>{
    const {password}=req.body;
    const compare=await bcrypt.compare(password,req.account.password);
    if(compare==1){
        res.json({
            code:"error",
            message:"Mật khẩu cũ không được trùng với mật khẩu mới"
        })
        return;
    }
    else{
        const salt=await bcrypt.genSalt(10);
        const passEncrypt=await bcrypt.hash(password,salt);
        await AccountAdmin.updateOne({_id:req.account._id},{password:passEncrypt,
            updatedBy:req.account.id,
            updatedAt:Date.now()
        });
        req.flash("success","Đổi mật khẩu thành công");
        res.json({
            code:"success"
        })
    }

}