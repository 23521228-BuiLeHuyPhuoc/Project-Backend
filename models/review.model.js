const mongoose=require('mongoose');

const reviewSchema=new mongoose.Schema({
  userId:{
    type:mongoose.Schema.Types.ObjectId,
    ref:'User',
    required:true,
    index:true
  },
  tourId:{
    type:mongoose.Schema.Types.ObjectId,
    ref:'Tour',
    required:true,
    index:true
  },
  orderId:{
    type:mongoose.Schema.Types.ObjectId,
    ref:'Order',
    required:true
  },
  rating:{
    type:Number,
    required:true,
    min:1,
    max:5
  },
  comment:{
    type:String,
    required:true,
    trim:true,
    maxlength:1000
  },
  status:{
    type:String,
    enum:["published","hidden"],
    default:"published"
  },
  deleted:{
    type:Boolean,
    default:false
  },
  deletedAt:Date,
  updatedBy:String,
  deletedBy:String
},{timestamps:true});

reviewSchema.index({userId:1,tourId:1},{unique:true});

module.exports=mongoose.model('Review',reviewSchema,'reviews');
