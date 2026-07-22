const jwt=require('jsonwebtoken');
const User=require('../../models/user.model');
const Notification=require('../../models/notification.model');

const getReturnTo=req=>{
  if(req.method==='GET'){
    return req.originalUrl;
  }
  try{
    const referer=new URL(req.get('referer'));
    return `${referer.pathname}${referer.search}`;
  }
  catch(error){
    return '/';
  }
};

module.exports.optionalAuth=async(req,res,next)=>{
  res.locals.user=null;
  res.locals.cartCount=0;
  res.locals.notificationUnreadCount=0;
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
    res.locals.cartCount=user.cart.length;
    res.locals.notificationUnreadCount=await Notification.countDocuments({
      userId:user.id,
      deleted:false,
      readAt:null
    }).catch(()=>0);
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
    const returnTo=encodeURIComponent(getReturnTo(req));
    return res.redirect(`/auth/login?returnTo=${returnTo}`);
  }

  res.status(401).json({
    code:'error',
    message:'Vui lòng đăng nhập để tiếp tục!',
    redirect:`/auth/login?returnTo=${encodeURIComponent(getReturnTo(req))}`
  });
};
