const AccountAdmin = require("../../models/account-admin.model");
const Role=require("../../models/roles.model");
const bcrypt=require('bcrypt');
const jwt=require('jsonwebtoken');
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
    const fullName=String(req.body.fullName || "").trim();
    const email=String(req.body.email || "").trim().toLowerCase();
    const phone=String(req.body.phone || "").replace(/[\s.-]/g,"");
    if(fullName.length<2 || fullName.length>50){
        return res.status(400).json({code:"error",message:"Họ tên phải có từ 2 đến 50 ký tự!"});
    }
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
        return res.status(400).json({code:"error",message:"Email không đúng định dạng!"});
    }
    if(phone && !/^(?:\+84|0)\d{8,10}$/.test(phone)){
        return res.status(400).json({code:"error",message:"Số điện thoại không đúng định dạng!"});
    }
    if(await AccountAdmin.exists({_id:{$ne:req.account.id},email,deleted:false})){
        return res.status(409).json({code:"error",message:"Email đã được tài khoản khác sử dụng!"});
    }

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
            fullName,
            email,
            phone
        };
        if(req.body.avatar){
            updateData.avatar=req.body.avatar;
        }
        await AccountAdmin.updateOne({_id:existRecord._id},updateData);
        const token=jwt.sign({
            id:existRecord.id,
            email,
            purpose:'admin-session'
        },process.env.JWT_SECRET,{expiresIn:'150m'});
        res.cookie('token',token,{
            maxAge:150*60*1000,
            httpOnly:true,
            sameSite:'strict',
            secure:process.env.NODE_ENV==='production'
        });
    }
    else{
        return res.status(404).json({code:"error",message:"Không tìm thấy tài khoản"});
    }
    req.flash("success","Cập nhật thông tin cá nhân thành công");
    res.json({
        code:"success",
    })

}
module.exports.changePasswordPatch=async(req,res)=>{
    const {password}=req.body;
    const account=await AccountAdmin.findOne({
        _id:req.account.id,
        deleted:false
    }).select("+password");
    if(!account){
        return res.status(404).json({
            code:"error",
            message:"Không tìm thấy tài khoản"
        });
    }
    const compare=await bcrypt.compare(password,account.password);
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
