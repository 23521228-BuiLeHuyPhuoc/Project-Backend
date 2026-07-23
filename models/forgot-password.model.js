const mongoose=require('mongoose');
const schema=new mongoose.Schema(
    {
        userId:{
            type:mongoose.Schema.Types.ObjectId,
            ref:'AccountAdmin',
            required:true
        },
        email:{
            type:String,
            required:true,
            unique:true,
            lowercase:true,
            trim:true
        },
        otpHash:{
            type:String,
            required:true,
            select:false
        },
        attempts:{
            type:Number,
            default:0
        },
        verifiedAt:{
            type:Date,
            default:null
        },
        expireAt:{
            type:Date,
            required:true,
            expires:0
        }
    },
        {
            timestamps:true,
        }
    
);
const ForgotPassword=mongoose.model('ForgotPassword',schema,"forgot-password");
module.exports=ForgotPassword;
