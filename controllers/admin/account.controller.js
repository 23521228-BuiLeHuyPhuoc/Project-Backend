const AccountAdmin=require('../../models/account-admin.model');
const bcrypt=require('bcrypt');
module.exports.login= async(req,res)=>{
    res.render("admin/pages/login.pug",{
        pageTitle:"Đăng nhập"
    })
}
module.exports.register=async(req,res)=>{
    res.render("admin/pages/register.pug",{
        pageTitle:"Đăng ký"
    })
}
module.exports.registerPost=async(req,res)=>{
    const {fullName,email,password}=req.body;
    const existAccount=await AccountAdmin.findOne({
        email:email
    });
    if(existAccount){
        res.json({
            code:"error",
            message:"Email đã tồn tại trong hệ thống"
        });
        return;
    }
    
    const salt=await bcrypt.genSalt(10);

    const hashPassword=await bcrypt.hash(password,salt);




    const newAccount=new AccountAdmin({
        fullName:fullName,
        email:email,
        password:hashPassword,
        status:"initial"
    });
    await newAccount.save();
    res.json({
        code:"success",
        message : "Đăng ký tài khoản thành công"
    });
}

module.exports.forgotPassword=async(req,res)=>{
    res.render("admin/pages/forgot-password.pug",{
        pageTitle:"Quên mật khẩu"
    })
}
module.exports.otpPassword=async(req,res)=>{
    res.render("admin/pages/otp-password.pug",{
        pageTitle:"Xác thực OTP"
    })
}
module.exports.registerInitial=async(req,res)=>{
    res.render("admin/pages/register-initial.pug",{
        pageTitle:"Tài khoản đã được khởi tạo"
    })
}
module.exports.resetPassword=async(req,res)=>{
    res.render("admin/pages/reset-password.pug",{
        pageTitle:"Đổi mật khẩu"
    })
}