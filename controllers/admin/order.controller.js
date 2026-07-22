const Order=require("../../models/order.model");
const Tour=require("../../models/tour.model");
const City=require("../../models/city.model");
const moment=require("moment");

const enrichOrders=async records=>{
  const orders=records.map(item=>item.toObject ? item.toObject() : item);
  const tourIds=[...new Set(orders.flatMap(order=>(order.items || []).map(item=>String(item.tourId))))];
  const tours=await Tour.find({_id:{$in:tourIds}}).select("name avatar").lean();
  const tourMap=new Map(tours.map(tour=>[String(tour._id),tour]));
  return orders.map(order=>({
    ...order,
    FormatCreatedAt:moment(order.createdAt).format("HH:mm DD/MM/YYYY"),
    CancelledAtLabel:order.cancelledAt ? moment(order.cancelledAt).format("HH:mm DD/MM/YYYY") : "-",
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
    const updateData={updatedBy:req.account.id};
    if(allowedStatus.includes(req.body.status)){
      updateData.status=req.body.status;
      if(req.body.status==="cancelled"){
        updateData.cancelledAt=new Date();
      }
    }
    if(allowedPaymentStatus.includes(req.body.paymentStatus)){
      updateData.paymentStatus=req.body.paymentStatus;
    }
    const result=await Order.updateOne({_id:req.params.id,deleted:false},updateData);
    if(result.matchedCount===0){
      return res.status(404).json({code:"error",message:"Không tìm thấy đơn hàng"});
    }
    req.flash("success","Cập nhật đơn hàng thành công");
    res.json({code:"success"});
  }
  catch(error){
    res.status(400).json({code:"error",message:"Có lỗi xảy ra"});
  }
};
