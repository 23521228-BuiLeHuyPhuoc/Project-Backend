const {
  createTfjsModelArtifact
}=require('../../services/recommendation/tfjs-exporter');
const mongoose=require('mongoose');
const {randomUUID}=require('node:crypto');
const Tour=require('../../models/tour.model');
const UserInteraction=require('../../models/user-interaction.model');
const {
  getRecommendationCacheFromApp,
  invalidateRecommendationCache
}=require('../../services/recommendation/cache-manager');

const defaultModels={Tour,UserInteraction};

const getSchedulerStatus=req=>{
  const scheduler=req.app
    && req.app.locals
    && req.app.locals.recommendationScheduler;
  return scheduler && typeof scheduler.getStatus==='function'
    ? scheduler.getStatus()
    : {};
};

const getArtifact=req=>{
  const status=getSchedulerStatus(req);
  return createTfjsModelArtifact({trainedAt:status.lastTrainedAt});
};

const getModels=req=>({
  ...defaultModels,
  ...(req.app && req.app.locals && req.app.locals.recommendationModels || {})
});

const getEngine=req=>{
  const scheduler=req.app
    && req.app.locals
    && req.app.locals.recommendationScheduler;
  return scheduler && typeof scheduler.getEngine==='function'
    ? scheduler.getEngine()
    : null;
};

const normalizeLimit=(value,fallback)=>{
  const number=Number.parseInt(value,10);
  return Number.isInteger(number) && number>0
    ? Math.min(number,50)
    : fallback;
};

const getRecommendationsFromCacheValue=value=>Array.isArray(value)
  ? value
  : value && Array.isArray(value.recommendations)
    ? value.recommendations
    : [];

const loadCachedRecommendations=async(req,res,options)=>{
  const cache=getRecommendationCacheFromApp(req.app);
  if(!cache){
    res.set('X-Recommendation-Cache','BYPASS');
    return options.loader();
  }
  const key=cache.createKey(options.scope,options.keyParts);
  const result=await cache.remember(key,options.loader,{
    tags:value=>[
      `scope:${options.scope}`,
      ...(options.tags || []),
      ...getRecommendationsFromCacheValue(value).map(item=>
        `tour:${String(item.tourId)}`
      )
    ]
  });
  res.set('X-Recommendation-Cache',result.status);
  return result.value;
};

const serializeTour=value=>{
  const tour=value && typeof value.toObject==='function'
    ? value.toObject()
    : value || {};
  const priceAdult=Number(tour.priceAdult || 0);
  const priceNewAdult=Number(tour.priceNewAdult || 0);
  return {
    _id:String(tour._id || ''),
    name:tour.name || '',
    slug:tour.slug || '',
    avatar:tour.avatar || '',
    category:tour.category || null,
    locations:Array.isArray(tour.locations) ? tour.locations : [],
    time:tour.time || '',
    vehicle:tour.vehicle || '',
    departureDate:tour.departureDate || null,
    priceAdult,
    priceNewAdult,
    discount:priceAdult>0 && priceNewAdult>0 && priceNewAdult<priceAdult
      ? Number(((priceAdult-priceNewAdult)/priceAdult*100).toFixed(2))
      : 0,
    stockAdult:Number(tour.stockAdult || 0),
    ratingAvg:Number(tour.ratingAvg || 0),
    ratingCount:Number(tour.ratingCount || 0)
  };
};

const serializeRecommendation=item=>({
  tourId:String(item.tourId),
  score:Number(item.score || 0),
  ...(item.components ? {components:{...item.components}} : {}),
  ...(item.weights ? {weights:{...item.weights}} : {}),
  ...(item.metrics ? {metrics:{...item.metrics}} : {}),
  ...(item.normalized ? {normalized:{...item.normalized}} : {}),
  tour:serializeTour(item.tour)
});

const sendRecommendations=(res,recommendations,extra={})=>{
  const requestId=randomUUID();
  return res.json({
    code:'success',
    data:{
      requestId,
      recommendations:recommendations.map((item,index)=>({
        ...serializeRecommendation(item),
        position:index
      })),
      count:recommendations.length,
      generatedAt:new Date().toISOString(),
      ...extra
    }
  });
};

