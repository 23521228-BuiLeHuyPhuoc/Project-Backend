const Tour=require('../../models/tour.model');
const Order=require('../../models/order.model');
const Voucher=require('../../models/voucher.model');
const UserVoucher=require('../../models/user-voucher.model');
const mongoose=require('mongoose');
const crypto=require('crypto');
const moment=require('moment');
const City=require('../../models/city.model');
const generateHelper=require('../../helpers/generate.helper');
const axios=require('axios');
const CryptoJS=require('crypto-js');
require('dotenv').config();
const sortHelper=require('../../helpers/sort.helper');
const {createNotificationSafe}=require('../../helpers/notification.helper');
const {cancelOrderAndRelease}=require('../../helpers/order.helper');
const {
  VoucherValidationError,
  calculateDiscount,
  getApplicableVoucher,
  normalizeVoucherCode
}=require('../../helpers/voucher.helper');
const signaturesMatch=(left,right)=>{
  const leftBuffer=Buffer.from(String(left || ''),'utf8');
  const rightBuffer=Buffer.from(String(right || ''),'utf8');
  return leftBuffer.length===rightBuffer.length
    && crypto.timingSafeEqual(leftBuffer,rightBuffer);
};
module.exports.createPost=async(req,res)=>{
  const reservedItems=[];
  let order=null;
  let orderId=null;
  let reservedUserVoucher=null;
  let reservedVoucher=null;

  try{
    const fullName=typeof req.user.fullName==='string' ? req.user.fullName.trim() : '';
    const phone=typeof req.user.phone==='string' ? req.user.phone.replace(/[\s.-]/g,'') : '';
    const note=typeof req.body.note==='string' ? req.body.note.trim() : '';
    const paymentMethod=req.body.paymentMethod;
    const voucherCode=normalizeVoucherCode(req.body.voucherCode);
    const paymentMethods=['money','bank','zalopay','vnpay'];

    if(fullName.length<2 || fullName.length>50){
      return res.status(400).json({code:'error',message:'Vui lòng cập nhật họ tên trong hồ sơ tài khoản!'});
    }
    if(!/^(?:\+84|0)\d{8,10}$/.test(phone)){
      return res.status(400).json({code:'error',message:'Vui lòng cập nhật số điện thoại hợp lệ trong hồ sơ tài khoản!'});
    }
    if(!paymentMethods.includes(paymentMethod)){
      return res.status(400).json({code:'error',message:'Phương thức thanh toán không hợp lệ!'});
    }
    if(note.length>1000){
      return res.status(400).json({code:'error',message:'Ghi chú không được vượt quá 1000 ký tự!'});
    }

    const selectedCartItems=req.user.cart.filter(item=>
      item.checked && (item.quantityAdult+item.quantityChildren+item.quantityBaby)>0
    );
    if(!selectedCartItems.length){
      return res.status(400).json({code:'error',message:'Vui lòng chọn ít nhất một tour!'});
    }

    const tourIds=[...new Set(selectedCartItems.map(item=>String(item.tourId)))];
    const tours=await Tour.find({
      _id:{$in:tourIds},
      status:'active',
      deleted:false
    });
    const tourMap=new Map(tours.map(tour=>[String(tour._id),tour]));
    const items=[];
    let subTotal=0;

    for(const cartItem of selectedCartItems){
      const tour=tourMap.get(String(cartItem.tourId));
      const supportsLocation=tour && tour.locations.some(location=>String(location)===String(cartItem.locationFrom));
      if(!tour || !supportsLocation){
        return res.status(409).json({
          code:'error',
          message:'Có tour trong giỏ không còn khả dụng. Vui lòng tải lại giỏ hàng!'
        });
      }

      const item={
        tourId:tour._id,
        locationFrom:cartItem.locationFrom,
        quantityAdult:cartItem.quantityAdult,
        quantityChildren:cartItem.quantityChildren,
        quantityBaby:cartItem.quantityBaby,
        priceNewAdult:tour.priceNewAdult,
        priceNewChildren:tour.priceNewChildren,
        priceNewBaby:tour.priceNewBaby,
        departureDate:tour.departureDate,
        avatar:tour.avatar
      };
      items.push(item);
      subTotal+=(item.priceNewAdult*item.quantityAdult)
        +(item.priceNewChildren*item.quantityChildren)
        +(item.priceNewBaby*item.quantityBaby);
    }

    const voucherSelection=voucherCode
      ? await getApplicableVoucher({userId:req.user.id,code:voucherCode,subTotal})
      : null;

    for(const item of items){
      const reservedTour=await Tour.findOneAndUpdate({
        _id:item.tourId,
        status:'active',
        deleted:false,
        stockAdult:{$gte:item.quantityAdult},
        stockChildren:{$gte:item.quantityChildren},
        stockBaby:{$gte:item.quantityBaby}
      },{
        $inc:{
          stockAdult:-item.quantityAdult,
          stockChildren:-item.quantityChildren,
          stockBaby:-item.quantityBaby
        }
      });
      if(!reservedTour){
        const stockError=new Error('Số chỗ của một tour vừa thay đổi. Vui lòng kiểm tra lại giỏ hàng!');
        stockError.status=409;
        throw stockError;
      }
      reservedItems.push(item);
    }

    orderId=new mongoose.Types.ObjectId();
    let discount=0;
    if(voucherSelection){
      reservedUserVoucher=await UserVoucher.findOneAndUpdate({
        _id:voucherSelection.userVoucher._id,
        userId:req.user.id,
        status:'available'
      },{
        $set:{status:'used',usedAt:new Date(),orderId}
      },{new:true});
      if(!reservedUserVoucher){
        throw new VoucherValidationError('Mã giảm giá vừa được sử dụng ở một đơn hàng khác!',409);
      }

      const now=new Date();
      reservedVoucher=await Voucher.findOneAndUpdate({
        _id:voucherSelection.voucher._id,
        status:'active',
        deleted:false,
        startAt:{$lte:now},
        endAt:{$gte:now},
        $expr:{
          $or:[
            {$lte:['$usageLimit',0]},
            {$lt:['$usedCount','$usageLimit']}
          ]
        }
      },{
        $inc:{usedCount:1}
      },{new:true});
      if(!reservedVoucher){
        throw new VoucherValidationError('Mã giảm giá vừa hết lượt sử dụng!',409);
      }
      if(subTotal<Number(reservedVoucher.minOrderValue || 0)){
        throw new VoucherValidationError('Đơn hàng không còn đủ điều kiện áp dụng mã giảm giá!');
      }
      discount=calculateDiscount(reservedVoucher,subTotal);
    }

    order=await Order.create({
      _id:orderId,
      orderCode:`OD${Date.now()}`,
      userId:req.user.id,
      fullName,
      phone,
      note,
      items,
      subTotal,
      discount,
      total:subTotal-discount,
      voucherCode:voucherSelection ? voucherSelection.code : '',
      paymentMethod,
      paymentStatus:'unpaid',
      status:'initial'
    });

    req.user.cart.pull(...selectedCartItems.map(item=>item._id));
    await req.user.save();

    await createNotificationSafe({
        userId:req.user.id,
        title:'Đặt tour thành công',
        message:`Đơn ${order.orderCode} đã được tạo và đang chờ xác nhận.`,
        type:'order',
        link:`/account/orders/${order.id}`
      });

    res.status(201).json({
      code:'success',
      message:'Đặt tour thành công',
      orderId:order._id
    });
  }
  catch(error){
    if(order){
      await Order.deleteOne({_id:order._id}).catch(()=>{});
    }
    if(reservedVoucher){
      await Voucher.updateOne({
        _id:reservedVoucher._id,
        usedCount:{$gt:0}
      },{
        $inc:{usedCount:-1}
      }).catch(()=>{});
    }
    if(reservedUserVoucher){
      await UserVoucher.updateOne({
        _id:reservedUserVoucher._id,
        userId:req.user.id,
        status:'used',
        orderId
      },{
        $set:{status:'available',usedAt:null,orderId:null}
      }).catch(()=>{});
    }
    await Promise.all(reservedItems.map(reserved=>Tour.updateOne(
      {_id:reserved.tourId},
      {$inc:{
        stockAdult:reserved.quantityAdult,
        stockChildren:reserved.quantityChildren,
        stockBaby:reserved.quantityBaby
      }}
    ).catch(()=>{})));
    res.status(error.status || 500).json({
      code:'error',
      message:error.status ? error.message : 'Không thể đặt tour lúc này!'
    });
  }
}
module.exports.success=async(req,res)=>{
    const orderId=req.query.orderId;
    if(!mongoose.isValidObjectId(orderId)){
        return res.redirect('/account/orders');
    }
    const order=await Order.findOne({
        _id:orderId,
        userId:req.user.id,
        deleted:false
    })
    if(!order){
        return res.redirect('/account/orders');
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
        item.cityName=findcity ? findcity.name : "";
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
}
module.exports.paymentZaloPay=async(req,res)=>{
    const orderId=req.params.orderId;
    try{
        if(!mongoose.isValidObjectId(orderId)){
            return res.redirect('/cart');
        }
        const orderDetail=await Order.findOne({
            deleted:false,
            paymentStatus:"unpaid",
            paymentMethod:'zalopay',
            status:{$in:['initial','pending']},
            _id:orderId,
            userId:req.user.id
        });
        if(!orderDetail){
            return res.redirect('/cart');
        }
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
        await cancelOrderAndRelease({
          _id:orderId,
          paymentMethod:'zalopay',
          paymentStatus:'unpaid',
          status:{$in:['initial','pending']}
        });
        res.redirect(`/account/orders/${orderId}`);

    }

    }
    catch(error)
    {
        return res.status(500).json({
            code:"error",
            message:"Lỗi kết nối ZaloPay",
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


    // kiểm tra callback hợp lệ (đến từ ZaloPay server)
    if (!signaturesMatch(reqMac,mac)) {
      // callback không hợp lệ
      result.return_code = -1;
      result.return_message = "mac not equal";
    }
    else {
      // thanh toán thành công
      const dataJson=JSON.parse(dataStr);
      const appUser=String(dataJson.app_user || '');
      const separatorIndex=appUser.lastIndexOf('-');
      const phone=appUser.slice(0,separatorIndex);
      const orderId=appUser.slice(separatorIndex+1);
      const orderFilter={
        _id:orderId,
        phone,
        total:Number(dataJson.amount),
        paymentMethod:'zalopay',
        deleted:false
      };

      if(separatorIndex<=0 || !mongoose.isValidObjectId(orderId) || !Number.isFinite(Number(dataJson.amount))){
        result.return_code=0;
        result.return_message="order not found or invalid";
      }
      else{
        const existingOrder=await Order.findOne(orderFilter);
        if(!existingOrder || existingOrder.status==='cancelled'){
          result.return_code=0;
          result.return_message="order not found or invalid";
        }
        else if(existingOrder.paymentStatus==='paid'){
          result.return_code=1;
          result.return_message="success";
        }
        else if(!['initial','pending'].includes(existingOrder.status)){
          result.return_code=0;
          result.return_message="order status is invalid";
        }
        else{
          const updateResult=await Order.updateOne({
            ...orderFilter,
            paymentStatus:'unpaid',
            status:{$in:['initial','pending']}
          },{
            $set:{paymentStatus:'paid',status:'confirmed'}
          });
          if(updateResult.matchedCount===0){
            const paidOrder=await Order.findOne({...orderFilter,paymentStatus:'paid'});
            result.return_code=paidOrder ? 1 : 0;
            result.return_message=paidOrder ? "success" : "order not found or invalid";
          }
          else{
            result.return_code=1;
            result.return_message="success";
          }
        }
      }
    }
  } catch (ex) {
    result.return_code = 0; // ZaloPay server sẽ callback lại (tối đa 3 lần)
    result.return_message = ex.message;
  }

  // thông báo kết quả cho ZaloPay server
  res.json(result);
}
module.exports.paymentVnPay=async(req,res)=>{
    const OrderId=req.params.orderId;
    try{
        if(!mongoose.isValidObjectId(OrderId)){
            return res.redirect('/cart');
        }
        const orderDetail=await Order.findOne({
            deleted:false,
            paymentStatus:"unpaid",
            paymentMethod:'vnpay',
            status:{$in:['initial','pending']},
            _id:OrderId,
            userId:req.user.id
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
    let hmac = crypto.createHmac("sha512", secretKey);
    let signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex"); 
    vnp_Params['vnp_SecureHash'] = signed;
    vnpUrl += '?' + querystring.stringify(vnp_Params, { encode: false });

    res.redirect(vnpUrl)
}
    catch(error){
        await cancelOrderAndRelease({
          _id:OrderId,
          paymentMethod:'vnpay',
          paymentStatus:'unpaid',
          status:{$in:['initial','pending']}
        }).catch(()=>{});
        res.redirect(`/account/orders/${OrderId}`);
    }

}
module.exports.paymentVnPayResult=async(req,res)=>{
    let vnp_Params = {...req.query};

    let secureHash = vnp_Params['vnp_SecureHash'];

    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    vnp_Params = sortHelper.sortObject(vnp_Params);

    let secretKey = process.env.VNPAY_SECRETKEY;

    let querystring = require('qs');
    let signData = querystring.stringify(vnp_Params, { encode: false });
    let hmac = crypto.createHmac("sha512", secretKey);
    let signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");     

    if(!signaturesMatch(secureHash,signed)){
      return res.redirect('/account/orders');
    }

    const orderId=String(vnp_Params['vnp_TxnRef'] || '').split('-')[0];
    if(!mongoose.isValidObjectId(orderId)){
      return res.redirect('/account/orders');
    }
    const orderDetail=await Order.findOne({
      _id:orderId,
      paymentMethod:'vnpay',
      deleted:false,
      status:{$ne:'cancelled'}
    });
    if(!orderDetail){
      return res.redirect('/account/orders');
    }

    const paymentSucceeded=vnp_Params['vnp_ResponseCode']==='00'
      && vnp_Params['vnp_TransactionStatus']==='00'
      && Number(vnp_Params['vnp_Amount'])===Number(orderDetail.total)*100;
    if(paymentSucceeded){
      if(orderDetail.paymentStatus==='paid'){
        return res.redirect(`/order/success?orderId=${orderId}`);
      }
      if(!['initial','pending'].includes(orderDetail.status)){
        return res.redirect(`/account/orders/${orderId}`);
      }
      await Order.updateOne({
        _id:orderId,
        deleted:false,
        paymentStatus:'unpaid',
        status:{$in:['initial','pending']}
      },{
        $set:{paymentStatus:'paid',status:'confirmed'}
      });
      return res.redirect(`/order/success?orderId=${orderId}`);
    }

    await cancelOrderAndRelease({
      _id:orderId,
      paymentMethod:'vnpay',
      paymentStatus:'unpaid',
      status:{$in:['initial','pending']}
    });
    return res.redirect(`/account/orders/${orderId}`);
}
