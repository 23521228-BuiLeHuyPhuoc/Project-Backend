const Notification=require("../../models/notification.model");
const User=require("../../models/user.model");
const moment=require("moment");

module.exports.list=async(req,res)=>{
  const find={deleted:false};
  const filters={type:req.query.type || "",status:req.query.status || "",search:String(req.query.search || "").trim()};
  if(["order","voucher","review","account","system"].includes(filters.type)){
    find.type=filters.type;
  }
  if(filters.status==="read"){
    find.readAt={$ne:null};
  }
  if(filters.status==="unread"){
    find.readAt=null;
  }
  if(filters.search){
    const regex=new RegExp(filters.search.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"i");
    find.$or=[{title:regex},{message:regex}];
  }

  const notificationList=(await Notification.find(find)
    .populate("userId","fullName email")
    .sort({createdAt:-1})
    .limit(200)
    .lean()).map(item=>({...item,createdAtLabel:moment(item.createdAt).format("HH:mm DD/MM/YYYY")}));
  res.render("admin/pages/notification-list",{
    pageTitle:"Quản lý thông báo",
    notificationList,
    filters
  });
};

module.exports.create=async(req,res)=>{
  const userList=await User.find({deleted:false,status:"active"}).select("fullName email").sort({fullName:1});
  res.render("admin/pages/notification-create",{
    pageTitle:"Gửi thông báo",
    userList
  });
};

module.exports.createPost=async(req,res)=>{
  const title=String(req.body.title || "").trim();
  const message=String(req.body.message || "").trim();
  const type=["order","voucher","review","account","system"].includes(req.body.type) ? req.body.type : "system";
  let link=String(req.body.link || "/account/notifications").trim() || "/account/notifications";
  if(!link.startsWith("/") || link.startsWith("//")){
    link="/account/notifications";
  }
  if(!title || !message){
    return res.status(400).json({code:"error",message:"Vui lòng nhập tiêu đề và nội dung thông báo!"});
  }

  const userFind={deleted:false,status:"active"};
  if(req.body.userId && req.body.userId!=="all"){
    userFind._id=req.body.userId;
  }
  const userIds=await User.find(userFind).distinct("_id");
  if(userIds.length===0){
    return res.status(400).json({code:"error",message:"Không tìm thấy người nhận phù hợp!"});
  }

  await Notification.insertMany(userIds.map(userId=>({
    userId,title,message,type,link,createdBy:req.account.id
  })));
  req.flash("success",`Đã gửi thông báo tới ${userIds.length} tài khoản!`);
  res.json({code:"success"});
};

module.exports.deletePatch=async(req,res)=>{
  const result=await Notification.updateOne({_id:req.params.id,deleted:false},{
    deleted:true,
    deletedBy:req.account.id,
    deletedAt:new Date()
  });
  if(result.matchedCount===0){
    return res.status(404).json({code:"error",message:"Không tìm thấy thông báo!"});
  }
  req.flash("success","Xóa thông báo thành công!");
  res.json({code:"success"});
};
