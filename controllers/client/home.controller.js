const Tour=require('../../models/tour.model');
const Category=require('../../models/category.model');
const moment=require('moment');
const slugify=require('slugify');
const FamilyHelper=require('../../helpers/category.helper');
const newsList=require('../../data/news.data');
const {getPromotionBanners}=require('../../data/promotion-vouchers.data');

const getDestinationLabel=name=>{
  const text=String(name || '').trim();
  const firstStop=text.split(/\s+-\s+/)[0].trim() || text;
  return firstStop.replace(/^(?:tour|khám phá|chinh phục)\s+/iu,'').trim()
    || firstStop;
};

const buildHotDestinations=tours=>{
  const destinations=[];
  const seen=new Set();
  for(const tour of tours){
    const name=getDestinationLabel(tour.name);
    const key=slugify(name,{lower:true,strict:true,locale:'vi'});
    if(!name || !key || seen.has(key)){
      continue;
    }
    seen.add(key);
    destinations.push({
      name,
      searchValue:name,
      link:tour.slug
        ? `/tour/detail/${tour.slug}`
        : `/search?locationTo=${encodeURIComponent(name)}`,
      avatar:tour.avatar || '/assets/images/product-1.jpg',
      ratingAvg:Number(tour.ratingAvg || 0),
      ratingCount:Number(tour.ratingCount || 0)
    });
    if(destinations.length===4){
      break;
    }
  }
  return destinations;
};

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
      if(item.priceNewAdult&&item.priceAdult&&item.priceNewAdult<item.priceAdult)
      {
        item.discount=Number(((item.priceAdult-item.priceNewAdult)/item.priceAdult*100).toFixed(2));
      }
      else{
        item.discount=0;
      }
    }
    const categoryIdSection4='699c86067056d48790a13a8d';
    const categorySection4=await Category.findOne({
      _id:categoryIdSection4,
      deleted:false,
      status:'active'
    }).select('slug').lean();
    const categoryHelperFamily= await FamilyHelper.CategoriesFamily(categoryIdSection4);
    const tourListSection4=await Tour.find({
      category:{$in:categoryHelperFamily},
      deleted:false, 
      status:"active"
    }).sort({
      position:"desc"
    }).limit(8)
    const categoryIdSection6='699d3e3d8c2cef9115a84fe1';
    const categorySection6=await Category.findOne({
      _id:categoryIdSection6,
      deleted:false,
      status:'active'
    }).select('slug').lean();
    const categoryHelperFamilySection6= await FamilyHelper.CategoriesFamily(categoryIdSection6);
    const tourListSection6=await Tour.find({
      category:{$in:categoryHelperFamilySection6},
      deleted:false,
      status:"active"
    }).sort({
      position:"desc"
    }).limit(8)
    const hotDestinationTours=await Tour.find({
      deleted:false,
      status:'active',
      stockAdult:{$gt:0},
      $or:[
        {departureDate:null},
        {departureDate:{$gte:moment().startOf('day').toDate()}}
      ]
    })
      .select('name slug avatar ratingAvg ratingCount')
      .sort({ratingAvg:-1,ratingCount:-1,position:-1,_id:1})
      .limit(30)
      .lean();
    const hotDestinations=buildHotDestinations(hotDestinationTours);
  res.render('client/pages/home',{
    pageTitle:"Trang chủ",
    tourListSection2:tourList,
    tourListSection4:tourListSection4,
    tourListSection6:tourListSection6,
    section4CategoryUrl:categorySection4
      ? `/category/${categorySection4.slug}`
      : '#',
    section6CategoryUrl:categorySection6
      ? `/category/${categorySection6.slug}`
      : '#',
    promotionBanners:getPromotionBanners(),
    hotDestinations,
    newsList:newsList
  })
}
