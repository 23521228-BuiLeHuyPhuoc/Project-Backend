const slugify=require("slugify");

const normalizePath=value=>{
  let routePath=String(value || "").trim().split(/[?#]/)[0].replace(/\\/g,"/");
  if(!routePath.startsWith("/")){
    routePath=`/${routePath}`;
  }

  routePath=routePath.replace(/\/{2,}/g,"/");
  const adminPrefix=`/${global.pathAdmin || "admin"}`.toLowerCase();
  const comparablePath=routePath.toLowerCase();
  if(comparablePath===adminPrefix){
    routePath="/";
  }
  else if(comparablePath.startsWith(`${adminPrefix}/`)){
    routePath=routePath.slice(adminPrefix.length);
  }

  if(routePath.length>1){
    routePath=routePath.replace(/\/$/,"");
  }
  return routePath.toLowerCase();
};

const buildCode=(routePath,method)=>{
  const pathCode=normalizePath(routePath).split("/").filter(Boolean).join("-");
  return slugify(`${String(method || "GET").toLowerCase()}-${pathCode}`,{
    lower:true,
    strict:true,
    trim:true
  });
};

const pathToRegex=routePath=>{
  const normalized=normalizePath(routePath);
  const escaped=normalized
    .split("/")
    .map(segment=>{
      if(segment==="*"){
        return ".*";
      }
      if(segment.endsWith("*")){
        const prefix=segment.slice(0,-1).replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
        return `${prefix}.*`;
      }
      if(segment.startsWith(":")){
        return "[^/]+";
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
    })
    .join("/");
  return new RegExp(`^${escaped}$`,"i");
};

module.exports={normalizePath,buildCode,pathToRegex};
