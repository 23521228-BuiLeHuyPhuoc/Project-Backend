const Tour=require('../../models/tour.model');
const UserInteraction=require('../../models/user-interaction.model');

module.exports.events=async(req,res)=>{
  try{
    const userId=req.user ? req.user.id : null;
    const sessionId=userId
      ? null
      : req.body.sessionId || (req.session && req.session.trackingSessionId) || req.sessionID;

    if(!userId && !sessionId){
      return res.status(400).json({
        code:'error',
        message:'Khong the xac dinh phien tracking!'
      });
    }

    if(!userId && req.session){
      req.session.trackingSessionId=sessionId;
    }

    const tourIds=[...new Set(req.body.events.map(event=>event.tourId))];
    const tours=await Tour.find({
      _id:{$in:tourIds},
      status:'active',
      deleted:false
    }).select('_id').lean();
    const validTourIds=new Set(tours.map(tour=>String(tour._id)));

    const interactions=req.body.events
      .filter(event=>validTourIds.has(String(event.tourId)))
      .map(event=>({
        userId,
        sessionId:userId ? null : sessionId,
        tourId:event.tourId,
        type:event.type,
        value:event.type==='click_recommendation' ? 2.5 : event.value,
        metadata:{
          ...event.metadata,
          clientEventId:event.eventId,
          occurredAt:event.occurredAt
        }
      }));

    if(interactions.length){
      await UserInteraction.bulkWrite(interactions.map(interaction=>({
        updateOne:{
          filter:{'metadata.clientEventId':interaction.metadata.clientEventId},
          update:{$setOnInsert:interaction},
          upsert:true
        }
      })),{ordered:false});
    }

    return res.status(201).json({
      code:'success',
      accepted:interactions.length
    });
  }
  catch(error){
    if(error && error.code===11000){
      return res.status(201).json({code:'success',accepted:0});
    }
    console.error('Unable to store tracking events:',error.message);
    return res.status(500).json({
      code:'error',
      message:'Khong the luu du lieu tracking luc nay!'
    });
  }
};
