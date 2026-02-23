const Category=require('../../models/category.model');
module.exports.list=(req,res)=>{
    res.render("admin/pages/category-list",{
        pageTitle:"Quản lý danh mục"
    })
}
module.exports.create=(req,res)=>{
    res.render("admin/pages/category-create",{
        pageTitle:"Tạo mới danh mục"
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
    const newRecord=new Category(req.body);
    await newRecord.save();

    console.log(req.body);
    res.json({
        code:"success",
        message:"Tạo mới danh mục thành công"
    })

}