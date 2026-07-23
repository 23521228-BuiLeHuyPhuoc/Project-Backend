const jwt=require('jsonwebtoken');
const AccountAdmin=require('../../models/account-admin.model');

module.exports.requireAdmin=async(req,res,next)=>{
  res.setHeader('Cache-Control','no-store');
  const token=req.cookies && req.cookies.token;
  if(!token){
    return res.status(401).json({
      code:'error',
      message:'Admin authentication is required.'
    });
  }

  try{
    const decoded=jwt.verify(token,process.env.JWT_SECRET);
    if(decoded.purpose!=='admin-session'){
      throw new Error('Invalid token purpose');
    }

    const account=await AccountAdmin.findOne({
      _id:decoded.id,
      email:decoded.email,
      status:'active',
      deleted:false
    });
    if(!account){
      return res.status(401).json({
        code:'error',
        message:'Admin session is no longer valid.'
      });
    }

    req.account=account;
    return next();
  }
  catch(error){
    res.clearCookie('token');
    return res.status(401).json({
      code:'error',
      message:'Admin session is invalid or expired.'
    });
  }
};
