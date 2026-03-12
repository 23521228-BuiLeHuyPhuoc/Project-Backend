const Tour=require('../../models/tour.model');
const City=require('../../models/city.model');
const moment = require("moment");
module.exports.cart=(req,res)=>{
    res.render("client/pages/cart",{
        pageTitle:"Giỏ hàng"
    })
}
module.exports.cartDetailPost=async(req,res)=>{

        const cart=req.body.cart;
        for(const item of cart) {
    const tourInfo = await Tour.findOne({
      _id: item.tourId,
      status: "active",
      deleted: false
    });

    if(tourInfo) {
      item.avatar = tourInfo.avatar;
      item.name = tourInfo.name;
      item.slug = tourInfo.slug;
      item.departureDateFormat = moment(tourInfo.departureDate).format("DD/MM/YYYY");
      item.priceNewAdult = tourInfo.priceNewAdult;
      item.priceNewChildren = tourInfo.priceNewChildren;
      item.priceNewBaby = tourInfo.priceNewBaby;

      // Tính stock còn lại: trừ đi số lượng của các item khác cùng tourId
      const otherItems = cart.filter(
        c => c.tourId == item.tourId && c.locationFrom != item.locationFrom
      );
      let usedAdult = 0, usedChildren = 0, usedBaby = 0;
      for (const other of otherItems) {
        usedAdult += parseInt(other.quantityAdult) || 0;
        usedChildren += parseInt(other.quantityChildren) || 0;
        usedBaby += parseInt(other.quantityBaby) || 0;
      }
      item.stockAdult = tourInfo.stockAdult - usedAdult;
      item.stockChildren = tourInfo.stockChildren - usedChildren;
      item.stockBaby = tourInfo.stockBaby - usedBaby;
      
      if(item.locationFrom)
      {
const city = await City.findOne({
        _id: item.locationFrom
      });
      item.locationFromName = city.name;
      }
      else{
        item.locationFromName = "";
      }
    } else {
      // Nếu không lấy được tour thì xóa tour khỏi giỏ hàng
      const indexItem = cart.findIndex(tour => tour.tourId == item.tourId);
      cart.splice(indexItem, 1);
    }
  }
    



        res.json({
            code:"success",
            cart:cart
        })
}