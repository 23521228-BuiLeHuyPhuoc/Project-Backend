const joi=require('joi');

const objectIdPattern=/^[a-fA-F0-9]{24}$/;
const tokenPattern=/^[A-Za-z0-9_-]{16,100}$/;

module.exports.feedback=(req,res,next)=>{
  const schema=joi.object({
    eventId:joi.string().trim().pattern(tokenPattern).required(),
    requestId:joi.string().trim().pattern(tokenPattern).allow('').default(''),
    sessionId:joi.string().trim().pattern(tokenPattern).allow('').default(''),
    tourId:joi.string().trim().pattern(objectIdPattern).required(),
    action:joi.string().valid('click','ignore').required(),
    position:joi.number().integer().min(0).max(100).default(0),
    source:joi.string().valid(
      'home',
      'detail',
      'category',
      'search',
      'cart',
      'order_success',
      'recommendation'
    ).default('recommendation'),
    pagePath:joi.string().trim().max(500).allow('').default(''),
    occurredAt:joi.date().iso().default(()=>new Date()),
    scores:joi.object({
      final:joi.number().min(0).max(5),
      content:joi.number().min(0).max(5),
      collaborative:joi.number().min(0).max(5),
      popularity:joi.number().min(0).max(5),
      contextual:joi.number().min(0).max(5)
    }).default({})
  });
  const {value,error}=schema.validate(req.body,{
    abortEarly:false,
    stripUnknown:true
  });
  if(error){
    return res.status(400).json({
      code:'error',
      message:'Du lieu recommendation feedback khong hop le!'
    });
  }
  req.body=value;
  next();
};
