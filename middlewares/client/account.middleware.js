const Favorite=require('../../models/favorite.model');
const Order=require('../../models/order.model');
const UserVoucher=require('../../models/user-voucher.model');

module.exports.meta=async(req,res,next)=>{
  try{
    const userId=req.user.id;
    const [orderCount,favoriteCount,voucherCount]=await Promise.all([
      Order.countDocuments({userId,deleted:false}),
      Favorite.countDocuments({userId}),
      UserVoucher.countDocuments({userId,status:'available'})
    ]);

    res.locals.accountMeta={
      orderCount,
      favoriteCount,
      unreadCount:res.locals.notificationUnreadCount,
      voucherCount
    };
    next();
  }
  catch(error){
    next(error);
  }
};
