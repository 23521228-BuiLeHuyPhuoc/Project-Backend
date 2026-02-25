const joi=require("joi");
module.exports.createPost=async(req,res,next)=>
{
    const schema=joi.object({
        name:joi.string().required().messages({
            "string.empty":"Vui lòng nhập tên danh mục!"
        }),
        parent:joi.string().allow(""),
        position:joi.number().allow(""),
        status:joi.string().allow("").valid("active","inactive"),
        avatar:joi.string().allow(""),
        description:joi.string().allow("")
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
module.exports.editPatch=async(req,res,next)=>
{
    const schema=joi.object({
        name:joi.string().required().messages({
            "string.empty":"Vui lòng nhập tên danh mục!"
        }),
        parent:joi.string().allow(""),
        position:joi.number().allow(""),
        status:joi.string().allow("").valid("active","inactive"),
        avatar:joi.string().allow(""),
        description:joi.string().allow("")
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