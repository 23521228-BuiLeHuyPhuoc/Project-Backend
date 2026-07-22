const joi=require('joi');

const sendValidationError=(res,error)=>res.status(400).json({
  code:'error',
  message:error.details.map(item=>item.message).join('\n')
});

const reviewFields={
  rating:joi.number().integer().min(1).max(5).required().messages({
    'number.base':'Vui lòng chọn số sao đánh giá!',
    'number.min':'Đánh giá phải từ 1 đến 5 sao!',
    'number.max':'Đánh giá phải từ 1 đến 5 sao!'
  }),
  comment:joi.string().trim().min(10).max(1000).required().messages({
    'string.empty':'Vui lòng nhập nội dung đánh giá!',
    'string.min':'Đánh giá cần có ít nhất 10 ký tự!',
    'string.max':'Đánh giá không được vượt quá 1000 ký tự!'
  })
};

module.exports.profile=(req,res,next)=>{
  const schema=joi.object({
    fullName:joi.string().trim().min(2).max(50).required().messages({
      'string.empty':'Vui lòng nhập họ tên!',
      'string.min':'Họ tên phải có ít nhất 2 ký tự!',
      'string.max':'Họ tên không được vượt quá 50 ký tự!'
    }),
    email:joi.string().trim().lowercase().email().required().messages({
      'string.empty':'Vui lòng nhập email!',
      'string.email':'Email không đúng định dạng!'
    }),
    phone:joi.string().allow('').pattern(/^(?:\+84|0)\d{8,10}$/).messages({
      'string.pattern.base':'Số điện thoại không đúng định dạng!'
    }),
    tourTypes:joi.array().items(
      joi.string().valid('beach','mountain','city','culture','adventure')
    ).default([]),
    budgetRange:joi.string().allow('').valid('','under-2','2-5','5-10','above-10'),
    locations:joi.array().items(
      joi.string().valid('da-lat','nha-trang','phu-quoc','ha-noi','da-nang')
    ).default([])
  });

  const payload={
    ...req.body,
    phone:typeof req.body.phone==='string'
      ? req.body.phone.replace(/[\s.-]/g,'')
      : req.body.phone
  };
  const {value,error}=schema.validate(payload,{abortEarly:false});
  if(error){
    return sendValidationError(res,error);
  }
  req.body=value;
  next();
};

module.exports.reviewCreate=(req,res,next)=>{
  const schema=joi.object({
    orderId:joi.string().hex().length(24).required().messages({
      'string.empty':'Thiếu thông tin đơn hàng!'
    }),
    tourId:joi.string().hex().length(24).required().messages({
      'string.empty':'Thiếu thông tin tour!'
    }),
    ...reviewFields
  });
  const {value,error}=schema.validate(req.body,{abortEarly:false});
  if(error){
    return sendValidationError(res,error);
  }
  req.body=value;
  next();
};

module.exports.reviewUpdate=(req,res,next)=>{
  const schema=joi.object(reviewFields);
  const {value,error}=schema.validate(req.body,{abortEarly:false});
  if(error){
    return sendValidationError(res,error);
  }
  req.body=value;
  next();
};
