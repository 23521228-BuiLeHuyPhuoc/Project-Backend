const joi=require('joi');

const passwordSchema=joi.string()
  .required()
  .min(8)
  .pattern(/[A-Z]/,{name:"chữ hoa"})
  .pattern(/[a-z]/,{name:"chữ thường"})
  .pattern(/[0-9]/,{name:"chữ số"})
  .pattern(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/,{name:"ký tự đặc biệt"})
  .messages({
    "string.empty":"Vui lòng nhập mật khẩu!",
    "string.min":"Mật khẩu phải có ít nhất 8 ký tự!",
    "string.pattern.name":"Mật khẩu phải chứa ít nhất một {#name}!"
  });

module.exports.registerPost=(req,res,next)=>{
  const schema=joi.object({
    fullName:joi.string().trim().required().min(2).max(50).messages({
      "string.empty":"Vui lòng nhập họ tên!",
      "string.min":"Họ tên phải có ít nhất 2 ký tự!",
      "string.max":"Họ tên không được vượt quá 50 ký tự!"
    }),
    email:joi.string().trim().lowercase().required().email().messages({
      "string.empty":"Vui lòng nhập email!",
      "string.email":"Email không đúng định dạng!"
    }),
    phone:joi.string().allow("").pattern(/^(?:\+84|0)\d{8,10}$/).messages({
      "string.pattern.base":"Số điện thoại không đúng định dạng!"
    }),
    password:passwordSchema,
    confirmPassword:joi.any().valid(joi.ref("password")).required().messages({
      "any.only":"Mật khẩu nhập lại không khớp!",
      "any.required":"Vui lòng nhập lại mật khẩu!"
    }),
    tourTypes:joi.array().items(
      joi.string().valid("beach","mountain","city","culture","adventure")
    ).default([]),
    budgetRange:joi.string().allow("").valid("","under-2","2-5","5-10","above-10"),
    locations:joi.array().items(
      joi.string().valid("da-lat","nha-trang","phu-quoc","ha-noi","da-nang")
    ).default([]),
    agree:joi.boolean().valid(true).required().messages({
      "any.only":"Bạn cần đồng ý với điều khoản sử dụng!",
      "any.required":"Bạn cần đồng ý với điều khoản sử dụng!"
    })
  });

  const payload={
    ...req.body,
    phone:typeof req.body.phone==="string"
      ? req.body.phone.replace(/[\s.-]/g,"")
      : req.body.phone
  };
  const {value,error}=schema.validate(payload,{abortEarly:false});

  if(error){
    return res.status(400).json({
      code:"error",
      message:error.details.map(item=>item.message).join("\n")
    });
  }

  req.body=value;
  next();
};

module.exports.loginPost=(req,res,next)=>{
  const schema=joi.object({
    email:joi.string().trim().lowercase().required().email().messages({
      "string.empty":"Vui lòng nhập email!",
      "string.email":"Email không đúng định dạng!"
    }),
    password:joi.string().required().messages({
      "string.empty":"Vui lòng nhập mật khẩu!"
    }),
    rememberPassword:joi.boolean().default(false)
  });
  const {value,error}=schema.validate(req.body,{abortEarly:false});

  if(error){
    return res.status(400).json({
      code:"error",
      message:error.details.map(item=>item.message).join("\n")
    });
  }

  req.body=value;
  next();
};
