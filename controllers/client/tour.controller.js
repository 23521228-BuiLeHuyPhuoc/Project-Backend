const Tour = require("../../models/tour.model");
const CategoryHelper=require("../../helpers/category.helper");
const Category=require("../../models/category.model");
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
    const CategoryTree=await CategoryHelper.CategoriesParentToRoot(category,tour.category.toString());
    console.log(CategoryTree);
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
    res.render("client/pages/tour-detail",{
    pageTitle:"Chi tiết tour",
    breadcrumb:breadcrumb,
    tour:tour
  })
  }
  else{
    res.redirect("/");
  }
  
}