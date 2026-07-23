const joi=require('joi');

const tokenPattern=/^[A-Za-z0-9_-]{16,100}$/;
const objectIdPattern=/^[a-fA-F0-9]{24}$/;

module.exports.events=(req,res,next)=>{
  const metadataSchema=joi.object({
    interactionKind:joi.string().valid(
      'detail_engagement',
      'hover',
      'recommendation_click'
    ),
    viewDuration:joi.number().min(0).max(86400),
    scrollDepth:joi.number().min(0).max(100),
    hoverDuration:joi.number().min(0).max(60000),
    reviewViewed:joi.boolean(),
    clickEvents:joi.array().items(joi.string().trim().max(50)).max(20),
    pagePath:joi.string().trim().max(500),
    source:joi.string().valid(
      'home',
      'category',
      'search',
      'recommendation',
      'favorite',
      'direct'
    ),
    deviceType:joi.string().valid('mobile','desktop','tablet')
  }).default({});

  const schema=joi.object({
    sessionId:joi.string().trim().pattern(tokenPattern).allow('').default(''),
    events:joi.array().items(joi.object({
      eventId:joi.string().trim().pattern(tokenPattern).required(),
      type:joi.string().valid('view','click_recommendation').required(),
      tourId:joi.string().trim().pattern(objectIdPattern).required(),
      value:joi.number().min(0).max(86400).required(),
      occurredAt:joi.date().iso().required(),
      metadata:metadataSchema
    })).min(1).max(50).required()
  });

  const {value,error}=schema.validate(req.body,{
    abortEarly:false,
    stripUnknown:true
  });
  if(error){
    return res.status(400).json({
      code:'error',
      message:'Du lieu tracking khong hop le!'
    });
  }

  req.body=value;
  next();
};
