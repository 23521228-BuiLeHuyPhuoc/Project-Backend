const bcrypt=require('bcrypt');
const crypto=require('crypto');
const jwt=require('jsonwebtoken');
const User=require('../../models/user.model');
const ForgotPasswordUser=require('../../models/forgot-password-user.model');
const sendMail=require('../../helpers/mail.helper');
const {createNotificationSafe}=require('../../helpers/notification.helper');

const resetCookieName='tokenResetUser';
const otpLifetime=5*60*1000;
const resetLifetime=10*60*1000;
const maxOtpAttempts=5;

const getSafeReturnTo=value=>{
  if(typeof value!=='string' || !value.startsWith('/')){
    return '/';
  }
  try{
    const baseUrl='http://localhost';
    const url=new URL(value,baseUrl);
    return url.origin===baseUrl ? `${url.pathname}${url.search}${url.hash}` : '/';
  }
  catch(error){
    return '/';
  }
};

const budgetRanges={
  "under-2":{min:0,max:2000000},
  "2-5":{min:2000000,max:5000000},
  "5-10":{min:5000000,max:10000000},
  "above-10":{min:10000000,max:1000000000000}
};

const getResetRequest=async(req)=>{
  const token=req.cookies[resetCookieName];
  if(!token){
    return null;
  }

  try{
    const decoded=jwt.verify(token,process.env.JWT_SECRET);
    if(decoded.purpose!=='reset-user-password'){
      return null;
    }

    return ForgotPasswordUser.findOne({
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
  if(req.user){
    return res.redirect('/');
  }
  const returnTo=typeof req.query.returnTo==='string' ? req.query.returnTo : '';
  res.render('client/pages/auth/login',{
    pageTitle:'Đăng nhập',
    returnTo
  });
};

module.exports.register=(req,res)=>{
  if(req.user){
    return res.redirect('/');
  }
  res.render('client/pages/auth/register',{
    pageTitle:'Đăng ký'
  });
};

module.exports.registerPost=async(req,res)=>{
  try{
    const existingUser=await User.findOne({email:req.body.email});
    if(existingUser){
      return res.status(409).json({
        code:'error',
        message:'Email đã được sử dụng!'
      });
    }

    const salt=await bcrypt.genSalt(10);
    const password=await bcrypt.hash(req.body.password,salt);
    const preferences={
      tourTypes:req.body.tourTypes,
      budgetRange:budgetRanges[req.body.budgetRange] || {min:0,max:0},
      locations:req.body.locations
    };

    const user=await User.create({
      fullName:req.body.fullName,
      email:req.body.email,
      phone:req.body.phone,
      password,
      preferences
    });

    await createNotificationSafe({
      userId:user.id,
      title:'Chào mừng đến với 28.TRAVEL',
      message:'Tài khoản của bạn đã sẵn sàng. Hãy lưu tour yêu thích và khám phá các voucher mới.',
      type:'account',
      link:'/account'
    });

    req.flash('success','Đăng ký tài khoản thành công!');
    res.status(201).json({
      code:'success',
      redirect:'/auth/login'
    });
  }
  catch(error){
    if(error && error.code===11000){
      return res.status(409).json({
        code:'error',
        message:'Email đã được sử dụng!'
      });
    }
    res.status(500).json({
      code:'error',
      message:'Không thể tạo tài khoản lúc này!'
    });
  }
};

module.exports.loginPost=async(req,res)=>{
  try{
    const user=await User.findOne({
      email:req.body.email,
      status:'active',
      deleted:false
    }).select('+password');

    if(!user || !(await bcrypt.compare(req.body.password,user.password))){
      return res.status(401).json({
        code:'error',
        message:'Email hoặc mật khẩu không chính xác!'
      });
    }

    const rememberPassword=req.body.rememberPassword;
    const expiresIn=rememberPassword ? '30d' : '1d';
    const maxAge=rememberPassword
      ? 30*24*60*60*1000
      : 24*60*60*1000;
    const token=jwt.sign({
      id:user.id,
      email:user.email
    },process.env.JWT_SECRET,{expiresIn});

    res.cookie('tokenUser',token,{
      maxAge,
      httpOnly:true,
      sameSite:'lax',
      secure:process.env.NODE_ENV==='production'
    });
    req.flash('success','Đăng nhập thành công!');
    const returnTo=getSafeReturnTo(req.body.returnTo);
    res.json({
      code:'success',
      redirect:returnTo
    });
  }
  catch(error){
    res.status(500).json({
      code:'error',
      message:'Không thể đăng nhập lúc này!'
    });
  }
};

module.exports.forgotPassword=(req,res)=>{
  if(req.user){
    return res.redirect('/');
  }

  res.render('client/pages/auth/forgot-password',{
    pageTitle:'Quên mật khẩu'
  });
};

module.exports.forgotPasswordPost=async(req,res)=>{
  try{
    const user=await User.findOne({
      email:req.body.email,
      status:'active',
      deleted:false
    });

    if(!user){
      return res.status(404).json({
        code:'error',
        message:'Email không tồn tại hoặc tài khoản chưa được kích hoạt!'
      });
    }

    const existingRequest=await ForgotPasswordUser.findOne({email:user.email});
    if(existingRequest && existingRequest.expireAt>new Date()){
      return res.status(429).json({
        code:'error',
        message:'Mã OTP đã được gửi. Vui lòng thử lại sau 5 phút!'
      });
    }
    if(existingRequest){
      await existingRequest.deleteOne();
    }

    const otp=crypto.randomInt(0,1000000).toString().padStart(6,'0');
    const otpHash=await bcrypt.hash(otp,10);
    const resetRequest=await ForgotPasswordUser.create({
      userId:user.id,
      email:user.email,
      otpHash,
      expireAt:new Date(Date.now()+otpLifetime)
    });

    const mailResult=await sendMail.sendMail(
      user.email,
      'Mã OTP đặt lại mật khẩu 28.TRAVEL',
      `<p>Mã OTP đặt lại mật khẩu của bạn là: <strong style="color:#4502C7;font-size:20px;letter-spacing:3px">${otp}</strong>.</p><p>Mã có hiệu lực trong 5 phút. Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>`
    );

    if(!mailResult.success){
      await resetRequest.deleteOne();
      return res.status(500).json({
        code:'error',
        message:'Không thể gửi email lúc này. Vui lòng thử lại sau!'
      });
    }

    res.json({
      code:'success',
      redirect:`/auth/otp-password?email=${encodeURIComponent(user.email)}`
    });
  }
  catch(error){
    if(error && error.code===11000){
      return res.status(429).json({
        code:'error',
        message:'Mã OTP đã được gửi. Vui lòng thử lại sau 5 phút!'
      });
    }
    res.status(500).json({
      code:'error',
      message:'Không thể xử lý yêu cầu lúc này!'
    });
  }
};

module.exports.otpPassword=(req,res)=>{
  if(req.user){
    return res.redirect('/');
  }
  if(!req.query.email){
    return res.redirect('/auth/forgot-password');
  }

  res.render('client/pages/auth/otp-password',{
    pageTitle:'Xác thực OTP',
    email:req.query.email
  });
};

module.exports.otpPasswordPost=async(req,res)=>{
  try{
    const resetRequest=await ForgotPasswordUser.findOne({
      email:req.body.email,
      expireAt:{$gt:new Date()}
    }).select('+otpHash');

    if(!resetRequest){
      return res.status(400).json({
        code:'error',
        message:'Mã OTP đã hết hạn. Vui lòng gửi yêu cầu mới!'
      });
    }

    const isValidOtp=await bcrypt.compare(req.body.otp,resetRequest.otpHash);
    if(!isValidOtp){
      resetRequest.attempts+=1;
      const remainingAttempts=maxOtpAttempts-resetRequest.attempts;

      if(remainingAttempts<=0){
        await resetRequest.deleteOne();
        return res.status(429).json({
          code:'error',
          message:'Bạn đã nhập sai quá nhiều lần. Vui lòng gửi mã OTP mới!'
        });
      }

      await resetRequest.save();
      return res.status(400).json({
        code:'error',
        message:`Mã OTP không chính xác. Bạn còn ${remainingAttempts} lần thử!`
      });
    }

    resetRequest.verifiedAt=new Date();
    resetRequest.expireAt=new Date(Date.now()+resetLifetime);
    await resetRequest.save();

    const token=jwt.sign({
      id:resetRequest.userId,
      email:resetRequest.email,
      requestId:resetRequest.id,
      purpose:'reset-user-password'
    },process.env.JWT_SECRET,{expiresIn:'10m'});

    res.cookie(resetCookieName,token,{
      maxAge:resetLifetime,
      httpOnly:true,
      sameSite:'lax',
      secure:process.env.NODE_ENV==='production'
    });
    res.json({
      code:'success',
      redirect:'/auth/reset-password'
    });
  }
  catch(error){
    res.status(500).json({
      code:'error',
      message:'Không thể xác thực mã OTP lúc này!'
    });
  }
};

module.exports.resetPassword=async(req,res)=>{
  if(req.user){
    return res.redirect('/');
  }

  const resetRequest=await getResetRequest(req);
  if(!resetRequest){
    res.clearCookie(resetCookieName);
    return res.redirect('/auth/forgot-password');
  }

  res.render('client/pages/auth/reset-password',{
    pageTitle:'Đặt lại mật khẩu'
  });
};

module.exports.resetPasswordPost=async(req,res)=>{
  try{
    const resetRequest=await getResetRequest(req);
    if(!resetRequest){
      res.clearCookie(resetCookieName);
      return res.status(401).json({
        code:'error',
        message:'Phiên đặt lại mật khẩu đã hết hạn. Vui lòng thực hiện lại!'
      });
    }

    const user=await User.findOne({
      _id:resetRequest.userId,
      email:resetRequest.email,
      status:'active',
      deleted:false
    }).select('+password');

    if(!user){
      await resetRequest.deleteOne();
      res.clearCookie(resetCookieName);
      return res.status(404).json({
        code:'error',
        message:'Không tìm thấy tài khoản cần đặt lại mật khẩu!'
      });
    }

    if(await bcrypt.compare(req.body.password,user.password)){
      return res.status(400).json({
        code:'error',
        message:'Mật khẩu mới không được trùng với mật khẩu hiện tại!'
      });
    }

    user.password=await bcrypt.hash(req.body.password,10);
    await user.save();
    await resetRequest.deleteOne();
    res.clearCookie(resetCookieName);
    req.flash('success','Đặt lại mật khẩu thành công!');
    res.json({
      code:'success',
      redirect:'/auth/login'
    });
  }
  catch(error){
    res.status(500).json({
      code:'error',
      message:'Không thể đặt lại mật khẩu lúc này!'
    });
  }
};

module.exports.logout=(req,res)=>{
  res.clearCookie('tokenUser');
  req.flash('success','Đăng xuất thành công!');
  res.redirect('/');
};
