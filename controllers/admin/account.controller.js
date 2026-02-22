const AccountAdmin=require('../../models/account-admin.model');
const bcrypt=require('bcrypt');
require('dotenv').config();
const jwt=require('jsonwebtoken');
const sendMail=require('../../helpers/mail.helper');
const generateRandomNumber = require('../../helpers/generate.helper');
const ForgotPassword = require('../../models/forgot-password.model');
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
module.exports.loginPost=async(req,res)=>{
    const {email,password,rememberPassword}=req.body;
    console.log(email);
    console.log(password);
    console.log(rememberPassword);
    const existAccount=await AccountAdmin.findOne({
        email:email
        
    });
    if(!existAccount){
        res.json({
            code:"error",
            message:"Email không tồn tại trong hệ thống"
        });
        return;
    }
    const isPasswordValid=await bcrypt.compare(password,existAccount.password);
    if(!isPasswordValid){
        res.json({
            code:"error",
            message:"Mật khẩu không chính xác"
        })
        return;
    }
    if(existAccount.status!="active"){
        res.json({
            code:"error",
            message:"Tài khoản của bạn chưa được kích hoạt. Vui lòng liên hệ quản trị viên để kích hoạt tài khoản."
        });
        return;
    }
    const token=jwt.sign({
        id:existAccount.id,
        email:existAccount.email
    },process.env.JWT_SECRET,{expiresIn: rememberPassword ?'30d':"5m"});
    //token có thời hạn 5 phút
    //LƯU TOKEN VÀO COOKIE hiệu lực 5 phút
    res.cookie("token",token,{
        maxAge: rememberPassword? 30*24*60*60*1000: 5*60*1000,
        httpOnly:true,
        sameSite:"strict"
    })
    res.json({
        code:"success", 
        message : "Đăng nhập tài khoản thành công"
    });
}
module.exports.logout=(req,res)=>{
    res.clearCookie("token");
    res.json({
        code:"success",
        message:"Dang xuat thanh cong"
    })



}
module.exports.forgotPassword=async(req,res)=>{
    res.render("admin/pages/forgot-password.pug",{
        pageTitle:"Quên mật khẩu"
    })
}
module.exports.forgotPasswordPost=async(req,res)=>{
    const {email}=req.body;
    
    //Kiểm tra email tồn tại không
    const existAccount =await AccountAdmin.findOne({
        email:email 
        
    });
    if(!existAccount){
        res.json({
            code:"error",
            message:"Email không tồn tại trong hệ thống"
        })
        return;
    }
    //Tạo mã OTP
    const otp=generateRandomNumber.generateRandomNumber(6);
    console.log(otp);
    //Kiểm tra email đã tồn tại trong ForgotPassword chưa:
    const existEmailInForgotPassword=await ForgotPassword.findOne({
        email:email
    })
    if(existEmailInForgotPassword){
        res.json({
            code:"error",
            message:"Vui lòng gửi lại yêu cầu sau 5 phút"
        })
        return;
    }
    //Lưu vào database email,otp, sau 5 phút xoá bản ghi
    const newRecord=new ForgotPassword({
        email:email,
        otp:otp,
        expireAt:new Date(Date.now()+5*60*1000)
    })
    await newRecord.save();
    //Gửi OTP qua email cho người dùng:
    const subject="Mã OTP đặt lại mật khẩu";
    const content=`<p>Mã OTP của bạn là:<b style="color:red;">${otp}</b>. Mã OTP có hiệu lực trong 5 phút.</p>`;
    sendMail.sendMail(email,subject,content);
    res.json({
        code:"success",
        message:"Đã gửi mã OTP thành công"
    })
}
module.exports.otpPassword=async(req,res)=>{
    res.render("admin/pages/otp-password.pug",{
        pageTitle:"Xác thực OTP"
    })
}
module.exports.otpPasswordPost=async(req,res)=>{
    const {email,otp}=req.body;
    const existRecord=await ForgotPassword.findOne({
        email:email,
        otp:otp
    });
    if(!existRecord){
        res.json({
            code:"error",
            message:"Mã OTP nhập không chính xác"
        })
        return;
    }
    const existAccount=await AccountAdmin.findOne({
        email:email
    });
    const token=jwt.sign({
        id:existAccount.id,
        email:existAccount.email
    },process.env.JWT_SECRET,{expiresIn: "5m"});
    //token có thời hạn 5 phút
    //LƯU TOKEN VÀO COOKIE hiệu lực 5 phút
    res.cookie("token",token,{
        maxAge: 5*60*1000,
        httpOnly:true,
        sameSite:"strict"
    })
    
    res.json({
        code:"success",
        message:"Xác thực OTP thành công"
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
module.exports.resetPasswordPost=async(req,res)=>{
    const {password}=req.body;
    const salt=await bcrypt.genSalt(10);
    const hashPassword=await bcrypt.hash(password,salt);
    await AccountAdmin.updateOne({
        _id:req.account.id
    },
    {
        password:hashPassword
    }
)
    res.json({
        code:"success",
        message:"Đổi mật khẩu thành công"
    })


}