const Order=require('../../models/order.model');
const Review=require('../../models/review.model');
const Tour=require('../../models/tour.model');
const UserInteraction=require('../../models/user-interaction.model');

const DEFAULT_WINDOW_DAYS=30;
const DEFAULT_ATTRIBUTION_DAYS=30;

const getId=value=>value===undefined || value===null ? '' : String(value);

const toValidDate=value=>{
  const date=value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
};

const round=(value,digits=2)=>{
  const number=Number(value);
  if(!Number.isFinite(number)){
    return null;
  }
  const factor=10**digits;
  return Math.round(number*factor)/factor;
};

const percentage=(value,total)=>total>0
  ? round(Math.min(100,Math.max(0,value/total*100)),2)
  : 0;

const getClickKey=(click,index)=>getId(click._id)
  || getId(click.metadata && click.metadata.clientEventId)
  || `${getId(click.userId)}:${getId(click.tourId)}:${toValidDate(click.createdAt)?.getTime() || 0}:${index}`;

const findAttributedClickKeys=(clicks,orders,attributionDays)=>{
  const attributionMs=attributionDays*24*60*60*1000;
  const clickIndex=new Map();
  clicks.forEach((click,index)=>{
    const userId=getId(click.userId);
    const tourId=getId(click.tourId);
    const createdAt=toValidDate(click.createdAt);
    if(!userId || !tourId || !createdAt){
      return;
    }
    const pairKey=`${userId}:${tourId}`;
    if(!clickIndex.has(pairKey)){
      clickIndex.set(pairKey,[]);
    }
    clickIndex.get(pairKey).push({
      key:getClickKey(click,index),
      timestamp:createdAt.getTime()
    });
  });
  clickIndex.forEach(records=>records.sort(
    (first,second)=>first.timestamp-second.timestamp
  ));

  const attributed=new Set();
  orders.forEach(order=>{
    const userId=getId(order.userId);
    const orderDate=toValidDate(order.createdAt);
    if(!userId || !orderDate){
      return;
    }
    const orderTimestamp=orderDate.getTime();
    const tourIds=new Set((order.items || [])
      .map(item=>getId(item && item.tourId))
      .filter(Boolean));
    tourIds.forEach(tourId=>{
      const records=clickIndex.get(`${userId}:${tourId}`) || [];
      for(let index=records.length-1;index>=0;index-=1){
        const record=records[index];
        if(record.timestamp>orderTimestamp){
          continue;
        }
        if(orderTimestamp-record.timestamp<=attributionMs){
          attributed.add(record.key);
        }
        break;
      }
    });
  });
  return attributed;
};

const calculateRecommendationMonitoring=options=>{
  const clicks=Array.isArray(options.clicks) ? options.clicks : [];
  const orders=Array.isArray(options.orders) ? options.orders : [];
  const ignoreCount=Math.max(0,Number(options.ignoreCount) || 0);
  const clickCount=clicks.length;
  const responseCount=clickCount+ignoreCount;
  const authenticatedClicks=clicks.filter(click=>getId(click.userId));
  const attributionDays=Number(options.attributionDays)
    || DEFAULT_ATTRIBUTION_DAYS;
  const attributed=findAttributedClickKeys(
    authenticatedClicks,
    orders,
    attributionDays
  );
  const reviewSummary=options.reviewSummary || {};
  const totalTours=Math.max(0,Number(options.totalTours) || 0);
  const reviewedTourCount=Math.max(
    0,
    Number(reviewSummary.reviewedTourCount) || 0
  );
  const schedulerStatus=options.schedulerStatus || {};
  const modelMetrics=schedulerStatus.metrics || {};
  const cache=schedulerStatus.cache || {};

  return {
    generatedAt:options.generatedAt || new Date(),
    windowDays:Number(options.windowDays) || DEFAULT_WINDOW_DAYS,
    engagement:{
      ctr:percentage(clickCount,responseCount),
      clickCount,
      ignoreCount,
      responseCount,
      dataQuality:responseCount===0
        ? 'empty'
        : ignoreCount===0
          ? 'partial'
          : 'complete'
    },
    conversion:{
      rate:percentage(attributed.size,authenticatedClicks.length),
      attributedClicks:attributed.size,
      eligibleClicks:authenticatedClicks.length,
      attributionDays
    },
    quality:{
      averageRating:round(reviewSummary.averageRating,2) || 0,
      reviewCount:Math.max(0,Number(reviewSummary.reviewCount) || 0),
      reviewedTourCount,
      totalTours,
      reviewCoverage:percentage(reviewedTourCount,totalTours)
    },
    model:{
      ready:Boolean(schedulerStatus.lastTrainedAt),
      training:Boolean(schedulerStatus.training),
      rmse:round(modelMetrics.rmse,4),
      mae:round(modelMetrics.mae,4),
      precisionAtK:round(modelMetrics.precisionAtK,4),
      precisionK:Number(modelMetrics.precisionK) || 0,
      lastTrainedAt:schedulerStatus.lastTrainedAt || null,
      lastReason:schedulerStatus.lastReason || null
    },
    cache:{
      hitRate:percentage(Number(cache.hits) || 0,
        (Number(cache.hits) || 0)+(Number(cache.misses) || 0)),
      hits:Math.max(0,Number(cache.hits) || 0),
      misses:Math.max(0,Number(cache.misses) || 0),
      size:Math.max(0,Number(cache.size) || 0),
      maxEntries:Math.max(0,Number(cache.maxEntries) || 0)
    }
  };
};

