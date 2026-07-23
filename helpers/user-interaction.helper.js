const UserInteraction=require('../models/user-interaction.model');

const runSafely=async operation=>{
  try{
    return await operation();
  }
  catch(error){
    console.error('Unable to sync UserInteraction:',error.message);
    return null;
  }
};

module.exports.createInteractionSafe=payload=>runSafely(
  ()=>UserInteraction.create(payload)
);

module.exports.syncRatingInteraction=review=>runSafely(
  ()=>UserInteraction.findOneAndUpdate({
    userId:review.userId,
    tourId:review.tourId,
    type:'rating'
  },{
    $set:{value:Number(review.rating)},
    $setOnInsert:{
      userId:review.userId,
      tourId:review.tourId,
      type:'rating'
    }
  },{
    upsert:true,
    new:true,
    runValidators:true,
    setDefaultsOnInsert:true
  })
);

module.exports.removeRatingInteraction=review=>runSafely(
  ()=>UserInteraction.deleteMany({
    userId:review.userId,
    tourId:review.tourId,
    type:'rating'
  })
);

module.exports.syncFavoriteInteraction=({userId,tourId})=>runSafely(
  ()=>UserInteraction.findOneAndUpdate({
    userId,
    tourId,
    type:'favorite'
  },{
    $set:{value:2},
    $setOnInsert:{userId,tourId,type:'favorite'}
  },{
    upsert:true,
    new:true,
    runValidators:true,
    setDefaultsOnInsert:true
  })
);

module.exports.removeFavoriteInteraction=({userId,tourId})=>runSafely(
  ()=>UserInteraction.deleteMany({userId,tourId,type:'favorite'})
);

module.exports.recordCompletedOrderInteractions=order=>{
  const tourIds=[...new Set((order.items || [])
    .map(item=>item.tourId && String(item.tourId))
    .filter(Boolean))];

  if(!order.userId || !tourIds.length){
    return Promise.resolve(null);
  }

  return runSafely(()=>UserInteraction.insertMany(tourIds.map(tourId=>({
    userId:order.userId,
    tourId,
    type:'purchase',
    value:5
  }))));
};
