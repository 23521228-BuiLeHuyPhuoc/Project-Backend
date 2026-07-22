const Voucher=require("../../models/voucher.model");
const moment=require("moment");

const escapeRegex=value=>value.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");

const getPayload=req=>({
  code:String(req.body.code || "").trim().toUpperCase(),
  title:String(req.body.title || "").trim(),
  description:String(req.body.description || "").trim(),
  discountType:req.body.discountType,
  discountValue:Number(req.body.discountValue),
  minOrderValue:Number(req.body.minOrderValue || 0),
  maxDiscount:Number(req.body.maxDiscount || 0),
  startAt:new Date(req.body.startAt),
  endAt:new Date(req.body.endAt),
  usageLimit:Number(req.body.usageLimit || 0),
  status:req.body.status==="inactive" ? "inactive" : "active"
});

const validatePayload=payload=>{
  if(!payload.code || !payload.title){
    return "Vui lòng nhập mã và tên voucher!";
  }
  if(!["percent","fixed"].includes(payload.discountType) || !Number.isFinite(payload.discountValue) || payload.discountValue<=0){
    return "Giá trị giảm giá không hợp lệ!";
  }
  if(payload.discountType==="percent" && payload.discountValue>100){
    return "Mức giảm theo phần trăm không được vượt quá 100%!";
  }
  const nonNegativeValues=[payload.minOrderValue,payload.maxDiscount,payload.usageLimit];
  if(nonNegativeValues.some(value=>!Number.isFinite(value) || value<0)){
    return "Giá trị đơn tối thiểu, mức giảm tối đa hoặc giới hạn lượt dùng không hợp lệ!";
  }
  if(Number.isNaN(payload.startAt.getTime()) || Number.isNaN(payload.endAt.getTime()) || payload.endAt<=payload.startAt){
    return "Thời gian áp dụng voucher không hợp lệ!";
  }
  return null;
};

module.exports.list=async(req,res)=>{
  const find={deleted:false};
  const filters={status:req.query.status || "",search:String(req.query.search || "").trim()};
  if(["active","inactive"].includes(filters.status)){
    find.status=filters.status;
  }
  if(filters.search){
    const regex=new RegExp(escapeRegex(filters.search),"i");
    find.$or=[{code:regex},{title:regex}];
  }

  const now=new Date();
  const voucherList=(await Voucher.find(find).sort({createdAt:-1}).lean()).map(item=>({
    ...item,
    startAtLabel:moment(item.startAt).format("DD/MM/YYYY"),
    endAtLabel:moment(item.endAt).format("DD/MM/YYYY"),
    isExpired:item.endAt<now
  }));
  res.render("admin/pages/voucher-list",{pageTitle:"Quản lý voucher",voucherList,filters});
};

module.exports.create=(req,res)=>res.render("admin/pages/voucher-form",{
  pageTitle:"Tạo voucher",
  record:null,
  formAction:`/${pathAdmin}/voucher/create`,
  formMethod:"POST"
});

module.exports.createPost=async(req,res)=>{
  try{
    const payload=getPayload(req);
    const message=validatePayload(payload);
    if(message){
      return res.status(400).json({code:"error",message});
    }
    if(await Voucher.exists({code:payload.code,deleted:false})){
      return res.status(409).json({code:"error",message:"Mã voucher đã tồn tại!"});
    }
    await Voucher.create({...payload,createdBy:req.account.id,updatedBy:req.account.id});
    req.flash("success","Tạo voucher thành công!");
    res.json({code:"success"});
  }
  catch(error){
    res.status(400).json({code:"error",message:"Không thể tạo voucher!"});
  }
};

module.exports.edit=async(req,res)=>{
  const record=await Voucher.findOne({_id:req.params.id,deleted:false}).lean();
  if(!record){
    return res.status(404).render("admin/pages/error-404",{pageTitle:"Không tìm thấy voucher"});
  }
  record.startAtValue=moment(record.startAt).format("YYYY-MM-DDTHH:mm");
  record.endAtValue=moment(record.endAt).format("YYYY-MM-DDTHH:mm");
  res.render("admin/pages/voucher-form",{
    pageTitle:"Chỉnh sửa voucher",
    record,
    formAction:`/${pathAdmin}/voucher/edit/${record._id}`,
    formMethod:"PATCH"
  });
};

module.exports.editPatch=async(req,res)=>{
  try{
    const payload=getPayload(req);
    const message=validatePayload(payload);
    if(message){
      return res.status(400).json({code:"error",message});
    }
    const duplicate=await Voucher.exists({_id:{$ne:req.params.id},code:payload.code,deleted:false});
    if(duplicate){
      return res.status(409).json({code:"error",message:"Mã voucher đã tồn tại!"});
    }
    const result=await Voucher.updateOne({_id:req.params.id,deleted:false},{...payload,updatedBy:req.account.id});
    if(result.matchedCount===0){
      return res.status(404).json({code:"error",message:"Không tìm thấy voucher!"});
    }
    req.flash("success","Cập nhật voucher thành công!");
    res.json({code:"success"});
  }
  catch(error){
    res.status(400).json({code:"error",message:"Không thể cập nhật voucher!"});
  }
};

module.exports.deletePatch=async(req,res)=>{
  const result=await Voucher.updateOne({_id:req.params.id,deleted:false},{
    deleted:true,
    deletedBy:req.account.id,
    deletedAt:new Date()
  });
  if(result.matchedCount===0){
    return res.status(404).json({code:"error",message:"Không tìm thấy voucher!"});
  }
  req.flash("success","Xóa voucher thành công!");
  res.json({code:"success"});
};
