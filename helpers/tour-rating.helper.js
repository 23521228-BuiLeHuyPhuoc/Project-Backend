const mongoose=require('mongoose');
const Review=require('../models/review.model');
const Tour=require('../models/tour.model');

const updateTourRating=async tourId=>{
  if(!mongoose.isValidObjectId(tourId)){
    return null;
  }

  const objectId=new mongoose.Types.ObjectId(String(tourId));
  const [ratingStats]=await Review.aggregate([
    {
      $match:{
        tourId:objectId,
        status:'published',
        deleted:false
      }
    },
    {
      $group:{
        _id:'$tourId',
        ratingAvg:{$avg:'$rating'},
        ratingCount:{$sum:1}
      }
    }
  ]);
  const ratingAvg=ratingStats
    ? Number(Number(ratingStats.ratingAvg).toFixed(2))
    : 0;
  const ratingCount=ratingStats ? ratingStats.ratingCount : 0;

  await Tour.updateOne({_id:objectId},{
    $set:{ratingAvg,ratingCount}
  });

  return {ratingAvg,ratingCount};
};

module.exports.updateTourRating=updateTourRating;

module.exports.updateTourRatingSafe=async tourId=>{
  try{
    return await updateTourRating(tourId);
  }
  catch(error){
    console.error('Unable to update tour rating:',error.message);
    return null;
  }
};

module.exports.rebuildTourRatings=async()=>{
  const [ratingStats,tours]=await Promise.all([
    Review.aggregate([
      {$match:{status:'published',deleted:false}},
      {
        $group:{
          _id:'$tourId',
          ratingAvg:{$avg:'$rating'},
          ratingCount:{$sum:1}
        }
      }
    ]),
    Tour.find({}).select('_id').lean()
  ]);
  const ratingMap=new Map(ratingStats.map(item=>[
    String(item._id),
    {
      ratingAvg:Number(Number(item.ratingAvg).toFixed(2)),
      ratingCount:item.ratingCount
    }
  ]));

  if(!tours.length){
    return {toursUpdated:0};
  }

  await Tour.bulkWrite(tours.map(tour=>({
    updateOne:{
      filter:{_id:tour._id},
      update:{
        $set:ratingMap.get(String(tour._id)) || {
          ratingAvg:0,
          ratingCount:0
        }
      }
    }
  })));

  return {toursUpdated:tours.length};
};
