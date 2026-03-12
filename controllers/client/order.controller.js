const Tour=require('../../models/tour.model');
const Order=require('../../models/order.model');
const moment=require('moment');
const City=require('../../models/city.model');
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