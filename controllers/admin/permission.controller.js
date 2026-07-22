const Permission=require("../../models/permission.model");
const Role=require("../../models/roles.model");
const {normalizePath,buildCode}=require("../../helpers/permission.helper");

const allowedMethods=["ALL","GET","POST","PATCH","PUT","DELETE"];

const getPayload=req=>{
  const method=String(req.body.method || "GET").toUpperCase();
  const routePath=normalizePath(req.body.path);
  return {
    label:String(req.body.label || "").trim(),
    path:routePath,
    method,
    code:buildCode(routePath,method),
    group:String(req.body.group || "Khác").trim() || "Khác",
    description:String(req.body.description || "").trim(),
    status:req.body.status==="inactive" ? "inactive" : "active"
  };
};

const validatePayload=payload=>{
  if(!payload.label){
    return "Vui lòng nhập tên quyền!";
  }
  if(!payload.path || payload.path==="/"){
    return "Vui lòng nhập đường dẫn quản trị cụ thể!";
  }
  if(payload.path.includes("..") || !/^\/[a-z0-9_./:*~-]+$/.test(payload.path)){
    return "Đường dẫn chỉ được chứa chữ thường, số, dấu /, -, _, :, * và dấu chấm!";
  }
  if(!allowedMethods.includes(payload.method)){
    return "Phương thức HTTP không hợp lệ!";
  }
  return null;
};

module.exports.list=async(req,res)=>{
  const find={deleted:false};
  const filters={
    status:req.query.status || "",
    method:req.query.method || "",
    search:String(req.query.search || "").trim()
  };

  if(["active","inactive"].includes(filters.status)){
    find.status=filters.status;
  }
  if(allowedMethods.includes(filters.method)){
    find.method=filters.method;
  }
  if(filters.search){
    const regex=new RegExp(filters.search.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"i");
    find.$or=[{label:regex},{code:regex},{path:regex},{group:regex}];
  }

  const permissionList=await Permission.find(find).sort({group:1,label:1});
  res.render("admin/pages/setting-permission-list",{
    pageTitle:"Quản lý quyền",
    permissionList,
    filters
  });
};

module.exports.create=(req,res)=>{
  res.render("admin/pages/setting-permission-create",{
    pageTitle:"Tạo quyền theo đường dẫn"
  });
};

module.exports.createPost=async(req,res)=>{
  try{
    const payload=getPayload(req);
    const errorMessage=validatePayload(payload);
    if(errorMessage){
      return res.status(400).json({code:"error",message:errorMessage});
    }

    const duplicate=await Permission.findOne({
      deleted:false,
      $or:[{code:payload.code},{path:payload.path,method:payload.method}]
    });
    if(duplicate){
      return res.status(409).json({
        code:"error",
        message:"Đường dẫn và phương thức này đã có quyền tương ứng!"
      });
    }

    await Permission.create({
      ...payload,
      createdBy:req.account.id,
      updatedBy:req.account.id
    });
    req.flash("success","Tạo quyền mới thành công!");
    res.json({code:"success"});
  }
  catch(error){
    res.status(400).json({code:"error",message:"Không thể tạo quyền mới!"});
  }
};

module.exports.edit=async(req,res)=>{
  const record=await Permission.findOne({_id:req.params.id,deleted:false});
  if(!record){
    return res.status(404).render("admin/pages/error-404",{pageTitle:"Không tìm thấy quyền"});
  }
  res.render("admin/pages/setting-permission-edit",{
    pageTitle:"Chỉnh sửa quyền",
    record
  });
};

module.exports.editPatch=async(req,res)=>{
  try{
    const record=await Permission.findOne({_id:req.params.id,deleted:false});
    if(!record){
      return res.status(404).json({code:"error",message:"Không tìm thấy quyền!"});
    }

    const payload=getPayload(req);
    if(record.isSystem){
      payload.path=record.path;
      payload.method=record.method;
      payload.code=record.code;
    }
    const errorMessage=validatePayload(payload);
    if(errorMessage){
      return res.status(400).json({code:"error",message:errorMessage});
    }

    const duplicate=await Permission.findOne({
      _id:{$ne:record.id},
      deleted:false,
      $or:[{code:payload.code},{path:payload.path,method:payload.method}]
    });
    if(duplicate){
      return res.status(409).json({
        code:"error",
        message:"Đường dẫn và phương thức này đã có quyền tương ứng!"
      });
    }

    await Permission.updateOne({_id:record.id},{
      ...payload,
      updatedBy:req.account.id
    });
    if(record.code!==payload.code){
      await Role.updateMany({permissions:record.code},{
        $set:{"permissions.$":payload.code}
      });
    }

    req.flash("success","Cập nhật quyền thành công!");
    res.json({code:"success"});
  }
  catch(error){
    res.status(400).json({code:"error",message:"Không thể cập nhật quyền!"});
  }
};

module.exports.deletePatch=async(req,res)=>{
  const record=await Permission.findOne({_id:req.params.id,deleted:false});
  if(!record){
    return res.status(404).json({code:"error",message:"Không tìm thấy quyền!"});
  }
  if(record.isSystem){
    return res.status(400).json({
      code:"error",
      message:"Quyền hệ thống không thể xóa; bạn có thể chuyển sang trạng thái tạm dừng."
    });
  }

  await Promise.all([
    Permission.updateOne({_id:record.id},{
      deleted:true,
      deletedBy:req.account.id,
      deletedAt:new Date()
    }),
    Role.updateMany({permissions:record.code},{$pull:{permissions:record.code}})
  ]);
  req.flash("success","Xóa quyền thành công!");
  res.json({code:"success"});
};
