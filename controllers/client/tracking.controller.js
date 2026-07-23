const Tour=require('../../models/tour.model');
const UserInteraction=require('../../models/user-interaction.model');

const interactionTypes=[
  'view',
  'favorite',
  'cart_add',
  'purchase',
  'rating',
  'search',
  'click_recommendation',
  'recommendation_ignore'
];

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

module.exports.stats=async(req,res)=>{
  try{
    const now=new Date();
    const last24Hours=new Date(now.getTime()-24*60*60*1000);
    const last7Days=new Date(now.getTime()-7*24*60*60*1000);
    const [aggregationResult]=await UserInteraction.aggregate([
      {
        $facet:{
          totals:[
            {
              $group:{
                _id:null,
                total:{$sum:1},
                authenticated:{$sum:{$cond:[
                  {$ne:[{$ifNull:['$userId',null]},null]},
                  1,
                  0
                ]}},
                anonymous:{$sum:{$cond:[
                  {
                    $and:[
                      {$eq:[{$ifNull:['$userId',null]},null]},
                      {$ne:[{$ifNull:['$sessionId','']},'']}
                    ]
                  },
                  1,
                  0
                ]}},
                last24Hours:{$sum:{$cond:[
                  {$gte:['$createdAt',last24Hours]},
                  1,
                  0
                ]}}
              }
            }
          ],
          byType:[
            {$group:{_id:'$type',count:{$sum:1}}},
            {$sort:{count:-1,_id:1}}
          ],
          uniqueUsers:[
            {$match:{userId:{$ne:null}}},
            {$group:{_id:'$userId'}},
            {$count:'count'}
          ],
          uniqueSessions:[
            {$match:{userId:null,sessionId:{$nin:[null,'']}}},
            {$group:{_id:'$sessionId'}},
            {$count:'count'}
          ],
          dailyLast7Days:[
            {$match:{createdAt:{$gte:last7Days}}},
            {
              $group:{
                _id:{
                  $dateToString:{
                    format:'%Y-%m-%d',
                    date:'$createdAt',
                    timezone:'Asia/Ho_Chi_Minh'
                  }
                },
                count:{$sum:1}
              }
            },
            {$sort:{_id:1}}
          ]
        }
      }
    ]);
    const result=aggregationResult || {
      totals:[],
      byType:[],
      uniqueUsers:[],
      uniqueSessions:[],
      dailyLast7Days:[]
    };
    const totals=result.totals[0] || {
      total:0,
      authenticated:0,
      anonymous:0,
      last24Hours:0
    };
    const byType=Object.fromEntries(interactionTypes.map(type=>[type,0]));
    result.byType.forEach(item=>{
      if(Object.prototype.hasOwnProperty.call(byType,item._id)){
        byType[item._id]=item.count;
      }
    });

    return res.json({
      code:'success',
      generatedAt:now,
      totals:{
        ...totals,
        uniqueUsers:result.uniqueUsers[0]?.count || 0,
        uniqueSessions:result.uniqueSessions[0]?.count || 0
      },
      byType,
      dailyLast7Days:result.dailyLast7Days.map(item=>({
        date:item._id,
        count:item.count
      }))
    });
  }
  catch(error){
    console.error('Unable to load tracking stats:',error.message);
    return res.status(500).json({
      code:'error',
      message:'Unable to load tracking stats.'
    });
  }
};
