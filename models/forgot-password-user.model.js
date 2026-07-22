const mongoose=require('mongoose');

const forgotPasswordUserSchema=new mongoose.Schema({
  userId:{
    type:mongoose.Schema.Types.ObjectId,
    ref:'User',
    required:true
  },
  email:{
    type:String,
    required:true,
    unique:true,
    lowercase:true,
    trim:true
  },
  otpHash:{
    type:String,
    required:true,
    select:false
  },
  attempts:{
    type:Number,
    default:0
  },
  verifiedAt:{
    type:Date,
    default:null
  },
  expireAt:{
    type:Date,
    required:true,
    expires:0
  }
},{
  timestamps:true
});

module.exports=mongoose.model(
  'ForgotPasswordUser',
  forgotPasswordUserSchema,
  'forgot-password-users'
);
