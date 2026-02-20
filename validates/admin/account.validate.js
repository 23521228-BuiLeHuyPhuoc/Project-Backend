const joi=require('joi');
module.exports.registerPost=async(req,res,next)=>{
    const schema=joi.object({
        fullName:joi.string().required()
        .min(5)
        .max(50)        
        .messages({
        "string.empty":"Vui lòng nhập họ tên!",
        "string.min":"Họ tên phải có ít nhất 5 ký tự!",
        "string.max":"Họ tên không được vượt quá 50 ký tự!"
        }),
        email:joi.string().required().email().messages({
            "string.empty":"Vui lòng nhập email!",
            "string.email":"Vui lòng nhập đúng định dạng email!"
        }),
        password:joi.string().required()
        .min(8)
        .custom((value,helpers)=>{
        if(!/[A-Z]/.test(value))
        {
            return helpers.error("password.uppercase");
        }
        if(!/[a-z]/.test(value)){
            return helpers.error("password.lowercase");
        }
        
        if(!/[0-9]/.test(value)){
            return helpers.error("password.digit");
        }
        if(!/[!@#$%^&*()<>?,./_+=-]/.test(value)){
            return helpers.error("password.special");
        }
        return value;
    })
        .messages({
        "string.empty":"Vui lòng nhập mật khẩu!",
        "string.min":"Mật khẩu phải có ít nhất 8 ký tự!",
        "password.uppercase":"Mật khẩu phải chứa ít nhất một chữ cái viết hoa!",
        "password.lowercase":"Mật khẩu phải chứa ít nhất một chữ cái viết thường!",
        "password.digit":"Mật khẩu phải chứa ít nhất một chữ số!",
        "password.special":"Mật khẩu phải chứa ít nhất một ký tự đặc biệt!"        
        }),
        rememberPassword: joi.boolean(),
    })
    const {error}=schema.validate(req.body,{abortEarly:false});
    console.log(error);
    if(error){
         const errorMessage=error.details.map(err=>{
            return err.message;
         }).join("\n");
        
        res.json({
            code:"error",
            message: errorMessage
        });
        return;
    }

    next();

}
module.exports.loginPost=async(req,res,next)=>{
     const schema=joi.object({
        email:joi.string().required().email().messages({
            "string.empty":"Vui lòng nhập email!",
            "string.email":"Vui lòng nhập đúng định dạng email!"
        }),
        password:joi.string().required()
        .min(8)
        .custom((value,helpers)=>{
        if(!/[A-Z]/.test(value))
        {
            return helpers.error("password.uppercase");
        }
        if(!/[a-z]/.test(value)){
            return helpers.error("password.lowercase");
        }
        
        if(!/[0-9]/.test(value)){
            return helpers.error("password.digit");
        }
        if(!/[!@#$%^&*()<>?,./_+=-]/.test(value)){
            return helpers.error("password.special");
        }
        return value;
    })
        .messages({
        "string.empty":"Vui lòng nhập mật khẩu!",
        "string.min":"Mật khẩu phải có ít nhất 8 ký tự!",
        "password.uppercase":"Mật khẩu phải chứa ít nhất một chữ cái viết hoa!",
        "password.lowercase":"Mật khẩu phải chứa ít nhất một chữ cái viết thường!",
        "password.digit":"Mật khẩu phải chứa ít nhất một chữ số!",
        "password.special":"Mật khẩu phải chứa ít nhất một ký tự đặc biệt!"        
        }),
        rememberPassword: joi.boolean(),
    })
    const {error}=schema.validate(req.body,{abortEarly:false});
    console.log(error);
    if(error){
         const errorMessage=error.details.map(err=>{
            return err.message;
         }).join("\n");
        
        res.json({
            code:"error",
            message: errorMessage
        });
        return;
    }

    next();
}
module.exports.forgotPasswordPost=async(req,res,next)=>{
    
    
    
    next();
}