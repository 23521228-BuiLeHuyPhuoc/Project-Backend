const jwt=require('jsonwebtoken');
const mongoose=require('mongoose');
const moment=require('moment');
const Favorite=require('../../models/favorite.model');
const Notification=require('../../models/notification.model');
const {createNotificationSafe}=require('../../helpers/notification.helper');
const Order=require('../../models/order.model');
const Review=require('../../models/review.model');
const Tour=require('../../models/tour.model');
const User=require('../../models/user.model');
const UserVoucher=require('../../models/user-voucher.model');
const {cancelOrderAndRelease}=require('../../helpers/order.helper');
const {
  invalidateRecommendationCache
}=require('../../services/recommendation/cache-manager');

const budgetRanges={
  "under-2":{min:0,max:2000000},
  "2-5":{min:2000000,max:5000000},
  "5-10":{min:5000000,max:10000000},
  "above-10":{min:10000000,max:1000000000000}
};

const statusLabels={
  initial:'Chờ xác nhận',
  pending:'Đang xử lý',
  confirmed:'Đã xác nhận',
  completed:'Hoàn thành',
  cancelled:'Đã hủy'
};

const paymentLabels={
  paid:'Đã thanh toán',
  unpaid:'Chưa thanh toán'
};

const getBudgetKey=budgetRange=>{
  if(!budgetRange){
    return '';
  }
  return Object.keys(budgetRanges).find(key=>{
    const range=budgetRanges[key];
    return range.min===budgetRange.min && range.max===budgetRange.max;
  }) || '';
};

const enrichOrders=async orders=>{
  const tourIds=[...new Set(orders.flatMap(order=>(order.items || []).map(item=>String(item.tourId))))];
  const tours=await Tour.find({_id:{$in:tourIds}}).select('name slug avatar').lean();
  const tourMap=new Map(tours.map(tour=>[String(tour._id),tour]));

  return orders.map(order=>({
    ...order,
    statusLabel:statusLabels[order.status] || order.status,
    paymentLabel:paymentLabels[order.paymentStatus] || order.paymentStatus,
    createdAtLabel:moment(order.createdAt).format('DD/MM/YYYY HH:mm'),
    canCancel:['initial','pending'].includes(order.status)
      && order.paymentStatus==='unpaid'
      && ['money','bank'].includes(order.paymentMethod),
    items:(order.items || []).map(item=>({
      ...item,
      tour:tourMap.get(String(item.tourId)),
      departureDateLabel:item.departureDate
        ? moment(item.departureDate).format('DD/MM/YYYY')
        : 'Đang cập nhật'
    }))
  }));
};

module.exports.dashboard=async(req,res)=>{
  const userId=req.user.id;
  const [orders,notifications,reviewCount]=await Promise.all([
    Order.find({userId,deleted:false}).sort({createdAt:-1}).limit(3).lean(),
    Notification.find({userId,deleted:false}).sort({createdAt:-1}).limit(4).lean(),
    Review.countDocuments({userId,deleted:false})
  ]);

  const latestOrders=await enrichOrders(orders);
  const latestNotifications=notifications.map(item=>({
    ...item,
    createdAtLabel:moment(item.createdAt).fromNow()
  }));

  res.render('client/pages/account/dashboard',{
    pageTitle:'Tài khoản của tôi',
    activeAccountPage:'dashboard',
    latestOrders,
    latestNotifications,
    reviewCount
  });
};

module.exports.orders=async(req,res)=>{
  const viewedAt=new Date();
  const allowedStatuses=['initial','pending','confirmed','completed','cancelled'];
  const find={userId:req.user.id,deleted:false};
  if(allowedStatuses.includes(req.query.status)){
    find.status=req.query.status;
  }

  const orders=await Order.find(find).sort({createdAt:-1}).lean();
  await User.updateOne({_id:req.user.id},{
    $set:{'accountSeenAt.orders':viewedAt}
  });
  res.locals.accountMeta.orderBadgeCount=0;
  res.render('client/pages/account/orders',{
    pageTitle:'Đơn hàng của tôi',
    activeAccountPage:'orders',
    orders:await enrichOrders(orders),
    selectedStatus:req.query.status || ''
  });
};

