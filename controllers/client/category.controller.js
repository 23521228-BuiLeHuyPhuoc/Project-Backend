const Category=require('../../models/category.model');
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
    res.render('client/pages/tour-list.pug',{
        pageTitle:"Danh sách tour",
        breadcrumb:breadcrumb
    })
    }
    else{
      res.redirect('/');
    }
    
}