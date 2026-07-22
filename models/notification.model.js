const mongoose=require('mongoose');

const notificationSchema=new mongoose.Schema({
  userId:{
    type:mongoose.Schema.Types.ObjectId,
    ref:'User',
    required:true,
    index:true
  },
  title:{
    type:String,
    required:true,
    trim:true
  },
  message:{
    type:String,
    required:true,
    trim:true
  },
  type:{
    type:String,
    enum:["order","voucher","review","account","system"],
    default:"system"
  },
  link:{
    type:String,
    default:"/account/notifications"
  },
  readAt:{
    type:Date,
    default:null
  },
  deleted:{
    type:Boolean,
    default:false
  },
  createdBy:String,
  deletedBy:String,
  deletedAt:Date
},{timestamps:true});

module.exports=mongoose.model('Notification',notificationSchema,'notifications');
