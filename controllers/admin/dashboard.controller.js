const moment=require('moment');
const AccountAdmin=require('../../models/account-admin.model');
const Order=require('../../models/order.model');
const Tour=require('../../models/tour.model');
const {
  createEmptyRecommendationMonitoring,
  loadRecommendationMonitoring
}=require('../../services/recommendation/monitoring');

const statusLabels={
  initial:'Chờ xác nhận',
  pending:'Đang xử lý',
  confirmed:'Đã xác nhận',
  completed:'Hoàn thành',
  cancelled:'Đã hủy'
};

const paymentMethodLabels={
  money:'Tiền mặt',
  bank:'Chuyển khoản ngân hàng',
  zalopay:'ZaloPay',
  vnpay:'VNPay'
};

const trainingReasonLabels={
  startup:'Khởi động hệ thống',
  stale_model:'Model đã cũ',
  missing_model:'Thiếu model',
  interaction_threshold:'Đủ tương tác mới',
  scheduled_interval:'Lịch định kỳ',
  manual:'Thủ công',
  restored:'Khôi phục model'
};

const formatPercent=value=>`${Number(value || 0).toLocaleString('vi-VN',{
  maximumFractionDigits:1
})}%`;

const formatModelMetric=value=>Number.isFinite(value)
  ? Number(value).toLocaleString('vi-VN',{
    minimumFractionDigits:3,
    maximumFractionDigits:4
  })
  : '—';

const getSchedulerStatus=req=>{
  const scheduler=req.app
    && req.app.locals
    && req.app.locals.recommendationScheduler;
  return scheduler && typeof scheduler.getStatus==='function'
    ? scheduler.getStatus()
    : {};
};

const createRecommendationViewModel=metrics=>({
  ...metrics,
  labels:{
    ctr:formatPercent(metrics.engagement.ctr),
    conversion:formatPercent(metrics.conversion.rate),
    averageRating:Number(metrics.quality.averageRating || 0).toLocaleString(
      'vi-VN',
      {minimumFractionDigits:1,maximumFractionDigits:2}
    ),
    coverage:formatPercent(metrics.quality.reviewCoverage),
    rmse:formatModelMetric(metrics.model.rmse),
    mae:formatModelMetric(metrics.model.mae),
    precision:metrics.model.precisionAtK===null
      ? '—'
      : formatPercent(metrics.model.precisionAtK*100),
    lastTraining:metrics.model.lastTrainedAt
      ? moment(metrics.model.lastTrainedAt).format('HH:mm DD/MM/YYYY')
      : 'Chưa có lần train',
    trainingReason:trainingReasonLabels[metrics.model.lastReason]
      || metrics.model.lastReason
      || 'Chưa xác định',
    cacheHitRate:formatPercent(metrics.cache.hitRate)
  }
});

const enrichRecentOrders=async orders=>{
  const tourIds=[...new Set(orders.flatMap(order=>(order.items || []).map(item=>String(item.tourId))))];
  const tours=await Tour.find({_id:{$in:tourIds}}).select('name avatar').lean();
  const tourMap=new Map(tours.map(tour=>[String(tour._id),tour]));

  return orders.map(order=>({
    ...order,
    createdAtTime:moment(order.createdAt).format('HH:mm'),
    createdAtDate:moment(order.createdAt).format('DD/MM/YYYY'),
    statusLabel:statusLabels[order.status] || order.status,
    paymentMethodLabel:paymentMethodLabels[order.paymentMethod] || 'Chưa xác định',
    items:(order.items || []).map(item=>{
      const tour=tourMap.get(String(item.tourId));
      return {
        ...item,
        name:tour ? tour.name : 'Tour không còn tồn tại',
        avatar:item.avatar || (tour && tour.avatar) || '/admin/assets/images/tour-1.jpg'
      };
    })
  }));
};

module.exports.dashboard=async(req,res)=>{
  const schedulerStatus=getSchedulerStatus(req);
  const monitoringPromise=loadRecommendationMonitoring({schedulerStatus})
    .catch(error=>{
      console.error('Unable to load recommendation monitoring:',error.message);
      return createEmptyRecommendationMonitoring(schedulerStatus);
    });
  const [
    totalAdmins,
    totalOrders,
    revenueResult,
    recentOrderRecords,
    recommendationMetrics
  ]=await Promise.all([
    AccountAdmin.countDocuments({deleted:false}),
    Order.countDocuments({deleted:false}),
    Order.aggregate([
      {$match:{deleted:false,paymentStatus:'paid',status:{$ne:'cancelled'}}},
      {$group:{_id:null,total:{$sum:'$total'}}}
    ]),
    Order.find({deleted:false}).sort({createdAt:-1}).limit(5).lean(),
    monitoringPromise
  ]);

  res.render('admin/pages/dashboard',{
    pageTitle:'Tổng quan',
    total:totalAdmins,
    totalOrder:totalOrders,
    totalSum:Number(revenueResult[0] && revenueResult[0].total || 0),
    recentOrders:await enrichRecentOrders(recentOrderRecords),
    recommendationMonitoring:createRecommendationViewModel(
      recommendationMetrics
    ),
    currentMonthValue:moment().format('YYYY-MM')
  });
};

const aggregateDailyRevenue=(start,end)=>Order.aggregate([
  {
    $match:{
      deleted:false,
      paymentStatus:'paid',
      status:{$ne:'cancelled'},
      createdAt:{$gte:start,$lt:end}
    }
  },
  {
    $group:{
      _id:{$dayOfMonth:{date:'$createdAt',timezone:'Asia/Ho_Chi_Minh'}},
      total:{$sum:'$total'}
    }
  },
  {$sort:{_id:1}}
]);

module.exports.revenueChart=async(req,res)=>{
  const currentMonth=Number(req.body.currentMonth);
  const currentYear=Number(req.body.currentYear);
  if(!Number.isInteger(currentMonth)
    || currentMonth<1
    || currentMonth>12
    || !Number.isInteger(currentYear)
    || currentYear<2000
    || currentYear>2100){
    return res.status(400).json({code:'error',message:'Tháng thống kê không hợp lệ!'});
  }

  const currentStart=new Date(currentYear,currentMonth-1,1);
  const currentEnd=new Date(currentYear,currentMonth,1);
  const previousStart=new Date(currentYear,currentMonth-2,1);
  const previousEnd=currentStart;
  const previousMonth=previousStart.getMonth()+1;
  const previousYear=previousStart.getFullYear();
  const dayCount=Math.max(
    new Date(currentYear,currentMonth,0).getDate(),
    new Date(previousYear,previousMonth,0).getDate()
  );

  const [currentRows,previousRows]=await Promise.all([
    aggregateDailyRevenue(currentStart,currentEnd),
    aggregateDailyRevenue(previousStart,previousEnd)
  ]);
  const currentMap=new Map(currentRows.map(item=>[Number(item._id),Number(item.total || 0)]));
  const previousMap=new Map(previousRows.map(item=>[Number(item._id),Number(item.total || 0)]));
  const days=Array.from({length:dayCount},(_,index)=>index+1);

  return res.json({
    code:'success',
    days,
    dataMonthCurrent:days.map(day=>currentMap.get(day) || 0),
    dataMonthPrevious:days.map(day=>previousMap.get(day) || 0)
  });
};
