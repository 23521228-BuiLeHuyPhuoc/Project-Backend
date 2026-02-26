const Category=require('../../models/category.model');
const AccountAdmin=require('../../models/account-admin.model');
const CategoryTreeHelper=require('../../helpers/category.helper');
const moment=require('moment');
module.exports.list=async (req,res)=>{
    
    let find={
        deleted:false,
    }
    if(req.query.status){
        find.status=req.query.status;
    }
    if(req.query.creator)
    {
        find.createdBy=req.query.creator;
    }
    const dateFilter={};
    if(req.query.startDate)
    {
    const startDate=moment(req.query.startDate).startOf("date").toDate();
    dateFilter.$gte=startDate;
    }
    if(req.query.endDate)
    {
        const endDate=moment(req.query.endDate).endOf("date").toDate();
        dateFilter.$lte=endDate;

    }
    if(Object.keys(dateFilter).length>0)
    {
        find.createdAt=dateFilter;
    }
    const categoryList=await Category.find(find).sort({
        position: "asc"
    })
    const creator=await AccountAdmin.find({

    }).select("id fullName");
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
        creator:creator,
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
module.exports.edit=async(req,res)=>{
    try{
    const categoryList=await Category.find({
        deleted:false
    })
    const id=req.params.id;
    const category=await Category.findOne({
        _id:id,
        deleted:false
    })
    console.log(CategoryTreeHelper.buildCategoryTree(categoryList));
    res.render("admin/pages/category-edit",{
        pageTitle:"Chỉnh sửa danh mục",
        category:category,
        categoryList:CategoryTreeHelper.buildCategoryTree(categoryList)
    })
}
catch(error){
    res.render("admin/pages/error-404",{
        pageTitle:"Không tìm thấy trang"
    })
}
}
module.exports.editPatch=async(req,res)=>{
    try{ 
    const id=req.params.id;
    
    const category=await Category.findOne({
        _id:id,
        deleted:false
    })
    let avt=category.avatar;
    if(req.file){
        avt=req.file.path;
    }
    if(category){
       await Category.updateOne(category,{
            name:req.body.name,
            parent:req.body.parent,
            position:parseInt(req.body.position),
            status:req.body.status,
            description:req.body.description,
            updatedBy:req.account.id,
            avatar:avt
        })
    }

    req.flash("success","Cập nhật danh mục thành công!");
    res.json({
        code:"success"
    })
}
catch(error){
    res.json({
        code:"error",
        message:"Có lỗi xảy ra khi cập nhật danh mục!"
    })
}
}
module.exports.deletePatch=async(req,res)=>{
    try{
    const id=req.params.id;
    const category=await Category.findOne({
        _id:id,
        deleted:false
    })
    if(category){
        await Category.updateOne(category,{
            deleted:true,
            deletedBy:req.account.id,
            deletedAt:Date.now()
        })
        req.flash("success","Xóa danh mục thành công!");
        res.json({
            code:"success"
        })
    }
    }
    catch(error){
        res.json({
            code:"error",
            message:"Có lỗi xảy ra khi xóa danh mục!"
        })
    }
}
module.exports.changeStatusPatch=async(req,res)=>{
    try{ 
    const status=req.body.status;
    const idList=req.body.updateList;
    if(status=="active" || status=="inactive"){
        await Category.updateMany({
            _id:{$in:idList}
        },{
            status:status,
            updatedBy:req.account._id,
            updatedAt:Date.now()
        })
        req.flash("success",`Cập nhật trạng thái thành công!`);
        res.json({
            code:"success"
        })
    }
    if(status=="delete"){
        await Category.updateMany({
            _id:{$in:idList}
        },{
            deleted:true,
            deletedBy:req.account._id,
            deletedAt:Date.now()
        })
        req.flash("success",`Xóa danh mục thành công!`);
        res.json({
            code:"success"
        })
    }
}
catch(error){
    res.json({
        code:"error",
        message:"Có lỗi xảy ra khi cập nhật trạng thái danh mục!"
    })
}
}