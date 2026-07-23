const AccountAdmin=require('../../models/account-admin.model');
const bcrypt=require('bcrypt');
const crypto=require('crypto');
const jwt=require('jsonwebtoken');
const sendMail=require('../../helpers/mail.helper');
const ForgotPassword=require('../../models/forgot-password.model');

const resetCookieName='tokenResetAdmin';
const otpLifetime=5*60*1000;
const resetLifetime=10*60*1000;
const maxOtpAttempts=5;

const cookieOptions=maxAge=>({
  maxAge,
  httpOnly:true,
  sameSite:'strict',
  secure:process.env.NODE_ENV==='production'
});

const getResetRequest=async req=>{
  const token=req.cookies[resetCookieName];
  if(!token){
    return null;
  }

  try{
    const decoded=jwt.verify(token,process.env.JWT_SECRET);
    if(decoded.purpose!=='reset-admin-password'){
      return null;
    }
    return ForgotPassword.findOne({
      _id:decoded.requestId,
      userId:decoded.id,
      email:decoded.email,
      verifiedAt:{$ne:null},
      expireAt:{$gt:new Date()}
    });
  }
  catch(error){
    return null;
  }
};

module.exports.login=(req,res)=>{
  res.render('admin/pages/login.pug',{pageTitle:'Đăng nhập'});
};

module.exports.loginPost=async(req,res)=>{
  try{
    const {email,password,rememberPassword}=req.body;
    const existAccount=await AccountAdmin.findOne({
      email,
      deleted:false
    }).select('+password');

    if(!existAccount || !(await bcrypt.compare(password,existAccount.password))){
      return res.status(401).json({
        code:'error',
        message:'Email hoặc mật khẩu không chính xác'
      });
    }
    if(existAccount.status!=='active'){
      return res.status(403).json({
        code:'error',
        message:'Tài khoản của bạn chưa được kích hoạt. Vui lòng liên hệ quản trị viên.'
      });
    }

    const maxAge=rememberPassword ? 30*24*60*60*1000 : 150*60*1000;
    const token=jwt.sign({
      id:existAccount.id,
      email:existAccount.email,
      purpose:'admin-session'
    },process.env.JWT_SECRET,{expiresIn:rememberPassword ? '30d' : '150m'});

    res.cookie('token',token,cookieOptions(maxAge));
    return res.json({code:'success',message:'Đăng nhập tài khoản thành công'});
  }
  catch(error){
    return res.status(500).json({code:'error',message:'Không thể đăng nhập lúc này'});
  }
};

module.exports.logout=(req,res)=>{
  res.clearCookie('token');
  res.json({code:'success',message:'Đăng xuất thành công'});
};

module.exports.forgotPassword=(req,res)=>{
  res.render('admin/pages/forgot-password.pug',{pageTitle:'Quên mật khẩu'});
};

module.exports.forgotPasswordPost=async(req,res)=>{
  try{
    const existAccount=await AccountAdmin.findOne({
      email:req.body.email,
      status:'active',
      deleted:false
    });
    if(!existAccount){
      return res.status(404).json({code:'error',message:'Email không tồn tại trong hệ thống'});
    }

    const existingRequest=await ForgotPassword.findOne({email:existAccount.email});
    if(existingRequest && existingRequest.expireAt>new Date()){
      return res.status(429).json({code:'error',message:'Vui lòng gửi lại yêu cầu sau 5 phút'});
    }
    if(existingRequest){
      await existingRequest.deleteOne();
    }

    const otp=crypto.randomInt(0,1000000).toString().padStart(6,'0');
    const resetRequest=await ForgotPassword.create({
      userId:existAccount.id,
      email:existAccount.email,
      otpHash:await bcrypt.hash(otp,10),
      expireAt:new Date(Date.now()+otpLifetime)
    });
    const mailResult=await sendMail.sendMail(
      existAccount.email,
      'Mã OTP đặt lại mật khẩu',
      `<p>Mã OTP của bạn là: <b style="color:red;">${otp}</b>. Mã có hiệu lực trong 5 phút.</p>`
    );
    if(!mailResult.success){
      await resetRequest.deleteOne();
      return res.status(500).json({code:'error',message:'Không thể gửi email lúc này'});
    }

    return res.json({code:'success',message:'Đã gửi mã OTP thành công'});
  }
  catch(error){
    if(error && error.code===11000){
      return res.status(429).json({code:'error',message:'Vui lòng gửi lại yêu cầu sau 5 phút'});
    }
    return res.status(500).json({code:'error',message:'Không thể xử lý yêu cầu lúc này'});
  }
};

