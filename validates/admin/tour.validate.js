const joi=require('joi');
module.exports.editPatch=async(req,res,next)=>{
    const schema=joi.object({
        name:joi.string().required().messages({
            "string.empty":"Tên tour không được để trống"
        }),
        category:joi.string().allow(""),
        position:joi.number().allow(""),
        status:joi.string().valid("active","inactive").required(),
        avatar:joi.string().allow(""),
        priceAdult:joi.number().allow(""),
        priceChildren:joi.number().allow(""),
        priceBaby:joi.number().allow(""),
        priceNewAdult:joi.number().allow(""),
        priceNewChildren:joi.number().allow(""),
        priceNewBaby:joi.number().allow(""),
        stockAdult:joi.number().allow(""),
        stockChildren:joi.number().allow(""),
        stockBaby:joi.number().allow(""),
        locations:joi.string().allow(""),
        time:joi.string().allow(""),
        vehicle:joi.string().allow(""),
        departureDate:joi.date().empty(""),
        information:joi.string().allow(""),
        schedules:joi.string().allow(""),
    })
    const {error}=schema.validate(req.body,{abortEarly:false,allowUnknown:true});
    console.log(error);
    if(error){
        const errorMessage=error.details.map(err=>{
            return err.message;
        }).join("\n");
        res.json({
            code:"error",
            message:errorMessage
        });
        return;
    }
    next();
}
module.exports.createPost=async(req,res,next)=>{
    const schema=joi.object({
        name:joi.string().required().messages({
            "string.empty":"Tên tour không được để trống"
        }),
        category:joi.string().allow(""),
        position:joi.number().allow(""),
        status:joi.string().valid("active","inactive").required(),
        avatar:joi.string().allow(""),
        priceAdult:joi.number().allow(""),
        priceChildren:joi.number().allow(""),
        priceBaby:joi.number().allow(""),
        priceNewAdult:joi.number().allow(""),
        priceNewChildren:joi.number().allow(""),
        priceNewBaby:joi.number().allow(""),
        stockAdult:joi.number().allow(""),
        stockChildren:joi.number().allow(""),
        stockBaby:joi.number().allow(""),
        locations:joi.string().allow(""),
        time:joi.string().allow(""),
        vehicle:joi.string().allow(""),
        departureDate:joi.date().empty(""),
        information:joi.string().allow(""),
        schedules:joi.string().allow(""),
    })
    const {error}=schema.validate(req.body,{abortEarly:false,allowUnknown:true});
    console.log(error);
    if(error){
        const errorMessage=error.details.map(err=>{
            return err.message;
        }).join("\n");
        res.json({
            code:"error",
            message:errorMessage
        });
        return;
    }
    next();
}