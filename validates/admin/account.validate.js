const joi=require('joi');
module.exports.registerPost=async(req,res,next)=>{
    const schema=joi.object({
        fullName:joi.string().required().messages({
        "string.empty":"Vui lòng nhập họ tên!",

        }),
        email:joi.string().required().messages({
            "string.empty":"Vui lòng nhập email!",

        }),
        password:joi.string().required().messages({
            "string.empty":"Vui lòng nhập mật khẩu!",
        }),

    })
    const {error}=schema.validate(req.body,{abortEarly:false});
    if(error){
        console.log(error);
        res.json({
            code:"error",
            message:"Lỗi!"
        });
        return;
    }

    next();

}