const User=require("../../models/user.model");
const mongoose=require("mongoose");

const escapeRegex=value=>value.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");

module.exports.list=async(req,res)=>{
  const find={deleted:false};
  const filters={
    status:req.query.status || "",
    startDate:req.query.startDate || "",
    endDate:req.query.endDate || "",
    search:String(req.query.search || "").trim()
  };

  if(["active","inactive"].includes(filters.status)){
    find.status=filters.status;
  }

  const createdAt={};
  const objectIdCreatedAt={};
  if(filters.startDate){
    const startDate=new Date(`${filters.startDate}T00:00:00`);
    if(!Number.isNaN(startDate.getTime())){
      createdAt.$gte=startDate;
      objectIdCreatedAt.$gte=mongoose.Types.ObjectId.createFromTime(Math.floor(startDate.getTime()/1000));
    }
  }
  if(filters.endDate){
    const endDate=new Date(`${filters.endDate}T23:59:59.999`);
    if(!Number.isNaN(endDate.getTime())){
      createdAt.$lte=endDate;
      objectIdCreatedAt.$lt=mongoose.Types.ObjectId.createFromTime(Math.floor((endDate.getTime()+1)/1000));
    }
  }
  if(Object.keys(createdAt).length>0){
    find.$and=[{$or:[{createdAt},{createdAt:{$exists:false},_id:objectIdCreatedAt}]}];
  }

  if(filters.search){
    const regex=new RegExp(escapeRegex(filters.search),"i");
    find.$or=[{fullName:regex},{email:regex},{phone:regex}];
  }

  const limitItem=9;
  const requestedPage=Number.parseInt(req.query.page,10);
  let currentPage=Number.isInteger(requestedPage) && requestedPage>0 ? requestedPage : 1;
  const totalRecord=await User.countDocuments(find);
  const totalPage=Math.ceil(totalRecord/limitItem);
  if(totalPage>0 && currentPage>totalPage){
    currentPage=totalPage;
  }
  const skip=(currentPage-1)*limitItem;
  const userList=await User.find(find)
    .select("-password")
    .sort({createdAt:-1,_id:-1})
    .skip(skip)
    .limit(limitItem);

  res.render("admin/pages/user-list",{
    pageTitle:"Quản lý tài khoản người dùng",
    userList,
    filters,
    pagination:{
      currentPage,limitItem,totalPage,totalRecord,
      start:totalRecord===0 ? 0 : skip+1,
      end:Math.min(skip+limitItem,totalRecord)
    }
  });
};

module.exports.editPage=async(req,res)=>{
  try{
    const user=await User.findOne({_id:req.params.id,deleted:false}).select("-password");
    if(!user){
      return res.status(404).render("admin/pages/error-404",{pageTitle:"Không tìm thấy người dùng"});
    }
    res.render("admin/pages/user-edit",{pageTitle:"Sửa tài khoản người dùng",user});
  }
  catch(error){
    res.status(404).render("admin/pages/error-404",{pageTitle:"Không tìm thấy người dùng"});
  }
};

module.exports.edit=async(req,res)=>{
  try{
    const updateData={
      fullName:String(req.body.fullName || "").trim(),
      email:String(req.body.email || "").trim().toLowerCase(),
      phone:String(req.body.phone || "").trim(),
      status:req.body.status,
      updatedBy:req.account.id
    };
    if(!updateData.fullName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updateData.email)){
      return res.status(400).json({code:"error",message:"Họ tên hoặc email không hợp lệ!"});
    }
    if(!["active","inactive"].includes(updateData.status)){
      return res.status(400).json({code:"error",message:"Trạng thái không hợp lệ!"});
    }
    if(await User.exists({_id:{$ne:req.params.id},email:updateData.email,deleted:false})){
      return res.status(409).json({code:"error",message:"Email đã tồn tại trong hệ thống!"});
    }
    const result=await User.findOneAndUpdate({_id:req.params.id,deleted:false},updateData,{new:true,runValidators:true});
    if(!result){
      return res.status(404).json({code:"error",message:"Không tìm thấy người dùng!"});
    }
    req.flash("success","Cập nhật tài khoản người dùng thành công!");
    res.json({code:"success"});
  }
  catch(error){
    res.status(400).json({code:"error",message:"Không thể cập nhật người dùng!"});
  }
};

module.exports.deletePatch=async(req,res)=>{
  const result=await User.updateOne({_id:req.params.id,deleted:false},{
    deleted:true,
    deletedBy:req.account.id,
    deletedAt:new Date()
  });
  if(result.matchedCount===0){
    return res.status(404).json({code:"error",message:"Không tìm thấy người dùng!"});
  }
  req.flash("success","Xóa tài khoản người dùng thành công!");
  res.json({code:"success"});
};

module.exports.changeStatusPatch=async(req,res)=>{
  const {status,idList}=req.body;
  if(!["active","inactive","delete"].includes(status) || !Array.isArray(idList) || idList.length===0){
    return res.status(400).json({code:"error",message:"Vui lòng chọn hành động và tài khoản hợp lệ!"});
  }
  if(status==="delete" && !req.permissions.includes("user-delete")){
    return res.status(403).json({code:"error",message:"Bạn không có quyền xóa tài khoản người dùng!"});
  }
  if(status!=="delete" && !req.permissions.includes("user-status")){
    return res.status(403).json({code:"error",message:"Bạn không có quyền đổi trạng thái tài khoản người dùng!"});
  }
  const find={_id:{$in:[...new Set(idList.map(String))]},deleted:false};
  if(status==="delete"){
    await User.updateMany(find,{deleted:true,deletedBy:req.account.id,deletedAt:new Date()});
    req.flash("success","Xóa các tài khoản người dùng đã chọn thành công!");
  }
  else{
    await User.updateMany(find,{status,updatedBy:req.account.id});
    req.flash("success","Cập nhật trạng thái tài khoản người dùng thành công!");
  }
  res.json({code:"success"});
};
