const AccountAdmin = require("../../models/account-admin.model");
const Role=require("../../models/roles.model");
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