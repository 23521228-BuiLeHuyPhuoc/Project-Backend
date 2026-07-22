const mongoose=require('mongoose');

const userVoucherSchema=new mongoose.Schema({
  userId:{
    type:mongoose.Schema.Types.ObjectId,
    ref:'User',
    required:true,
    index:true
  },
  voucherId:{
    type:mongoose.Schema.Types.ObjectId,
    ref:'Voucher',
    required:true
  },
  status:{
    type:String,
    enum:["available","used"],
    default:"available"
  },
  usedAt:Date,
  orderId:{
    type:mongoose.Schema.Types.ObjectId,
    ref:'Order',
    default:null
  }
},{timestamps:true});

userVoucherSchema.index({userId:1,voucherId:1},{unique:true});

module.exports=mongoose.model('UserVoucher',userVoucherSchema,'user-vouchers');
