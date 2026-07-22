const mongoose=require("mongoose");

const schema=new mongoose.Schema({
  label:{
    type:String,
    required:true,
    trim:true
  },
  code:{
    type:String,
    required:true,
    lowercase:true,
    trim:true
  },
  path:{
    type:String,
    required:true,
    trim:true
  },
  method:{
    type:String,
    enum:["ALL","GET","POST","PATCH","PUT","DELETE"],
    default:"GET"
  },
  group:{
    type:String,
    default:"Khác",
    trim:true
  },
  description:{
    type:String,
    default:"",
    trim:true
  },
  status:{
    type:String,
    enum:["active","inactive"],
    default:"active"
  },
  isSystem:{
    type:Boolean,
    default:false
  },
  createdBy:String,
  updatedBy:String,
  deleted:{
    type:Boolean,
    default:false
  },
  deletedBy:String,
  deletedAt:Date
},{timestamps:true});

schema.index({code:1},{unique:true,partialFilterExpression:{deleted:false}});
schema.index({path:1,method:1},{unique:true,partialFilterExpression:{deleted:false}});

module.exports=mongoose.model("Permission",schema,"permissions");
