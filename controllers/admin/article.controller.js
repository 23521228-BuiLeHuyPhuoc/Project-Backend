const Article=require("../../models/article.model");
const moment=require("moment");
const slugify=require("slugify");

const getPayload=req=>{
  const title=String(req.body.title || "").trim();
  const status=req.body.status==="published" ? "published" : "draft";
  return {
    title,
    slug:slugify(String(req.body.slug || title),{lower:true,strict:true,locale:"vi",trim:true}),
    image:String(req.body.image || "").trim(),
    category:String(req.body.category || "Cẩm nang").trim() || "Cẩm nang",
    description:String(req.body.description || "").trim(),
    quote:String(req.body.quote || "").trim(),
    contentHtml:String(req.body.contentHtml || "").trim(),
    contentSections:[],
    author:String(req.body.author || "28.TRAVEL").trim() || "28.TRAVEL",
    readTime:String(req.body.readTime || "5 phút").trim() || "5 phút",
    featured:req.body.featured==="true" || req.body.featured==="on" || req.body.featured===true,
    status,
    publishedAt:status==="published" ? new Date() : null
  };
};

const validatePayload=payload=>{
  if(!payload.title || !payload.slug || !payload.description || !payload.contentHtml){
    return "Vui lòng nhập đầy đủ tiêu đề, mô tả và nội dung bài viết!";
  }
  return null;
};

module.exports.list=async(req,res)=>{
  const find={deleted:false};
  const filters={status:req.query.status || "",search:String(req.query.search || "").trim()};
  if(["draft","published"].includes(filters.status)){
    find.status=filters.status;
  }
  if(filters.search){
    const regex=new RegExp(filters.search.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"i");
    find.$or=[{title:regex},{slug:regex},{category:regex}];
  }
  const articleList=(await Article.find(find).sort({createdAt:-1}).lean()).map(item=>({
    ...item,
    createdAtLabel:moment(item.createdAt).format("DD/MM/YYYY HH:mm")
  }));
  res.render("admin/pages/article-list",{pageTitle:"Quản lý bài viết",articleList,filters});
};

module.exports.create=(req,res)=>res.render("admin/pages/article-form",{
  pageTitle:"Tạo bài viết",
  record:null,
  formAction:`/${pathAdmin}/article/create`,
  formMethod:"POST"
});

module.exports.createPost=async(req,res)=>{
  try{
    const payload=getPayload(req);
    const message=validatePayload(payload);
    if(message){
      return res.status(400).json({code:"error",message});
    }
    if(await Article.exists({slug:payload.slug,deleted:false})){
      return res.status(409).json({code:"error",message:"Đường dẫn bài viết đã tồn tại!"});
    }
    if(payload.featured){
      await Article.updateMany({featured:true,deleted:false},{featured:false});
    }
    await Article.create({...payload,createdBy:req.account.id,updatedBy:req.account.id});
    req.flash("success","Tạo bài viết thành công!");
    res.json({code:"success"});
  }
  catch(error){
    res.status(400).json({code:"error",message:"Không thể tạo bài viết!"});
  }
};

module.exports.edit=async(req,res)=>{
  const record=await Article.findOne({_id:req.params.id,deleted:false});
  if(!record){
    return res.status(404).render("admin/pages/error-404",{pageTitle:"Không tìm thấy bài viết"});
  }
  res.render("admin/pages/article-form",{
    pageTitle:"Chỉnh sửa bài viết",
    record,
    formAction:`/${pathAdmin}/article/edit/${record._id}`,
    formMethod:"PATCH"
  });
};

module.exports.editPatch=async(req,res)=>{
  try{
    const record=await Article.findOne({_id:req.params.id,deleted:false});
    if(!record){
      return res.status(404).json({code:"error",message:"Không tìm thấy bài viết!"});
    }
    const payload=getPayload(req);
    const message=validatePayload(payload);
    if(message){
      return res.status(400).json({code:"error",message});
    }
    if(await Article.exists({_id:{$ne:req.params.id},slug:payload.slug,deleted:false})){
      return res.status(409).json({code:"error",message:"Đường dẫn bài viết đã tồn tại!"});
    }
    if(payload.featured){
      await Article.updateMany({_id:{$ne:req.params.id},featured:true,deleted:false},{featured:false});
    }
    payload.publishedAt=payload.status==="published" ? (record.publishedAt || new Date()) : null;
    await Article.updateOne({_id:record.id},{...payload,updatedBy:req.account.id});
    req.flash("success","Cập nhật bài viết thành công!");
    res.json({code:"success"});
  }
  catch(error){
    res.status(400).json({code:"error",message:"Không thể cập nhật bài viết!"});
  }
};

module.exports.deletePatch=async(req,res)=>{
  const result=await Article.updateOne({_id:req.params.id,deleted:false},{
    deleted:true,
    deletedBy:req.account.id,
    deletedAt:new Date()
  });
  if(result.matchedCount===0){
    return res.status(404).json({code:"error",message:"Không tìm thấy bài viết!"});
  }
  req.flash("success","Xóa bài viết thành công!");
  res.json({code:"success"});
};
