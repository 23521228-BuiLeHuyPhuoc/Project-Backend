const Tour = require("../../models/tour.model");
const CategoryHelper=require("../../helpers/category.helper");
const Category=require("../../models/category.model");
const City=require("../../models/city.model");
const moment=require("moment");
const Favorite=require('../../models/favorite.model');
const Review=require('../../models/review.model');
module.exports.detail= async(req,res)=>{
  const slug=req.params.slug;
  const tour=await Tour.findOne({
    slug:slug,
    status:"active",
    deleted:false
  })
  if(tour)
  {
    const category= await Category.find({
      deleted:false,
      status:"active"
    })
    let CategoryTree=[];
    if(tour.category){
      CategoryTree=await CategoryHelper.CategoriesParentToRoot(category,tour.category.toString());
    }
    const breadcrumb = {
            image: tour.avatar,
            title: tour.name,
            list: [
                {
                    link: "/",
                    title: "Trang Chủ"
                }
                
            ]
        };
    for(const item of CategoryTree){
      breadcrumb.list.push({
        link:"/category/"+item.slug,
        title:item.name
      })
    }
    breadcrumb.list.push({
        link:"/tour/detail/"+tour.slug,
        title:tour.name
    })
    if(tour.departureDate){
      tour.departureFormatDate=moment(tour.departureDate).format("DD/MM/YYYY");
    }
    const city=await City.find({});
    const reviews=await Review.find({
      tourId:tour.id,
      status:'published',
      deleted:false
    })
      .populate('userId','fullName avatar')
      .sort({createdAt:-1})
      .lean();
    const ratingAverage=reviews.length
      ? reviews.reduce((sum,review)=>sum+review.rating,0)/reviews.length
      : 0;
    const isFavorite=req.user
      ? Boolean(await Favorite.exists({userId:req.user.id,tourId:tour.id}))
      : false;
    res.render("client/pages/tour-detail",{
    pageTitle:"Chi tiết tour",
    breadcrumb:breadcrumb,
    tour:tour,
    city:city,
    reviews:reviews.map(review=>({
      ...review,
      createdAtLabel:moment(review.createdAt).format('DD/MM/YYYY')
    })),
    ratingAverage,
    isFavorite
  })
  }
  else{
    res.redirect("/");
  }
  
}
