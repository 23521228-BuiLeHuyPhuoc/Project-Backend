const mongoose=require("mongoose");

const schema=new mongoose.Schema({
  title:{type:String,required:true,trim:true},
  slug:{type:String,required:true,lowercase:true,trim:true},
  image:{type:String,default:"",trim:true},
  category:{type:String,default:"Cẩm nang",trim:true},
  description:{type:String,required:true,trim:true},
  quote:{type:String,default:"",trim:true},
  contentHtml:{type:String,required:true},
  contentSections:{type:Array,default:[]},
  author:{type:String,default:"28.TRAVEL",trim:true},
  readTime:{type:String,default:"5 phút",trim:true},
  featured:{type:Boolean,default:false},
  status:{type:String,enum:["draft","published"],default:"draft"},
  publishedAt:Date,
  createdBy:String,
  updatedBy:String,
  deleted:{type:Boolean,default:false},
  deletedBy:String,
  deletedAt:Date
},{timestamps:true});

schema.index({slug:1},{unique:true,partialFilterExpression:{deleted:false}});

module.exports=mongoose.model("Article",schema,"articles");
