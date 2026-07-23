const moment=require('moment');
const AccountAdmin=require('../../models/account-admin.model');
const Order=require('../../models/order.model');
const Tour=require('../../models/tour.model');

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
  const [totalAdmins,totalOrders,revenueResult,recentOrderRecords]=await Promise.all([
    AccountAdmin.countDocuments({deleted:false}),
    Order.countDocuments({deleted:false}),
    Order.aggregate([
      {$match:{deleted:false,paymentStatus:'paid',status:{$ne:'cancelled'}}},
      {$group:{_id:null,total:{$sum:'$total'}}}
    ]),
    Order.find({deleted:false}).sort({createdAt:-1}).limit(5).lean()
  ]);

  res.render('admin/pages/dashboard',{
    pageTitle:'Tổng quan',
    total:totalAdmins,
    totalOrder:totalOrders,
    totalSum:Number(revenueResult[0] && revenueResult[0].total || 0),
    recentOrders:await enrichRecentOrders(recentOrderRecords),
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