const sendUnavailable=res=>res.status(503).json({
  code:'error',
  message:'Recommendation engine chua san sang!'
});

module.exports.personalized=async(req,res)=>{
  try{
    const engine=getEngine(req);
    if(!engine){
      return sendUnavailable(res);
    }
    const userId=req.user ? req.user.id : null;
    const limit=normalizeLimit(req.query.limit,10);
    const excludeTourId=mongoose.isValidObjectId(req.query.excludeTourId)
      ? String(req.query.excludeTourId)
      : '';
    const cached=await loadCachedRecommendations(req,res,{
      scope:'personalized',
      keyParts:{userId:userId || 'anonymous',limit,excludeTourId},
      tags:[userId ? `user:${userId}` : 'audience:anonymous'],
      loader:async()=>{
        const recommendations=await engine.getRecommendations(userId,{
          limit,
          excludeTourIds:excludeTourId ? [excludeTourId] : []
        });
        const strategy=recommendations[0]
          && recommendations[0].weights
          && recommendations[0].weights.strategy
          || (await engine.getWeightsForUser(userId)).strategy;
        return {recommendations,strategy};
      }
    });
    res.set('Cache-Control',userId
      ? 'private, no-store'
      : 'public, max-age=60');
    return sendRecommendations(res,cached.recommendations,{
      personalized:Boolean(userId),
      strategy:cached.strategy
    });
  }catch(error){
    console.error('Unable to load personalized recommendations:',error.message);
    return res.status(500).json({
      code:'error',
      message:'Khong the tai de xuat ca nhan luc nay!'
    });
  }
};

module.exports.similar=async(req,res)=>{
  try{
    if(!mongoose.isValidObjectId(req.params.tourId)){
      return res.status(400).json({
        code:'error',
        message:'Tour ID khong hop le!'
      });
    }
    const engine=getEngine(req);
    if(!engine){
      return sendUnavailable(res);
    }
    await engine.ensureInitialized();
    const tourId=String(req.params.tourId);
    if(!engine.content.tourMap.has(tourId)){
      return res.status(404).json({
        code:'error',
        message:'Khong tim thay tour!'
      });
    }
    const limit=normalizeLimit(req.query.limit,6);
    const recommendations=await loadCachedRecommendations(req,res,{
      scope:'similar',
      keyParts:{tourId,limit},
      tags:[`tour:${tourId}`],
      loader:()=>engine.content.getSimilarTours(tourId,{limit})
    });
    res.set('Cache-Control','public, max-age=300');
    return sendRecommendations(res,recommendations,{sourceTourId:tourId});
  }catch(error){
    console.error('Unable to load similar tours:',error.message);
    return res.status(500).json({
      code:'error',
      message:'Khong the tai tour tuong tu luc nay!'
    });
  }
};

module.exports.trending=async(req,res)=>{
  try{
    const engine=getEngine(req);
    if(!engine){
      return sendUnavailable(res);
    }
    const limit=normalizeLimit(req.query.limit,8);
    const recommendations=await loadCachedRecommendations(req,res,{
      scope:'trending',
      keyParts:{limit},
      loader:()=>engine.popularity.getRecommendations({limit})
    });
    res.set('Cache-Control','public, max-age=60, stale-while-revalidate=300');
    return sendRecommendations(res,recommendations,{algorithm:'popularity'});
  }catch(error){
    console.error('Unable to load trending tours:',error.message);
    return res.status(500).json({
      code:'error',
      message:'Khong the tai tour trending luc nay!'
    });
  }
};

