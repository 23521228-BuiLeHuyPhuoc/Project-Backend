const Tour=require('../../models/tour.model');
const Order=require('../../models/order.model');
const moment=require('moment');
const City=require('../../models/city.model');
const generateHelper=require('../../helpers/generate.helper');
const axios=require('axios');
const CryptoJS=require('crypto-js');
module.exports.createPost=async(req,res)=>{
   try{
    let subTotal=0;
    for(const item of req.body.items)
    {
        const infoTour=await Tour.findOne({
            _id:item.tourId,
            status:"active",
            deleted:false
        })
        if(infoTour){
            item.priceNewAdult=infoTour.priceNewAdult;
            item.priceNewChildren=infoTour.priceNewChildren;
            item.priceNewBaby=infoTour.priceNewBaby;
            item.departureDate=infoTour.departureDate;
            item.avatar=infoTour.avatar;
            await Tour.updateOne({
                _id:item.tourId
            },{
                stockAdult:infoTour.stockAdult-item.quantityAdult,
                stockChildren:infoTour.stockChildren-item.quantityChildren,
                stockBaby:infoTour.stockBaby-item.quantityBaby
            })
            subTotal+=item.priceNewAdult*item.quantityAdult+item.priceNewChildren*item.quantityChildren+item.priceNewBaby*item.quantityBaby;
       
      
        }

    }
        req.body.orderCode="OD"+Date.now();
        
        req.body.discount=0;
        req.body.total=subTotal-req.body.discount;
        req.body.paymentStatus="unpaid";
        req.body.status="initial";
        const order=new Order(req.body);
        await order.save();



res.json({
        code:"success",
        message:"Đặt hàng thành công",
        orderId:order._id
    })
}catch(error)
{
    res.json({
        code:"error",
        message:error.message
    })
}

    
    
    
    
    
}
module.exports.success=async(req,res)=>{
    const orderId=req.query.orderId;
    const phone=req.query.phone;
    let query={_id:orderId};
    if(phone){
        query.phone=phone;
    }
    const order=await Order.findOne(query);
    if(!order){
        return res.json({
            code:"error",
            message:"Không tìm thấy đơn hàng"
        });
    }
    const tourList=await Tour.find({
        deleted:false
    })
    const city=await City.find({

    })
    for(let item of order.items)
    {
        for(const tour of tourList)
        {
            if(tour._id==item.tourId)
            {
                item.name=tour.name;
                item.slug=tour.slug;
            }
        }
        item.formatDepartureDate=moment(item.departureDate).format("DD/MM/YYYY");
        const findcity=city.find(c=>c._id==item.locationFrom);
        item.cityName=findcity.name;
    }
    if(order.createdAt)
    {
        order.formatCreatedAt=moment(order.createdAt).format("HH:mm DD/MM/YYYY");
    }
    res.render("client/pages/order-success",{
        pageTitle:"Đặt hàng thành công",
        order:order
    })

}
module.exports.paymentZaloPay=async(req,res)=>{
    try{
        const orderId=req.params.orderId;
        const orderDetail=await Order.findOne({
            deleted:false,
            paymentStatus:"unpaid",
            _id:orderId
        });

        if(!orderDetail) {
            return res.status(404).json({
                code:"error",
                message:"Không tìm thấy đơn hàng hoặc đơn đã thanh toán"
            });
        }

        const appId=Number(process.env.ZALOPAY_APP_ID || 554);
        const key1=process.env.ZALOPAY_KEY1 || "8NdU5pG5R2spGHGhyO99HN1OhD8IQJBn";
        const endpoint=process.env.ZALOPAY_ENDPOINT || "https://sb-openapi.zalopay.vn/v2/create";
        const callbackUrl=process.env.ZALOPAY_CALLBACK_URL || "";

        const appTime=Date.now();
        const appTransId=`${moment().format('YYMMDD')}_${orderDetail.orderCode}_${appTime}`;
        const item=JSON.stringify(orderDetail.items || []);

        const baseUrl=process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
        const embedData=JSON.stringify({
            orderId:String(orderDetail._id),
            redirecturl:`${baseUrl}/order/zalopay-return?orderId=${orderDetail._id}`
        });

        const data={
            app_id:appId,
            app_user:String(orderDetail.phone || "guest"),
            app_trans_id:appTransId,
            app_time:appTime,
            item:item,
            embed_data:embedData,
            amount:Number(orderDetail.total || 0),
            description:`Thanh toan don hang ${orderDetail.orderCode}`,
            bank_code:"",
            callback_url:callbackUrl
        };

        const dataForMac=`${data.app_id}|${data.app_trans_id}|${data.app_user}|${data.amount}|${data.app_time}|${data.embed_data}|${data.item}`;
        data.mac=CryptoJS.HmacSHA256(dataForMac, key1).toString();

        const response=await axios.post(endpoint, data, {
            headers:{
                "Content-Type":"application/json",
                "Accept":"application/json"
            }
        });

        console.log("ZaloPay response:", response.data);

        if(response.data?.return_code === 1 && response.data?.order_url) {
            return res.redirect(response.data.order_url);
        }

        return res.status(400).json({
            code:"error",
            message:response.data?.return_message || "Không thể tạo giao dịch ZaloPay",
            data:response.data
        });
    }
    catch(error)
    {
        console.log("ZaloPay error:", error.response?.data || error.message);
        return res.status(500).json({
            code:"error",
            message:"Lỗi kết nối ZaloPay",
            detail:error.response?.data || error.message
        });
    }
}

// [POST] /order/zalopay-callback - ZaloPay server-to-server callback (IPN)
module.exports.callbackZaloPay=async(req,res)=>{
    try{
        const key2=process.env.ZALOPAY_KEY2 || "trMrHtvjo6myautxDUiAcYsVtaeQ8nhf";
        const dataStr=req.body.data;
        const reqMac=req.body.mac;

        const mac=CryptoJS.HmacSHA256(dataStr, key2).toString();

        if(reqMac !== mac){
            console.log("ZaloPay callback: mac không hợp lệ");
            return res.json({return_code:-1,return_message:"mac not equal"});
        }

        const dataJson=JSON.parse(dataStr);
        const embedData=JSON.parse(dataJson.embed_data || "{}");
        const orderId=embedData.orderId;

        console.log("ZaloPay callback: thanh toán thành công, orderId =", orderId);

        if(orderId){
            await Order.updateOne(
                {_id:orderId},
                {paymentStatus:"paid"}
            );
        }

        return res.json({return_code:1,return_message:"success"});
    }
    catch(error){
        console.log("ZaloPay callback error:", error.message);
        return res.json({return_code:0,return_message:error.message});
    }
}

// [GET] /order/zalopay-return - ZaloPay redirect user back after payment
module.exports.zalopayReturn=async(req,res)=>{
    try{
        const orderId=req.query.orderId;
        if(!orderId){
            return res.redirect("/");
        }

        const order=await Order.findOne({_id:orderId});
        if(!order){
            return res.redirect("/");
        }

        return res.redirect(`/order/success?orderId=${orderId}&phone=${order.phone}`);
    }
    catch(error){
        console.log("ZaloPay return error:", error.message);
        return res.redirect("/");
    }
}