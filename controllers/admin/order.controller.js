const Order=require("../../models/order.model");
const Tour=require("../../models/tour.model");
const City=require("../../models/city.model");
const {createNotificationSafe}=require("../../helpers/notification.helper");
const moment=require("moment");
const mongoose=require("mongoose");
const {cancelOrderAndRelease}=require("../../helpers/order.helper");
const {recordCompletedOrderInteractions}=require("../../helpers/user-interaction.helper");

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
const escapeRegex=value=>value.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");

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
    CanConfirmCash:order.paymentMethod==="money"
      && order.paymentStatus==="unpaid"
      && ["initial","pending"].includes(order.status),
    items:(order.items || []).map(item=>{
      const tour=tourMap.get(String(item.tourId));
      return {...item,Name:tour ? tour.name : "Tour không còn tồn tại",avatar:item.avatar || (tour && tour.avatar)};
    })
  }));
};

module.exports.list=async(req,res)=>{
  const filters={
    status:String(req.query.status || ""),
    paymentMethod:String(req.query.paymentMethod || ""),
    paymentStatus:String(req.query.paymentStatus || ""),
    fromDate:String(req.query.fromDate || ""),
    toDate:String(req.query.toDate || ""),
    search:String(req.query.search || "").trim()
  };
  const find={deleted:false};
  if(["initial","pending","confirmed","completed","cancelled"].includes(filters.status)){
    find.status=filters.status;
  }
  if(["money","bank","zalopay","vnpay"].includes(filters.paymentMethod)){
    find.paymentMethod=filters.paymentMethod;
  }
  if(["paid","unpaid"].includes(filters.paymentStatus)){
    find.paymentStatus=filters.paymentStatus;
  }
  const createdAt={};
  if(/^\d{4}-\d{2}-\d{2}$/.test(filters.fromDate)){
    createdAt.$gte=new Date(`${filters.fromDate}T00:00:00`);
  }
  if(/^\d{4}-\d{2}-\d{2}$/.test(filters.toDate)){
    createdAt.$lte=new Date(`${filters.toDate}T23:59:59.999`);
  }
  if(Object.keys(createdAt).length){
    find.createdAt=createdAt;
  }
  if(filters.search){
    const regex=new RegExp(escapeRegex(filters.search),"i");
    find.$or=[
      {orderCode:regex},
      {fullName:regex},
      {phone:regex},
      {voucherCode:regex}
    ];
  }

  const limit=10;
  const requestedPage=Number.parseInt(req.query.page,10);
  const page=Number.isInteger(requestedPage) && requestedPage>0 ? requestedPage : 1;
  const totalRecords=await Order.countDocuments(find);
  const totalPages=Math.max(1,Math.ceil(totalRecords/limit));
  const currentPage=Math.min(page,totalPages);
  const records=await Order.find(find)
    .sort({createdAt:-1})
    .skip((currentPage-1)*limit)
    .limit(limit);
  const orderList=await enrichOrders(records);
  res.render("admin/pages/order-list",{
    pageTitle:"Danh sách đơn hàng",
    orderList,
    filters,
    pagination:{
      currentPage,
      totalPages,
      totalRecords,
      from:totalRecords ? (currentPage-1)*limit+1 : 0,
      to:Math.min(currentPage*limit,totalRecords)
    }
  });
};

module.exports.cancelled=async(req,res)=>{
  const orderList=await enrichOrders(await Order.find({deleted:false,status:"cancelled"}).sort({cancelledAt:-1,createdAt:-1}));
  res.render("admin/pages/order-cancelled-list",{
    pageTitle:"Quản lý đơn hàng đã hủy",
    orderList
  });
};

module.exports.edit=async(req,res)=>{
  if(!mongoose.isValidObjectId(req.params.id)){
    return res.status(404).render("admin/pages/error-404",{pageTitle:"Không tìm thấy đơn hàng"});
  }
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
    item.FormatDepartureDate=item.departureDate
      ? moment(item.departureDate).format("DD/MM/YYYY")
      : "-";
  }
  orderRecord.FormatCreatedAt=moment(orderRecord.createdAt).format("YYYY-MM-DDTHH:mm:ss");
  res.render("admin/pages/order-edit",{pageTitle:"Chỉnh sửa đơn hàng",orderRecord});
};

module.exports.editPatch=async(req,res)=>{
  try{
    if(!mongoose.isValidObjectId(req.params.id)){
      return res.status(404).json({code:"error",message:"Không tìm thấy đơn hàng"});
    }
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
    const onlinePayment=["zalopay","vnpay"].includes(order.paymentMethod);
    if(order.paymentStatus==="paid" && nextPaymentStatus==="unpaid"){
      return res.status(400).json({
        code:"error",
        message:"Không thể chuyển đơn đã thanh toán về chưa thanh toán!"
      });
    }
    if(onlinePayment && nextPaymentStatus!==order.paymentStatus){
      return res.status(400).json({
        code:"error",
        message:"Trạng thái thanh toán online chỉ được cập nhật tự động từ cổng thanh toán!"
      });
    }
    if(onlinePayment){
      const canComplete=order.status==="confirmed" && nextStatus==="completed";
      if(nextStatus!==order.status && !canComplete){
        return res.status(400).json({
          code:"error",
          message:"Trạng thái đơn thanh toán online được xác nhận tự động; quản trị viên chỉ có thể đánh dấu hoàn thành!"
        });
      }
    }
    if(order.paymentMethod==="money"
      && ["initial","pending"].includes(order.status)
      && ["confirmed","cancelled"].includes(nextStatus)){
      return res.status(400).json({
        code:"error",
        message:"Vui lòng xác nhận đơn tiền mặt tại cột Xác nhận đặt tour!"
      });
    }
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
    if(order.status!=="completed" && nextStatus==="completed"){
      await recordCompletedOrderInteractions(order);
    }
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
    if(!mongoose.isValidObjectId(req.params.id)){
      req.flash("error","Đơn hàng không hợp lệ!");
      return res.redirect(`/${pathAdmin}/order/list`);
    }
    if(!["confirmed","cancelled"].includes(decision)){
      req.flash("error","Lựa chọn xác nhận không hợp lệ!");
      return res.redirect(`/${pathAdmin}/order/list`);
    }

    let order=null;
    if(decision==="confirmed"){
      order=await Order.findOneAndUpdate({
        _id:req.params.id,
        paymentMethod:"money",
        paymentStatus:"unpaid",
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

    createNotificationSafe({
      userId:order.userId,
      title:decision==="confirmed" ? "Đơn hàng đã được xác nhận" : "Đơn hàng không được xác nhận",
      message:decision==="confirmed"
        ? `Đơn ${order.orderCode} đã được xác nhận thành công.`
        : `Đơn ${order.orderCode} không được xác nhận và đã được hủy.`,
      type:"order",
      link:`/account/orders/${order.id}`
    });

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