module.exports.topRated=async(req,res)=>{
  try{
    const engine=getEngine(req);
    if(!engine){
      return sendUnavailable(res);
    }
    const limit=normalizeLimit(req.query.limit,8);
    const recommendations=await loadCachedRecommendations(req,res,{
      scope:'top-rated',
      keyParts:{limit},
      loader:async()=>{
        const candidates=await engine.popularity.getRecommendations();
        return candidates
          .map(item=>({
            ...item,
            score:Number((Number(item.tour.ratingAvg || 0)/5).toFixed(6))
          }))
          .sort((first,second)=>
            Number(second.tour.ratingAvg || 0)-Number(first.tour.ratingAvg || 0)
            || Number(second.tour.ratingCount || 0)
              -Number(first.tour.ratingCount || 0)
            || first.tourId.localeCompare(second.tourId))
          .slice(0,limit);
      }
    });
    res.set('Cache-Control','public, max-age=300, stale-while-revalidate=600');
    return sendRecommendations(res,recommendations,{algorithm:'top_rated'});
  }catch(error){
    console.error('Unable to load top-rated tours:',error.message);
    return res.status(500).json({
      code:'error',
      message:'Khong the tai tour danh gia cao luc nay!'
    });
  }
};

module.exports.feedback=async(req,res)=>{
  try{
    const models=getModels(req);
    const tourExists=await models.Tour.exists({
      _id:req.body.tourId,
      status:'active',
      deleted:false
    });
    if(!tourExists){
      return res.status(404).json({
        code:'error',
        message:'Khong tim thay tour!'
      });
    }
    const userId=req.user ? req.user.id : null;
    const sessionId=userId
      ? null
      : req.body.sessionId
        || req.session && req.session.trackingSessionId
        || req.sessionID;
    if(!userId && !sessionId){
      return res.status(400).json({
        code:'error',
        message:'Khong the xac dinh phien nguoi dung!'
      });
    }
    if(!userId && req.session){
      req.session.trackingSessionId=sessionId;
    }
    const isClick=req.body.action==='click';
    const requestedDeviceType=req.get('x-device-type');
    const deviceType=['mobile','desktop','tablet'].includes(requestedDeviceType)
      ? requestedDeviceType
      : undefined;
    await models.UserInteraction.create({
      userId,
      sessionId,
      tourId:req.body.tourId,
      type:isClick ? 'click_recommendation' : 'recommendation_ignore',
      value:isClick ? 2.5 : 0,
      metadata:{
        clientEventId:req.body.eventId,
        interactionKind:isClick
          ? 'recommendation_click'
          : 'recommendation_ignore',
        occurredAt:req.body.occurredAt,
        pagePath:req.body.pagePath,
        source:'recommendation',
        recommendationRequestId:req.body.requestId,
        recommendationPosition:req.body.position,
        recommendationSurface:req.body.source,
        recommendationScores:req.body.scores,
        deviceType
      }
    });
    if(isClick && userId){
      invalidateRecommendationCache(req.app,{userId});
    }
    return res.status(201).json({
      code:'success',
      accepted:1,
      action:req.body.action
    });
  }catch(error){
    if(error && error.code===11000){
      return res.status(200).json({
        code:'success',
        accepted:0,
        duplicate:true
      });
    }
    console.error('Unable to store recommendation feedback:',error.message);
    return res.status(500).json({
      code:'error',
      message:'Khong the luu recommendation feedback luc nay!'
    });
  }
};

module.exports.model=(req,res)=>{
  const artifact=getArtifact(req);
  res.set('Cache-Control','public, max-age=300');
  return res.json(artifact.modelJson);
};

module.exports.weights=(req,res)=>{
  const artifact=getArtifact(req);
  res.set({
    'Content-Type':'application/octet-stream',
    'Content-Length':String(artifact.weights.length),
    'Cache-Control':'public, max-age=300'
  });
  return res.send(artifact.weights);
};

module.exports.metadata=(req,res)=>{
  const artifact=getArtifact(req);
  const status=getSchedulerStatus(req);
  res.set('Cache-Control','public, max-age=60');
  return res.json({
    ...artifact.metadata,
    scheduler:{
      ready:Boolean(status.lastTrainedAt),
      lastTrainedAt:status.lastTrainedAt || null,
      lastReason:status.lastReason || null
    }
  });
};
