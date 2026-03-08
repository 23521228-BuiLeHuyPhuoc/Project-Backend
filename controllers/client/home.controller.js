const Tour=require('../../models/tour.model');
const moment=require('moment');
const FamilyHelper=require('../../helpers/category.helper');
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
    const categoryIdSection4='699c86067056d48790a13a8d';
    const categoryHelperFamily= await FamilyHelper.CategoriesFamily(categoryIdSection4);
    const tourListSection4=await Tour.find({
      category:{$in:categoryHelperFamily},
      deleted:false, 
      status:"active"
    }).sort({
      position:"desc"
    }).limit(8)
    const categoryIdSection6='699d3e3d8c2cef9115a84fe1';
    const categoryHelperFamilySection6= await FamilyHelper.CategoriesFamily(categoryIdSection6);
    const tourListSection6=await Tour.find({
      category:{$in:categoryHelperFamilySection6},
      deleted:false,
      status:"active"
    }).sort({
      position:"desc"
    }).limit(8)
  res.render('client/pages/home',{
    pageTitle:"Trang chủ",
    tourListSection2:tourList,
    tourListSection4:tourListSection4,
    tourListSection6:tourListSection6
  })
}
