const joi=require("joi");
const {topics}=require("../../config/contact");

module.exports.createMessage=(req,res,next)=>{
  const schema=joi.object({
    fullName:joi.string().trim().min(2).max(80).required().messages({
      "any.required":"Vui lòng nhập họ và tên!",
      "string.empty":"Vui lòng nhập họ và tên!",
      "string.min":"Họ và tên cần có ít nhất 2 ký tự!",
      "string.max":"Họ và tên không được vượt quá 80 ký tự!"
    }),
    email:joi.string().trim().lowercase().email().max(150).required().messages({
      "any.required":"Vui lòng nhập email!",
      "string.empty":"Vui lòng nhập email!",
      "string.email":"Email không đúng định dạng!",
      "string.max":"Email không được vượt quá 150 ký tự!"
    }),
    phone:joi.string().allow("").pattern(/^(?:\+84|0)\d{8,10}$/).messages({
      "string.pattern.base":"Số điện thoại không đúng định dạng!"
    }),
    subject:joi.string().valid(...topics.map(item=>item.value)).required().messages({
      "any.required":"Vui lòng chọn nội dung cần hỗ trợ!",
      "any.only":"Vui lòng chọn nội dung cần hỗ trợ!",
      "string.empty":"Vui lòng chọn nội dung cần hỗ trợ!"
    }),
    message:joi.string().trim().min(10).max(2000).required().messages({
      "any.required":"Vui lòng nhập lời nhắn!",
      "string.empty":"Vui lòng nhập lời nhắn!",
      "string.min":"Lời nhắn cần có ít nhất 10 ký tự!",
      "string.max":"Lời nhắn không được vượt quá 2000 ký tự!"
    }),
    website:joi.string().allow("").max(200).default("")
  });

  const payload={
    ...req.body,
    phone:typeof req.body.phone==="string"
      ? req.body.phone.replace(/[\s.-]/g,"")
      : req.body.phone
  };
  const {value,error}=schema.validate(payload,{abortEarly:false,stripUnknown:true});
  if(error){
    return res.status(400).json({
      code:"error",
      message:error.details.map(item=>item.message).join(" ")
    });
  }

  req.body=value;
  next();
};