const createEmptyRecommendationMonitoring=(schedulerStatus={})=>
  calculateRecommendationMonitoring({
    clicks:[],
    orders:[],
    ignoreCount:0,
    reviewSummary:{},
    totalTours:0,
    schedulerStatus
  });

const loadRecommendationMonitoring=async(options={})=>{
  const models={
    Order,
    Review,
    Tour,
    UserInteraction,
    ...(options.models || {})
  };
  const now=toValidDate(options.now) || new Date();
  const windowDays=Number(options.windowDays) || DEFAULT_WINDOW_DAYS;
  const since=new Date(now.getTime()-windowDays*24*60*60*1000);
  const [clicks,ignoreCount,reviewRows,totalTours]=await Promise.all([
    models.UserInteraction.find({
      type:'click_recommendation',
      createdAt:{$gte:since,$lte:now}
    }).select('_id userId tourId createdAt metadata.clientEventId').lean(),
    models.UserInteraction.countDocuments({
      type:'recommendation_ignore',
      createdAt:{$gte:since,$lte:now}
    }),
    models.Review.aggregate([
      {$match:{deleted:false,status:'published'}},
      {$group:{
        _id:null,
        averageRating:{$avg:'$rating'},
        reviewCount:{$sum:1},
        reviewedTours:{$addToSet:'$tourId'}
      }},
      {$project:{
        _id:0,
        averageRating:1,
        reviewCount:1,
        reviewedTourCount:{$size:'$reviewedTours'}
      }}
    ]),
    models.Tour.countDocuments({status:'active',deleted:false})
  ]);
  const userIds=[...new Set(clicks.map(click=>getId(click.userId)).filter(Boolean))];
  const orders=userIds.length
    ? await models.Order.find({
      userId:{$in:userIds},
      deleted:false,
      isMock:{$ne:true},
      status:{$ne:'cancelled'},
      $or:[
        {paymentStatus:'paid'},
        {status:'completed'}
      ],
      createdAt:{$gte:since,$lte:now}
    }).select('_id userId items.tourId createdAt').lean()
    : [];

  return calculateRecommendationMonitoring({
    clicks,
    orders,
    ignoreCount,
    reviewSummary:reviewRows[0] || {},
    totalTours,
    schedulerStatus:options.schedulerStatus,
    generatedAt:now,
    windowDays,
    attributionDays:options.attributionDays
  });
};

module.exports={
  DEFAULT_ATTRIBUTION_DAYS,
  DEFAULT_WINDOW_DAYS,
  calculateRecommendationMonitoring,
  createEmptyRecommendationMonitoring,
  findAttributedClickKeys,
  loadRecommendationMonitoring
};
