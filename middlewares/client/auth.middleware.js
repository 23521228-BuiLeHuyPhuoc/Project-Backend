const jwt=require('jsonwebtoken');
const User=require('../../models/user.model');

module.exports.optionalAuth=async(req,res,next)=>{
  res.locals.user=null;
  const token=req.cookies.tokenUser;

  if(!token){
    return next();
  }

  try{
    const decoded=jwt.verify(token,process.env.JWT_SECRET);
    const user=await User.findOne({
      _id:decoded.id,
      email:decoded.email,
      status:"active",
      deleted:false
    });

    if(!user){
      res.clearCookie("tokenUser");
      return next();
    }

    req.user=user;
    res.locals.user=user;
    next();
  }
  catch(error){
    res.clearCookie("tokenUser");
    next();
  }
};

module.exports.requireAuth=(req,res,next)=>{
  if(req.user){
    return next();
  }

  if(req.method==='GET'){
    return res.redirect('/auth/login');
  }

  res.status(401).json({
    code:'error',
    message:'Vui lòng đăng nhập để tiếp tục!',
    redirect:'/auth/login'
  });
};
