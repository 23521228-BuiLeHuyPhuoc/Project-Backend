const Permission=require("../models/permission.model");
const permissionConfig=require("../config/permission");

module.exports.ensureDefaultPermissions=async()=>{
  const operations=permissionConfig.permissionList.map(item=>({
    updateOne:{
      filter:{code:item.code},
      update:{
        $set:{
          label:item.label,
          path:item.path,
          method:item.method,
          group:item.group,
          isSystem:true
        },
        $setOnInsert:{
          description:"",
          status:"active",
          deleted:false
        }
      },
      upsert:true
    }
  }));

  if(operations.length>0){
    await Permission.bulkWrite(operations,{ordered:false});
  }
};
