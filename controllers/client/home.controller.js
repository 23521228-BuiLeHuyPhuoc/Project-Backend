const Tour=require('../../models/tour.model');
const moment=require('moment');
module.exports.home=async(req, res) => {
  const tourList=await Tour.find({
          deleted:false, 
          status:"active"
      }).sort({
          position:"desc"
      })
      .limit(6)
    for(const item of tourList)
    {
      if(item.departureDate)
      {
        item.departureFormatDate=moment(item.departureDate).format("DD/MM/YYYY");
      }
      if(item.priceNewAdult&&item.priceAdult)
      {
        item.discount=parseInt((item.priceNewAdult-item.priceAdult)/item.priceAdult) *100;
      }
      else{
        item.discount=0;
      }
    }
  res.render('client/pages/home',{
    pageTitle:"Trang chủ",
    tourListSection2:tourList
  })
}