module.exports.orderDetail=async(req,res)=>{
  if(!mongoose.isValidObjectId(req.params.id)){
    return res.redirect('/account/orders');
  }
  const viewedAt=new Date();
  const order=await Order.findOne({
    _id:req.params.id,
    userId:req.user.id,
    deleted:false
  }).lean();

  if(!order){
    return res.redirect('/account/orders');
  }

  await User.updateOne({_id:req.user.id},{
    $set:{'accountSeenAt.orders':viewedAt}
  });
  res.locals.accountMeta.orderBadgeCount=0;
  const [orderDetail]=await enrichOrders([order]);
  res.render('client/pages/account/order-detail',{
    pageTitle:`Đơn hàng ${order.orderCode}`,
    activeAccountPage:'orders',
    order:orderDetail
  });
};

module.exports.cancelOrder=async(req,res)=>{
  try{
    if(!mongoose.isValidObjectId(req.params.id)){
      return res.status(400).json({code:'error',message:'Đơn hàng không hợp lệ!'});
    }
    const order=await cancelOrderAndRelease({
      _id:req.params.id,
      userId:req.user.id,
      status:{$in:['initial','pending']},
      paymentStatus:'unpaid',
      paymentMethod:{$in:['money','bank']}
    });

    if(!order){
      return res.status(400).json({
        code:'error',
        message:'Đơn hàng không thể hủy ở trạng thái hiện tại!'
      });
    }

    await createNotificationSafe({
      userId:req.user.id,
      title:'Đơn hàng đã được hủy',
      message:`Đơn ${order.orderCode} đã được hủy theo yêu cầu của bạn.`,
      type:'order',
      link:`/account/orders/${order.id}`
    });

    res.json({
      code:'success',
      message:'Hủy đơn hàng thành công!',
      redirect:'/account/orders'
    });
  }
  catch(error){
    res.status(500).json({
      code:'error',
      message:'Không thể hủy đơn hàng lúc này!'
    });
  }
};

module.exports.profile=async(req,res)=>{
  res.render('client/pages/account/profile',{
    pageTitle:'Thông tin tài khoản',
    activeAccountPage:'profile',
    budgetKey:getBudgetKey(req.user.preferences && req.user.preferences.budgetRange)
  });
};

module.exports.updateProfile=async(req,res)=>{
  try{
    const duplicateUser=await User.findOne({
      email:req.body.email,
      _id:{$ne:req.user.id}
    });
    if(duplicateUser){
      return res.status(409).json({
        code:'error',
        message:'Email đã được sử dụng bởi tài khoản khác!'
      });
    }

    const user=await User.findById(req.user.id);
    if(!user){
      return res.status(404).json({
        code:'error',
        message:'Không tìm thấy tài khoản!'
      });
    }

    user.fullName=req.body.fullName;
    user.email=req.body.email;
    user.phone=req.body.phone;
    user.preferences={
      tourTypes:req.body.tourTypes,
      budgetRange:budgetRanges[req.body.budgetRange] || {min:0,max:0},
      locations:req.body.locations
    };
    await user.save();
    invalidateRecommendationCache(req.app,{userId:user.id});

    const token=jwt.sign({
      id:user.id,
      email:user.email
    },process.env.JWT_SECRET,{expiresIn:'1d'});
    res.cookie('tokenUser',token,{
      maxAge:24*60*60*1000,
      httpOnly:true,
      sameSite:'lax',
      secure:process.env.NODE_ENV==='production'
    });

    await createNotificationSafe({
      userId:user.id,
      title:'Thông tin tài khoản đã thay đổi',
      message:'Hồ sơ cá nhân và sở thích du lịch của bạn vừa được cập nhật.',
      type:'account',
      link:'/account/profile'
    });

    res.json({
      code:'success',
      message:'Cập nhật thông tin thành công!',
      redirect:'/account/profile'
    });
  }
  catch(error){
    res.status(500).json({
      code:'error',
      message:'Không thể cập nhật thông tin lúc này!'
    });
  }
};

module.exports.stats=async(req,res)=>{
  const userId=req.user.id;
  const [orders,favorites,vouchers,reviews,notifications]=await Promise.all([
    Order.countDocuments({userId,deleted:false}),
    Favorite.countDocuments({userId}),
    UserVoucher.countDocuments({userId,status:'available'}),
    Review.countDocuments({userId,deleted:false}),
    Notification.countDocuments({userId,deleted:false,readAt:null})
  ]);
  res.json({code:'success',data:{orders,favorites,vouchers,reviews,notifications}});
};
