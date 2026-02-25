const Category=require('../../models/category.model');
const AccountAdmin=require('../../models/account-admin.model');
const CategoryTreeHelper=require('../../helpers/category.helper');
const moment=require('moment');
module.exports.list=async (req,res)=>{
    const categoryList=await Category.find({
        deleted:false
    }).sort({
        position: "asc"
    })
    for (const item of categoryList) {
        if(item.createdBy){
            const accountCreated=await AccountAdmin.findOne({
                _id:item.createdBy
            })
            item.createdByFullName=accountCreated.fullName;
        }
        if(item.updatedBy){
            const accountUpdated=await AccountAdmin.findOne({
                _id:item.updatedBy
            })
            item.updatedByFullName=accountUpdated.fullName;
        }
    item.createdAtFormat=moment(item.createdAt).format("HH:mm - DD/MM/YYYY");
    item.updatedAtFormat=moment(item.updatedAt).format("HH:mm - DD/MM/YYYY");
    }
    

    res.render("admin/pages/category-list",{
        categoryList:categoryList,
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