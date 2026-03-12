const Tour=require('../../models/tour.model');
const Order=require('../../models/order.model');
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