const Category=require('../../models/category.model');
const Tour=require('../../models/tour.model');
const moment=require('moment');
const FamilyHelper=require('../../helpers/category.helper');
const City=require('../../models/city.model');
module.exports.list=async(req,res)=>{
    const slug=req.params.slug;

    const category=await Category.findOne({
      slug:slug,deleted:false,status:"active"
    })
    if(category){
      // Breadcrumb
    const breadcrumb={
            image: category.avatar,
            title: category.name,
            list: [            
            {
                link: "/",
                title: "Trang Chủ"
            }

            ]
        }
    if(category.parent){
      const Parent=await Category.findOne({
        _id:category.parent,deleted:false,status:"active"
      })
      if(Parent){
        breadcrumb.list.push({
          link: "/category/"+Parent.slug,
          title:Parent.name
        })
      }
        breadcrumb.list.push({
          link: "/category/"+category.slug,
          title:category.name
        })
    }
    else{
      breadcrumb.list.push({
        link: "/category/"+category.slug,
        title:category.name
      })
    }
    //Breadcrumb
    const categoryId=category._id;
    const categoryHelperFamily= await FamilyHelper.CategoriesFamily(categoryId);
    const tourList=await Tour.find({
      category:{$in:categoryHelperFamily},
      deleted:false, 
      status:"active"
    }).sort({
      position:"desc"
    }).limit(8)
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
    const tourTotal=await Tour.countDocuments({
      category:{$in:categoryHelperFamily},
      deleted:false, 
      status:"active"
    })
    //Lọc thành phố
    const cityList=await City.find({

    });

    res.render('client/pages/tour-list.pug',{
        pageTitle:"Danh sách tour",
        breadcrumb:breadcrumb,
        category:category,
        tourList:tourList,
        tourTotal:tourTotal,
        cityList:cityList

    })
    }
    else{
      res.redirect('/');
    }
    
}