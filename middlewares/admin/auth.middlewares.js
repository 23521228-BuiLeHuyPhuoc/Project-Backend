const jwt=require('jsonwebtoken');
const AccountAdmin = require('../../models/account-admin.model');
const Role=require('../../models/roles.model');
const Notification=require('../../models/notification.model');
const moment=require('moment');
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
        permissions=Array.isArray(role.permissions) ? role.permissions : [];
    }
    req.permissions=permissions;
    req.account=existAccount;
    res.locals.account=existAccount;
    res.locals.role=role;
    res.locals.permission=permissions;
    res.locals.adminHeaderNotifications=[];
    res.locals.adminHeaderUnreadCount=0;

    if(permissions.includes('notification-view')){
        try{
            const [notifications,unreadCount]=await Promise.all([
                Notification.find({deleted:false})
                    .select('title message type readAt createdAt userId')
                    .populate('userId','fullName')
                    .sort({createdAt:-1})
                    .limit(5)
                    .lean(),
                Notification.countDocuments({deleted:false,readAt:null})
            ]);
            res.locals.adminHeaderNotifications=notifications.map(item=>({
                ...item,
                createdAtLabel:moment(item.createdAt).format('HH:mm DD/MM/YYYY')
            }));
            res.locals.adminHeaderUnreadCount=unreadCount;
        }
        catch(error){
            console.error('Load admin header notifications error:',error.message);
        }
    }
    next();
}
catch(error){
    res.clearCookie("token");
    res.redirect(`/${pathAdmin}/account/login`)
}
}
