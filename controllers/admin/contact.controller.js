const mongoose=require("mongoose");
const moment=require("moment");
const Contact=require("../../models/contact.model");
const {topicLabels}=require("../../config/contact");

const escapeRegex=value=>String(value).replace(/[.*+?^${}()|[\]\\]/g,"\\$&");

const messageConditions=()=>[
  {deleted:false},
  {message:{$exists:true,$nin:["",null]}},
  {$or:[{type:"message"},{type:{$exists:false}}]}
];

const presentContact=item=>({
  ...item,
  status:item.status || "unread",
  subjectLabel:topicLabels[item.subject] || item.subject || "Nội dung khác",
  createdAtLabel:moment(item.createdAt).format("HH:mm DD/MM/YYYY")
});

module.exports.list=async(req,res)=>{
  const pageRequested=Math.max(1,parseInt(req.query.page) || 1);
  const limit=20;
  const filters={
    status:String(req.query.status || ""),
    search:String(req.query.search || "").trim()
  };
  const conditions=messageConditions();

  if(filters.status==="unread"){
    conditions.push({$or:[{status:"unread"},{status:{$exists:false}}]});
  }
  else if(["read","resolved"].includes(filters.status)){
    conditions.push({status:filters.status});
  }

  if(filters.search){
    const searchRegex=new RegExp(escapeRegex(filters.search),"i");
    conditions.push({
      $or:[
        {fullName:searchRegex},
        {email:searchRegex},
        {phone:searchRegex},
        {message:searchRegex}
      ]
    });
  }

  const find={$and:conditions};
  const total=await Contact.countDocuments(find);
  const totalPages=Math.max(1,Math.ceil(total/limit));
  const page=Math.min(pageRequested,totalPages);
  const contactList=(await Contact.find(find)
    .sort({createdAt:-1})
    .skip((page-1)*limit)
    .limit(limit)
    .lean()).map(presentContact);

  res.render("admin/pages/contact-list",{
    contactList,
    filters,
    pagination:{page,total,totalPages,limit},
    pageTitle:"Quản lý liên hệ"
  });
};

module.exports.detail=async(req,res)=>{
  if(!mongoose.isValidObjectId(req.params.id)){
    return res.status(404).render("admin/pages/error-404",{pageTitle:"Không tìm thấy liên hệ"});
  }

  const record=await Contact.findOne({
    _id:req.params.id,
    $and:messageConditions()
  }).lean();
  if(!record){
    return res.status(404).render("admin/pages/error-404",{pageTitle:"Không tìm thấy liên hệ"});
  }

  if(!record.status || record.status==="unread"){
    const readAt=new Date();
    await Contact.updateOne({_id:record._id},{status:"read",readAt});
    record.status="read";
    record.readAt=readAt;
  }

  res.render("admin/pages/contact-detail",{
    contact:presentContact(record),
    pageTitle:`Liên hệ từ ${record.fullName}`
  });
};

module.exports.statusPatch=async(req,res)=>{
  if(!mongoose.isValidObjectId(req.params.id) || !["unread","read","resolved"].includes(req.body.status)){
    return res.status(400).json({code:"error",message:"Trạng thái liên hệ không hợp lệ!"});
  }

  const contact=await Contact.findOne({_id:req.params.id,$and:messageConditions()});
  if(!contact){
    return res.status(404).json({code:"error",message:"Không tìm thấy liên hệ!"});
  }

  contact.status=req.body.status;
  if(req.body.status==="unread"){
    contact.readAt=null;
    contact.resolvedAt=null;
  }
  if(req.body.status==="read"){
    contact.readAt=contact.readAt || new Date();
    contact.resolvedAt=null;
  }
  if(req.body.status==="resolved"){
    contact.readAt=contact.readAt || new Date();
    contact.resolvedAt=new Date();
  }
  await contact.save();

  req.flash("success","Cập nhật trạng thái liên hệ thành công!");
  res.json({code:"success"});
};

module.exports.deletePatch=async(req,res)=>{
  if(!mongoose.isValidObjectId(req.params.id)){
    return res.status(400).json({code:"error",message:"Liên hệ không hợp lệ!"});
  }

  const result=await Contact.updateOne({_id:req.params.id,$and:messageConditions()},{
    deleted:true,
    deletedBy:req.account.id,
    deletedAt:new Date()
  });
  if(result.matchedCount===0){
    return res.status(404).json({code:"error",message:"Không tìm thấy liên hệ!"});
  }

  req.flash("success","Xóa liên hệ thành công!");
  res.json({code:"success"});
};
