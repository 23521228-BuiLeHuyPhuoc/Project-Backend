const joi=require('joi');

const passwordSchema=joi.string()
  .required()
  .min(8)
  .pattern(/[A-Z]/,{name:'chữ hoa'})
  .pattern(/[a-z]/,{name:'chữ thường'})
  .pattern(/[0-9]/,{name:'chữ số'})
  .pattern(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/,{name:'ký tự đặc biệt'})
  .messages({
    'string.empty':'Vui lòng nhập mật khẩu!',
    'string.min':'Mật khẩu phải có ít nhất 8 ký tự!',
    'string.pattern.name':'Mật khẩu phải chứa ít nhất một {#name}!'
  });

const emailSchema=joi.string().trim().lowercase().required().email().messages({
  'string.empty':'Vui lòng nhập email!',
  'string.email':'Vui lòng nhập đúng định dạng email!'
});

const validate=schema=>(req,res,next)=>{
  const {value,error}=schema.validate(req.body,{abortEarly:false});
  if(error){
    return res.status(400).json({
      code:'error',
      message:error.details.map(item=>item.message).join('\n')
    });
  }
  req.body=value;
  next();
};

module.exports.loginPost=validate(joi.object({
  email:emailSchema,
  password:joi.string().required().messages({
    'string.empty':'Vui lòng nhập mật khẩu!'
  }),
  rememberPassword:joi.boolean().default(false)
}));

module.exports.forgotPasswordPost=validate(joi.object({email:emailSchema}));

module.exports.otpPasswordPost=validate(joi.object({
  email:emailSchema,
  otp:joi.string().required().pattern(/^\d{6}$/).messages({
    'string.empty':'Vui lòng nhập mã OTP!',
    'string.pattern.base':'Mã OTP phải gồm đúng 6 chữ số!'
  })
}));

module.exports.resetPasswordPost=validate(joi.object({
  password:passwordSchema
}));