module.exports.otpPassword=(req,res)=>{
  if(!req.query.email){
    return res.redirect(`/${pathAdmin}/account/forgot-password`);
  }
  res.render('admin/pages/otp-password.pug',{pageTitle:'Xác thực OTP'});
};

module.exports.otpPasswordPost=async(req,res)=>{
  try{
    const resetRequest=await ForgotPassword.findOne({
      email:req.body.email,
      verifiedAt:null,
      expireAt:{$gt:new Date()}
    }).select('+otpHash');
    if(!resetRequest){
      return res.status(400).json({code:'error',message:'Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới'});
    }

    if(!(await bcrypt.compare(req.body.otp,resetRequest.otpHash))){
      resetRequest.attempts+=1;
      const remainingAttempts=maxOtpAttempts-resetRequest.attempts;
      if(remainingAttempts<=0){
        await resetRequest.deleteOne();
        return res.status(429).json({code:'error',message:'Bạn đã nhập sai quá nhiều lần. Vui lòng yêu cầu mã mới'});
      }
      await resetRequest.save();
      return res.status(400).json({
        code:'error',
        message:`Mã OTP không chính xác. Bạn còn ${remainingAttempts} lần thử`
      });
    }

    resetRequest.verifiedAt=new Date();
    resetRequest.expireAt=new Date(Date.now()+resetLifetime);
    await resetRequest.save();
    const token=jwt.sign({
      id:resetRequest.userId,
      email:resetRequest.email,
      requestId:resetRequest.id,
      purpose:'reset-admin-password'
    },process.env.JWT_SECRET,{expiresIn:'10m'});
    res.cookie(resetCookieName,token,cookieOptions(resetLifetime));
    return res.json({code:'success',message:'Xác thực OTP thành công'});
  }
  catch(error){
    return res.status(500).json({code:'error',message:'Không thể xác thực OTP lúc này'});
  }
};

module.exports.resetPassword=async(req,res)=>{
  const resetRequest=await getResetRequest(req);
  if(!resetRequest){
    res.clearCookie(resetCookieName);
    return res.redirect(`/${pathAdmin}/account/forgot-password`);
  }
  return res.render('admin/pages/reset-password.pug',{pageTitle:'Đổi mật khẩu'});
};

module.exports.resetPasswordPost=async(req,res)=>{
  try{
    const resetRequest=await getResetRequest(req);
    if(!resetRequest){
      res.clearCookie(resetCookieName);
      return res.status(401).json({code:'error',message:'Phiên đặt lại mật khẩu đã hết hạn'});
    }

    const account=await AccountAdmin.findOne({
      _id:resetRequest.userId,
      email:resetRequest.email,
      status:'active',
      deleted:false
    }).select('+password');
    if(!account){
      await resetRequest.deleteOne();
      res.clearCookie(resetCookieName);
      return res.status(404).json({code:'error',message:'Không tìm thấy tài khoản'});
    }
    if(await bcrypt.compare(req.body.password,account.password)){
      return res.status(400).json({code:'error',message:'Mật khẩu mới không được trùng với mật khẩu cũ'});
    }

    account.password=await bcrypt.hash(req.body.password,10);
    await account.save();
    await resetRequest.deleteOne();
    res.clearCookie(resetCookieName);
    res.clearCookie('token');
    return res.json({code:'success',message:'Đổi mật khẩu thành công'});
  }
  catch(error){
    return res.status(500).json({code:'error',message:'Không thể đổi mật khẩu lúc này'});
  }
};
