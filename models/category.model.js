const mongoose=require('mongoose');
const schema=new mongoose.Schema({
    name:String,
    parent:String,
    position:Number,
    status:String,
    avatar:String,  
    description:String,
    createdBy: String,
    updatedBy: String,
    slug:String,
    deleted: {
        type:Boolean,
        default:false
    },
    deletedBy:String,
    deletedAt:Date
    
},{
    timestamps:true,
}

)
const Category=mongoose.model('Category',schema,"categories")
module.exports=Category;