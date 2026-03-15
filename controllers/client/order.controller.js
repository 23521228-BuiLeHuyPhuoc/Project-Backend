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
    const order=await Order.findOne({
        _id:orderId,
        phone:phone
    })
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
    if(order)
    {
        if(order.createdAt)
        {
         order.formatCreatedAt=moment(order.createdAt).format("HH:mm DD/MM/YYYY");

        }
        res.render("client/pages/order-success",{
        pageTitle:"Đặt hàng thành công",
        order:order
    })
    }
    else{
        res.json({
            code:"error",
            message:"Không tìm thấy đơn hàng"
        })
    }
    

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

        const appTime=Date.now();
        const appTransId=`${moment().format('YYMMDD')}_${orderDetail.orderCode}_${appTime}`;
        const item=JSON.stringify(orderDetail.items || []);
        const embedData=JSON.stringify({
            orderId:String(orderDetail._id),
            redirect:"/order/success"
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
            bank_code:""
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