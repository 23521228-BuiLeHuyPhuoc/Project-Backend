const Favorite=require('../../models/favorite.model');
const Order=require('../../models/order.model');
const UserVoucher=require('../../models/user-voucher.model');

module.exports.meta=async(req,res,next)=>{
  try{
    const userId=req.user.id;
    const orderBadgeFind={userId,deleted:false};
    const favoriteBadgeFind={userId};
    const ordersSeenAt=req.user.accountSeenAt && req.user.accountSeenAt.orders;
    const favoritesSeenAt=req.user.accountSeenAt && req.user.accountSeenAt.favorites;

    if(ordersSeenAt){
      orderBadgeFind.createdAt={$gt:ordersSeenAt};
    }
    if(favoritesSeenAt){
      favoriteBadgeFind.createdAt={$gt:favoritesSeenAt};
    }

    const [orderCount,favoriteCount,voucherCount,orderBadgeCount,favoriteBadgeCount]=await Promise.all([
      Order.countDocuments({userId,deleted:false}),
      Favorite.countDocuments({userId}),
      UserVoucher.countDocuments({userId,status:'available'}),
      Order.countDocuments(orderBadgeFind),
      Favorite.countDocuments(favoriteBadgeFind)
    ]);

    res.locals.accountMeta={
      orderCount,
      favoriteCount,
      orderBadgeCount,
      favoriteBadgeCount,
      unreadCount:res.locals.notificationUnreadCount,
      voucherCount
    };
    next();
  }
  catch(error){
    next(error);
  }
};
