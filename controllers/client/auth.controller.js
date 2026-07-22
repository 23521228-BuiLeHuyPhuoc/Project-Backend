const bcrypt=require('bcrypt');
const jwt=require('jsonwebtoken');
const User=require('../../models/user.model');

const budgetRanges={
  "under-2":{min:0,max:2000000},
  "2-5":{min:2000000,max:5000000},
  "5-10":{min:5000000,max:10000000},
  "above-10":{min:10000000,max:1000000000000}
};

module.exports.login=(req,res)=>{
  if(req.user){
    return res.redirect('/');
  }
  res.render('client/pages/auth/login',{
    pageTitle:'Đăng nhập'
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

    await User.create({
      fullName:req.body.fullName,
      email:req.body.email,
      phone:req.body.phone,
      password,
      preferences
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
    res.json({
      code:'success',
      redirect:'/'
    });
  }
  catch(error){
    res.status(500).json({
      code:'error',
      message:'Không thể đăng nhập lúc này!'
    });
  }
};

module.exports.logout=(req,res)=>{
  res.clearCookie('tokenUser');
  req.flash('success','Đăng xuất thành công!');
  res.redirect('/');
};
