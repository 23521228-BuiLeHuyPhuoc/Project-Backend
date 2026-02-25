const Category=require('../../models/category.model');
const CategoryTreeHelper=require('../../helpers/category.helper');
module.exports.list=(req,res)=>{
    res.render("admin/pages/category-list",{
        pageTitle:"Quản lý danh mục"
    })
}
module.exports.create=async (req,res)=>{
    const categoryList=await Category.find({
        deleted:false
    })
    console.log(CategoryTreeHelper.buildCategoryTree(categoryList));
    res.render("admin/pages/category-create",{
        pageTitle:"Tạo mới danh mục",
        categoryList:CategoryTreeHelper.buildCategoryTree(categoryList)
    })
}
module.exports.createPost=async(req,res)=>{
    if(req.body.position)
    {
        req.body.position=parseInt(req.body.position);
    }
    else{
    const totalRecord=await Category.countDocuments({    
    })
    req.body.position=totalRecord+1;

    }
    req.body.createdBy=req.account.id;
    req.body.updatedBy=req.account.id;
    if(req.file)
    {
    req.body.avatar=req.file.path;
    }
    else{
        req.body.avatar="";
    }
    console.log(req.file);
     const newRecord=new Category(req.body);
     await newRecord.save();
    req.flash("success","Tạo mới danh mục thành công");
    console.log(req.body);
    res.json({
        code:"success"
    })

}