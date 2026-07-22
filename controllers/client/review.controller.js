const moment=require('moment');
const Notification=require('../../models/notification.model');
const Order=require('../../models/order.model');
const Review=require('../../models/review.model');
const Tour=require('../../models/tour.model');

const getEligibleTours=async userId=>{
  const [orders,reviews]=await Promise.all([
    Order.find({
      userId,
      deleted:false,
      paymentStatus:'paid',
      status:'completed'
    }).sort({createdAt:-1}).lean(),
    Review.find({userId,deleted:false}).select('tourId').lean()
  ]);
  const reviewedTourIds=new Set(reviews.map(review=>String(review.tourId)));
  const candidates=[];
  const seen=new Set();

  orders.forEach(order=>{
    (order.items || []).forEach(item=>{
      const tourId=String(item.tourId);
      if(!reviewedTourIds.has(tourId) && !seen.has(tourId)){
        seen.add(tourId);
        candidates.push({tourId,item,order});
      }
    });
  });

  const tours=await Tour.find({
    _id:{$in:candidates.map(candidate=>candidate.tourId)},
    deleted:false
  }).select('name slug avatar').lean();
  const tourMap=new Map(tours.map(tour=>[String(tour._id),tour]));

  return candidates.filter(candidate=>tourMap.has(candidate.tourId)).map(candidate=>({
    orderId:candidate.order._id,
    orderCode:candidate.order.orderCode,
    tour:tourMap.get(candidate.tourId),
    departureDateLabel:candidate.item.departureDate
      ? moment(candidate.item.departureDate).format('DD/MM/YYYY')
      : 'Đã hoàn thành'
  }));
};

module.exports.list=async(req,res)=>{
  const [reviews,eligibleTours]=await Promise.all([
    Review.find({userId:req.user.id,deleted:false})
      .populate('tourId','name slug avatar')
      .sort({createdAt:-1})
      .lean(),
    getEligibleTours(req.user.id)
  ]);

  res.render('client/pages/account/reviews',{
    pageTitle:'Đánh giá của tôi',
    activeAccountPage:'reviews',
    eligibleTours,
    reviews:reviews.filter(item=>item.tourId).map(item=>({
      ...item,
      createdAtLabel:moment(item.createdAt).format('DD/MM/YYYY')
    }))
  });
};

module.exports.create=async(req,res)=>{
  try{
    const order=await Order.findOne({
      _id:req.body.orderId,
      userId:req.user.id,
      deleted:false,
      paymentStatus:'paid',
      status:'completed',
      'items.tourId':req.body.tourId
    });
    if(!order){
      return res.status(403).json({
        code:'error',
        message:'Bạn chỉ có thể đánh giá tour đã mua và hoàn thành!'
      });
    }

    const review=await Review.create({
      userId:req.user.id,
      tourId:req.body.tourId,
      orderId:order.id,
      rating:req.body.rating,
      comment:req.body.comment
    });
    await Notification.create({
      userId:req.user.id,
      title:'Cảm ơn đánh giá của bạn',
      message:'Đánh giá tour đã được ghi nhận và hiển thị trên trang chi tiết.',
      type:'review',
      link:'/account/reviews'
    });

    res.status(201).json({
      code:'success',
      message:'Gửi đánh giá thành công!',
      reviewId:review.id,
      redirect:'/account/reviews'
    });
  }
  catch(error){
    if(error && error.code===11000){
      return res.status(409).json({code:'error',message:'Bạn đã đánh giá tour này!'});
    }
    res.status(500).json({code:'error',message:'Không thể gửi đánh giá lúc này!'});
  }
};

module.exports.update=async(req,res)=>{
  const review=await Review.findOneAndUpdate({
    _id:req.params.id,
    userId:req.user.id,
    deleted:false
  },{
    rating:req.body.rating,
    comment:req.body.comment
  },{new:true,runValidators:true});

  if(!review){
    return res.status(404).json({code:'error',message:'Không tìm thấy đánh giá!'});
  }
  res.json({code:'success',message:'Cập nhật đánh giá thành công!',redirect:'/account/reviews'});
};

module.exports.remove=async(req,res)=>{
  const result=await Review.updateOne({
    _id:req.params.id,
    userId:req.user.id,
    deleted:false
  },{
    deleted:true,
    deletedAt:new Date()
  });

  if(!result.matchedCount){
    return res.status(404).json({code:'error',message:'Không tìm thấy đánh giá!'});
  }
  res.json({code:'success',message:'Đã xóa đánh giá!',redirect:'/account/reviews'});
};
