const mongoose=require('mongoose');

const favoriteSchema=new mongoose.Schema({
  userId:{
    type:mongoose.Schema.Types.ObjectId,
    ref:'User',
    required:true,
    index:true
  },
  tourId:{
    type:mongoose.Schema.Types.ObjectId,
    ref:'Tour',
    required:true
  }
},{timestamps:true});

favoriteSchema.index({userId:1,tourId:1},{unique:true});

module.exports=mongoose.model('Favorite',favoriteSchema,'favorites');
