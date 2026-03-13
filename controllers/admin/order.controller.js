const Order=require("../../models/order.model");
const Tour=require("../../models/tour.model");
const moment=require("moment");
const City=require("../../models/city.model");
module.exports.list=async (req,res)=>{
    const find={
        deleted:false
    };
    const orderList=await Order.find(find)
    .sort({
        createdAt:"desc"
    });
    const tourList=await Tour.find({});
    for(let order of orderList){
        for(let item of order.items){
            const tourIndex=tourList.findIndex(tour=>{
                return tour._id==item.tourId
            })
            if(tourIndex){
                item.Name=tourList[tourIndex].name;
            }
                    item.FormatDepartureDate=moment(order.departureDate).format("DD/MM/YYYY");

        }
        order.FormatCreatedAt=moment(order.createdAt).format("HH:mm DD/MM/YYYY");
    }
    res.render("admin/pages/order-list",{
        pageTitle:"Danh sách đơn hàng",
        orderList:orderList
    })
}
module.exports.edit=async (req,res)=>{
    const id=req.params.id;
    const orderRecord=await Order.findOne({
        _id:id
    })
    const tourList=await Tour.find({});
    
        for(let item of orderRecord.items){
            const tourIndex=tourList.findIndex(tour=>{
                return tour._id==item.tourId
            })
            if(tourIndex){
                item.Name=tourList[tourIndex].name;
            }
            
            const city=await City.findOne({
                _id:item.locationFrom
            })
            item.locationNameFrom=city?city.name:"";
        }
        orderRecord.FormatCreatedAt=moment(orderRecord.createdAt).format("YYYY-MM-DDTHH:mm:ss");

    
    res.render("admin/pages/order-edit",{
        pageTitle:"Chỉnh sửa đơn hàng",
        orderRecord:orderRecord
    })
}
module.exports.editPatch=async(req,res)=>{
    try{
        const id=req.params.id;
    const order=await Order.findOne({
        _id:id
    })
    if(order){
        const updateResult=await Order.updateOne({
            _id:id
        },req.body)
        if(updateResult.matchedCount===0){
            return res.json({
                code:"error",
                message:"Không tìm thấy đơn hàng"
            })
        }
        req.flash("success","Cập nhật đơn hàng thành công");
        res.json({
            code:"success",
        })
        return;
    }
    return res.json({
        code:"error",
        message:"Không tìm thấy đơn hàng"
    })
}
    catch(error)
    {
        res.json({
            code:"error",
            message:"Có lỗi xảy ra"
        })
    }





}