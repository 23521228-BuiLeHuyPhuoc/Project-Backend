const Favorite=require('../../models/favorite.model');
const Notification=require('../../models/notification.model');
const Order=require('../../models/order.model');
const UserVoucher=require('../../models/user-voucher.model');

module.exports.meta=async(req,res,next)=>{
  try{
    const userId=req.user.id;
    const [orderCount,favoriteCount,unreadCount,voucherCount]=await Promise.all([
      Order.countDocuments({userId,deleted:false}),
      Favorite.countDocuments({userId}),
      Notification.countDocuments({userId,deleted:false,readAt:null}),
      UserVoucher.countDocuments({userId,status:'available'})
    ]);

    res.locals.accountMeta={
      orderCount,
      favoriteCount,
      unreadCount,
      voucherCount
    };
    next();
  }
  catch(error){
    next(error);
  }
};
