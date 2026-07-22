const Tour=require('../../models/tour.model');
const Order=require('../../models/order.model');
const moment=require('moment');
const City=require('../../models/city.model');
const generateHelper=require('../../helpers/generate.helper');
const axios=require('axios');
const CryptoJS=require('crypto-js');
require('dotenv').config();
const sortHelper=require('../../helpers/sort.helper');
const Notification=require('../../models/notification.model');
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
        req.body.userId=req.user ? req.user.id : null;
        const order=new Order(req.body);
        await order.save();

        if(req.user){
            await Notification.create({
                userId:req.user.id,
                title:"Đặt tour thành công",
                message:`Đơn ${order.orderCode} đã được tạo và đang chờ xác nhận.`,
                type:"order",
                link:`/account/orders/${order.id}`
            });
        }



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
        const config = {
    app_id: process.env.ZALOPAY_APPID,
    key1: process.env.ZALOPAY_KEY1,
    key2: process.env.ZALOPAY_KEY2,
    endpoint: process.env.ZALOPAY_ENDPOINT
};
const embed_data = {
      redirecturl: `${process.env.NGROK}/order/success?orderId=${orderDetail.id}&phone=${orderDetail.phone}`
    };


const items = [{}];
const transID = Math.floor(Math.random() * 1000000);
const order = {
    app_id: config.app_id,
    app_trans_id: `${moment().format('YYMMDD')}_${transID}`, // translation missing: vi.docs.shared.sample_code.comments.app_trans_id
    app_user: `${orderDetail.phone}-${orderDetail._id}`, 
    app_time: Date.now(), // miliseconds
    item: JSON.stringify(items),
    embed_data: JSON.stringify(embed_data),
    amount: orderDetail.total,
    description: `Thanh toán đơn hàng ${orderDetail.orderCode}`,
    bank_code: "",
    callback_url: `${process.env.NGROK}/order/payment-zalopay-result`
};

// appid|app_trans_id|appuser|amount|apptime|embeddata|item
const data = config.app_id + "|" + order.app_trans_id + "|" + order.app_user + "|" + order.amount + "|" + order.app_time + "|" + order.embed_data + "|" + order.item;
order.mac = CryptoJS.HmacSHA256(data, config.key1).toString();

const response=await axios.post(config.endpoint, null, { params: order })
    if(response.data.return_code==1)
    {
        res.redirect(response.data.order_url);
    }
    else{
        res.redirect("/");

    }

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
module.exports.paymentZaloPayResultPost = async (req, res) => {
  const config = {
    key2: process.env.ZALOPAY_KEY2
  };

  let result = {};

  try {
    let dataStr = req.body.data;
    let reqMac = req.body.mac;

    let mac = CryptoJS.HmacSHA256(dataStr, config.key2).toString();
    console.log("mac =", mac);


    // kiểm tra callback hợp lệ (đến từ ZaloPay server)
    if (reqMac !== mac) {
      // callback không hợp lệ
      result.return_code = -1;
      result.return_message = "mac not equal";
    }
    else {
      // thanh toán thành công
      let dataJson = JSON.parse(dataStr, config.key2);
      const [ phone, orderId ] = dataJson.app_user.split("-");

      await Order.updateOne({
        _id: orderId,
        phone: phone,
        deleted: false
      }, {
        paymentStatus: "paid"
      })

      result.return_code = 1;
      result.return_message = "success";
    }
  } catch (ex) {
    result.return_code = 0; // ZaloPay server sẽ callback lại (tối đa 3 lần)
    result.return_message = ex.message;
  }

  // thông báo kết quả cho ZaloPay server
  res.json(result);
}
module.exports.paymentVnPay=async(req,res)=>{
    try{
        const OrderId=req.params.orderId;
        const orderDetail=await Order.findOne({
            deleted:false,
            paymentStatus:"unpaid",
            _id:OrderId
        });
        if(!orderDetail)        {
           res.redirect("/");
           return;
        
    }
    let date = new Date();
    let createDate = moment(date).format('YYYYMMDDHHmmss');
    
    let ipAddr = req.headers['x-forwarded-for'] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        req.connection.socket.remoteAddress;

    
    
    let tmnCode = process.env.VNPAY_TMNCODE;
    let secretKey = process.env.VNPAY_SECRETKEY;
    let vnpUrl = process.env.VNPAY_URL;
    let returnUrl = `${process.env.NGROK}/order/payment-vnpay-result`;
    let orderId = `${OrderId}-${Date.now()}`;
    let amount = orderDetail.total;
    let bankCode = "";
    
    let locale = "vn";
    let currCode = 'VND';
    let vnp_Params = {};
    vnp_Params['vnp_Version'] = '2.1.0';
    vnp_Params['vnp_Command'] = 'pay';
    vnp_Params['vnp_TmnCode'] = tmnCode;
    vnp_Params['vnp_Locale'] = locale;
    vnp_Params['vnp_CurrCode'] = currCode;
    vnp_Params['vnp_TxnRef'] = orderId;
    vnp_Params['vnp_OrderInfo'] = 'Thanh toan cho ma GD:' + orderId;
    vnp_Params['vnp_OrderType'] = 'other';
    vnp_Params['vnp_Amount'] = amount * 100;
    vnp_Params['vnp_ReturnUrl'] = returnUrl;
    vnp_Params['vnp_IpAddr'] = ipAddr;
    vnp_Params['vnp_CreateDate'] = createDate;
    if(bankCode !== null && bankCode !== ''){
        vnp_Params['vnp_BankCode'] = bankCode;
    }

    vnp_Params = sortHelper.sortObject(vnp_Params);

    let querystring = require('qs');
    let signData = querystring.stringify(vnp_Params, { encode: false });
    let crypto = require("crypto");     
    let hmac = crypto.createHmac("sha512", secretKey);
    let signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex"); 
    vnp_Params['vnp_SecureHash'] = signed;
    vnpUrl += '?' + querystring.stringify(vnp_Params, { encode: false });

    res.redirect(vnpUrl)
}
    catch(error){
        res.redirect("/");
    }

}
module.exports.paymentVnPayResult=async(req,res)=>{
    let vnp_Params = req.query;

    let secureHash = vnp_Params['vnp_SecureHash'];

    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    vnp_Params = sortHelper.sortObject(vnp_Params);

    let secretKey = process.env.VNPAY_SECRETKEY;

    let querystring = require('qs');
    let signData = querystring.stringify(vnp_Params, { encode: false });
    let crypto = require("crypto");     
    let hmac = crypto.createHmac("sha512", secretKey);
    let signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");     

    if(secureHash === signed){
        //Kiem tra xem du lieu trong db co hop le hay khong va thong bao ket qua
        if(vnp_Params['vnp_ResponseCode'] === '00'&& vnp_Params['vnp_TransactionStatus']==='00') {
        const orderId=vnp_Params['vnp_TxnRef'].split("-")[0];
        const orderDetail=await Order.findOne({
            _id:orderId,
            deleted:false
        })
        await Order.updateOne({
            _id:orderId,
            deleted:false
        },{
                paymentStatus:"paid"
        })
        res.redirect(`${process.env.NGROK}/order/success?orderId=${orderId}&phone=${orderDetail.phone}`);
    }
    else{
        res.redirect("/");
    }
    } else{
        res.redirect("/");
    }
}
