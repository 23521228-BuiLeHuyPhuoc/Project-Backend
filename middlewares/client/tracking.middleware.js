const crypto=require('crypto');
const Tour=require('../../models/tour.model');
const {createInteractionSafe}=require('../../helpers/user-interaction.helper');

const allowedSources=new Set([
  'home',
  'category',
  'search',
  'recommendation',
  'favorite',
  'direct'
]);

const decodePathSegment=value=>{
  try{
    return decodeURIComponent(value);
  }
  catch(error){
    return value;
  }
};

const getDeviceType=req=>{
  const userAgent=String(req.get('user-agent') || '');
  if(/ipad|tablet|playbook|silk|android(?!.*mobile)/i.test(userAgent)){
    return 'tablet';
  }
  if(/mobile|iphone|ipod|android|blackberry|iemobile|opera mini/i.test(userAgent)){
    return 'mobile';
  }
  return 'desktop';
};

const getSource=req=>{
  const explicitSource=String(
    (req.query && req.query.source) || (req.body && req.body.source) || ''
  ).trim();
  if(allowedSources.has(explicitSource)){
    return explicitSource;
  }

  try{
    const referer=new URL(req.get('referer'));
    if(referer.pathname==='/'){
      return 'home';
    }
    if(referer.pathname.startsWith('/category')){
      return 'category';
    }
    if(referer.pathname.startsWith('/search')){
      return 'search';
    }
    if(referer.pathname.startsWith('/account/favorites')){
      return 'favorite';
    }
  }
  catch(error){
    return 'direct';
  }

  return 'direct';
};

const getActor=req=>{
  if(req.user){
    return {userId:req.user.id};
  }

  const cookieSessionId=String(
    (req.cookies && req.cookies.trackingSessionId) || ''
  ).trim();
  const validCookieSessionId=/^[A-Za-z0-9_-]{16,100}$/.test(cookieSessionId)
    ? cookieSessionId
    : '';

  if(req.session){
    if(validCookieSessionId){
      req.session.trackingSessionId=validCookieSessionId;
    }
    else if(!req.session.trackingSessionId){
      req.session.trackingSessionId=crypto.randomUUID();
    }
    return {sessionId:req.session.trackingSessionId};
  }

  return validCookieSessionId || req.sessionID
    ? {sessionId:validCookieSessionId || req.sessionID}
    : {};
};

const getSearchQuery=req=>{
  const query=req.query || {};
  const keyword=String(query.keyword || query.q || query.locationTo || '').trim();
  if(keyword){
    return keyword;
  }

  const params=new URLSearchParams();
  Object.entries(query).forEach(([key,value])=>{
    const values=Array.isArray(value) ? value : [value];
    values.forEach(item=>params.append(key,String(item)));
  });
  return params.toString();
};

const getTrackingTarget=req=>{
  const path=req.path || '';
  const tourDetailMatch=path.match(/^\/tour\/detail\/([^/]+)\/?$/);
  if(req.method==='GET' && tourDetailMatch){
    return {
      type:'view',
      value:1,
      slug:decodePathSegment(tourDetailMatch[1])
    };
  }

  if(req.method==='GET' && /^\/search\/?$/.test(path)){
    return {
      type:'search',
      value:1.5,
      searchQuery:getSearchQuery(req)
    };
  }

  if(req.method==='POST' && /^\/cart(?:\/add)?\/?$/.test(path)){
    return {
      type:'cart_add',
      value:3,
      tourId:req.body && req.body.tourId
    };
  }

  return null;
};

module.exports.trackInteractions=(req,res,next)=>{
  const actor=getActor(req);
  res.locals=res.locals || {};
  res.locals.trackingSessionId=actor.sessionId || '';

  const target=getTrackingTarget(req);
  if(!target){
    return next();
  }

  const metadata={
    source:getSource(req),
    deviceType:getDeviceType(req)
  };
  if(target.searchQuery!==undefined){
    metadata.searchQuery=target.searchQuery;
  }

  res.once('finish',()=>{
    if(res.statusCode<200 || res.statusCode>=400){
      return;
    }

    void (async()=>{
      let tourId=target.tourId;
      if(target.slug){
        const tour=await Tour.findOne({
          slug:target.slug,
          status:'active',
          deleted:false
        }).select('_id').lean();
        if(!tour){
          return;
        }
        tourId=tour._id;
      }

      await createInteractionSafe({
        ...actor,
        tourId:tourId || null,
        type:target.type,
        value:target.value,
        metadata
      });
    })().catch(error=>{
      console.error('Unable to track interaction:',error.message);
    });
  });

  return next();
};
