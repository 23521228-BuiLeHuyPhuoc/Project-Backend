const Order=require("../../models/order.model");
const Tour=require("../../models/tour.model");
const City=require("../../models/city.model");
const Notification=require("../../models/notification.model");
const moment=require("moment");
const {cancelOrderAndRelease}=require("../../helpers/order.helper");

const statusLabels={
  initial:"Chờ xác nhận",
  pending:"Đang xử lý",
  confirmed:"Đã xác nhận",
  completed:"Hoàn thành",
  cancelled:"Không thành công"
};

const paymentMethodLabels={
  money:"Tiền mặt",
  bank:"Chuyển khoản ngân hàng",
  zalopay:"ZaloPay",
  vnpay:"VNPay"
};

const enrichOrders=async records=>{
  const orders=records.map(item=>item.toObject ? item.toObject() : item);
  const tourIds=[...new Set(orders.flatMap(order=>(order.items || []).map(item=>String(item.tourId))))];
  const tours=await Tour.find({_id:{$in:tourIds}}).select("name avatar").lean();
  const tourMap=new Map(tours.map(tour=>[String(tour._id),tour]));
  return orders.map(order=>({
    ...order,
    FormatCreatedAt:moment(order.createdAt).format("HH:mm DD/MM/YYYY"),
    CancelledAtLabel:order.cancelledAt ? moment(order.cancelledAt).format("HH:mm DD/MM/YYYY") : "-",
    StatusLabel:statusLabels[order.status] || order.status,
    PaymentMethodLabel:paymentMethodLabels[order.paymentMethod] || "Chưa xác định",
    CanConfirmCash:order.paymentMethod==="money" && ["initial","pending"].includes(order.status),
    items:(order.items || []).map(item=>{
      const tour=tourMap.get(String(item.tourId));
      return {...item,Name:tour ? tour.name : "Tour không còn tồn tại",avatar:item.avatar || (tour && tour.avatar)};
    })
  }));
};

module.exports.list=async(req,res)=>{
  const orderList=await enrichOrders(await Order.find({deleted:false}).sort({createdAt:-1}));
  res.render("admin/pages/order-list",{pageTitle:"Danh sách đơn hàng",orderList});
};

module.exports.cancelled=async(req,res)=>{
  const orderList=await enrichOrders(await Order.find({deleted:false,status:"cancelled"}).sort({cancelledAt:-1,createdAt:-1}));
  res.render("admin/pages/order-cancelled-list",{
    pageTitle:"Quản lý đơn hàng đã hủy",
    orderList
  });
};

module.exports.edit=async(req,res)=>{
  const orderRecord=await Order.findOne({_id:req.params.id});
  if(!orderRecord){
    return res.status(404).render("admin/pages/error-404",{pageTitle:"Không tìm thấy đơn hàng"});
  }
  const tourList=await Tour.find({});
  for(const item of orderRecord.items){
    const tour=tourList.find(record=>String(record._id)===String(item.tourId));
    item.Name=tour ? tour.name : "";
    const city=await City.findOne({_id:item.locationFrom});
    item.locationNameFrom=city ? city.name : "";
  }
  orderRecord.FormatCreatedAt=moment(orderRecord.createdAt).format("YYYY-MM-DDTHH:mm:ss");
  res.render("admin/pages/order-edit",{pageTitle:"Chỉnh sửa đơn hàng",orderRecord});
};

module.exports.editPatch=async(req,res)=>{
  try{
    const allowedStatus=["initial","pending","confirmed","completed","cancelled"];
    const allowedPaymentStatus=["paid","unpaid"];
    const order=await Order.findOne({_id:req.params.id,deleted:false});
    if(!order){
      return res.status(404).json({code:"error",message:"Không tìm thấy đơn hàng"});
    }

    const nextStatus=allowedStatus.includes(req.body.status) ? req.body.status : order.status;
    const nextPaymentStatus=allowedPaymentStatus.includes(req.body.paymentStatus)
      ? req.body.paymentStatus
      : order.paymentStatus;
    if(order.status==="cancelled" && nextStatus!=="cancelled"){
      return res.status(400).json({
        code:"error",
        message:"Không thể mở lại đơn đã hủy vì số chỗ đã được hoàn về tour!"
      });
    }
    if(nextStatus==="cancelled" && order.status!=="cancelled"){
      if(order.paymentStatus==="paid" || nextPaymentStatus==="paid"){
        return res.status(400).json({
          code:"error",
          message:"Cần xử lý hoàn tiền trước khi hủy đơn đã thanh toán!"
        });
      }
      const cancelledOrder=await cancelOrderAndRelease({
        _id:order.id,
        status:{$ne:"cancelled"},
        paymentStatus:"unpaid"
      },req.account.id);
      if(!cancelledOrder){
        return res.status(400).json({code:"error",message:"Không thể hủy đơn hàng này"});
      }
      req.flash("success","Cập nhật đơn hàng thành công");
      return res.json({code:"success"});
    }

    const updateData={updatedBy:req.account.id};
    updateData.status=nextStatus;
    updateData.paymentStatus=nextPaymentStatus;
    await Order.updateOne({_id:order.id},updateData);
    req.flash("success","Cập nhật đơn hàng thành công");
    res.json({code:"success"});
  }
  catch(error){
    res.status(400).json({code:"error",message:"Có lỗi xảy ra"});
  }
};

module.exports.confirmCashOrder=async(req,res)=>{
  try{
    if(!req.permissions.includes("order-edit")){
      return res.status(403).send("Bạn chưa được cấp quyền xác nhận đơn hàng.");
    }

    const decision=req.params.decision;
    if(!["confirmed","cancelled"].includes(decision)){
      req.flash("error","Lựa chọn xác nhận không hợp lệ!");
      return res.redirect(`/${pathAdmin}/order/list`);
    }

    let order=null;
    if(decision==="confirmed"){
      order=await Order.findOneAndUpdate({
        _id:req.params.id,
        paymentMethod:"money",
        status:{$in:["initial","pending"]},
        deleted:false
      },{
        $set:{status:"confirmed",updatedBy:req.account.id}
      });
    }
    else{
      order=await cancelOrderAndRelease({
        _id:req.params.id,
        paymentMethod:"money",
        paymentStatus:"unpaid",
        status:{$in:["initial","pending"]}
      },req.account.id);
    }

    if(!order){
      req.flash("error","Đơn hàng đã được xử lý hoặc không phải đơn thanh toán tiền mặt!");
      return res.redirect(`/${pathAdmin}/order/list`);
    }

    Notification.create({
      userId:order.userId,
      title:decision==="confirmed" ? "Đơn hàng đã được xác nhận" : "Đơn hàng không được xác nhận",
      message:decision==="confirmed"
        ? `Đơn ${order.orderCode} đã được xác nhận thành công.`
        : `Đơn ${order.orderCode} không được xác nhận và đã được hủy.`,
      type:"order",
      link:`/account/orders/${order.id}`
    }).catch(error=>console.error("Order confirmation notification error:",error.message));

    req.flash(
      "success",
      decision==="confirmed" ? "Đã xác nhận đơn hàng thành công!" : "Đã ghi nhận đơn hàng không thành công!"
    );
    return res.redirect(`/${pathAdmin}/order/list`);
  }
  catch(error){
    req.flash("error","Không thể xác nhận đơn hàng lúc này!");
    return res.redirect(`/${pathAdmin}/order/list`);
  }
};
