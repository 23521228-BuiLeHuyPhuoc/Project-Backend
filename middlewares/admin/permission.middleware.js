const Permission=require("../../models/permission.model");
const {normalizePath,pathToRegex}=require("../../helpers/permission.helper");

module.exports.authorizeByPath=async(req,res,next)=>{
  try{
    const requestPath=normalizePath(req.originalUrl);
    const records=await Permission.find({
      deleted:false,
      method:{$in:[req.method,"ALL"]}
    }).select("code path status").lean();

    const matchedPermissions=records.filter(item=>pathToRegex(item.path).test(requestPath));
    if(matchedPermissions.length===0){
      return next();
    }

    const specificity=item=>item.path.replace(/:[^/]+|\*/g,"").length;
    const highestSpecificity=Math.max(...matchedPermissions.map(specificity));
    const effectivePermissions=matchedPermissions.filter(item=>specificity(item)===highestSpecificity);
    const allowed=effectivePermissions.some(item=>item.status==="active" && req.permissions.includes(item.code));
    if(allowed){
      return next();
    }

    if(req.method!=="GET" || req.accepts(["html","json"])==="json"){
      return res.status(403).json({
        code:"error",
        message:`Bạn chưa được cấp quyền truy cập ${requestPath}.`
      });
    }

    return res.status(403).render("admin/pages/error-403",{
      pageTitle:"Không có quyền truy cập",
      requestedPath:requestPath
    });
  }
  catch(error){
    next(error);
  }
};
