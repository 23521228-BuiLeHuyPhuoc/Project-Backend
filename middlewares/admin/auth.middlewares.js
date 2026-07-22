const jwt=require('jsonwebtoken');
const AccountAdmin = require('../../models/account-admin.model');
const Role=require('../../models/roles.model');
module.exports.verifyToken=async (req,res,next)=>{
    const token=req.cookies.token;
    if(!token){
    res.redirect(`/${pathAdmin}/account/login`)
    return;
    }
    try{ 
    const decoded=jwt.verify(token,process.env.JWT_SECRET);
    const{ id , email}=decoded;
    const existAccount=await AccountAdmin.findOne({
        _id: id,
        email: email,
        status: "active",
        deleted:false
    })
    if(!existAccount){
        res.clearCookie("token");
        res.redirect(`/${pathAdmin}/account/login`)
        return;
    }
    let role=null;
    let permissions=[];
    if(existAccount.role){
        role=await Role.findOne({
            _id:existAccount.role,
            deleted:false
        })
    }
    if(role){
        permissions=role.permissions;
    }
    req.permissions=permissions;
    req.account=existAccount;
    res.locals.account=existAccount;
    res.locals.role=role;
    res.locals.permission=permissions;
    next();
}
catch(error){
    res.clearCookie("token");
    res.redirect(`/${pathAdmin}/account/login`)
}
}
