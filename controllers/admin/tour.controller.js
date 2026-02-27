const categoryHelper=require("../../helpers/category.helper");
const categoryModel=require("../../models/category.model");
const cityModel=require("../../models/city.model");
const Tour=require("../../models/tour.model");
const moment=require("moment");
module.exports.list=(req,res)=>{
    res.render("admin/pages/tour-list",{
        pageTitle:"Quản lý tour"
    })
}
module.exports.create=async(req,res)=>{
    const categoryList= await categoryModel.find({
        deleted:false
    })
    const cityList=await cityModel.find({});
    res.render("admin/pages/tour-create",{
        categoryList:categoryHelper.buildCategoryTree(categoryList),
        pageTitle:"Tạo mới tour",
        cityList:cityList
    })
}
module.exports.trash=(req,res)=>{
    res.render("admin/pages/tour-trash",{
        pageTitle:"Thùng rác tour"
    })
}
module.exports.createPost=async(req,res)=>{
    try{
    if(req.body.position)
    {
        req.body.position=parseInt(req.body.position);
    }
    else{
        const totalRecord=await Tour.countDocuments({});
        req.body.position=totalRecord+1;
    }
    req.body.createdBy=req.account.id;
    req.body.updatedBy=req.account.id;
    req.body.avatar=req.file?req.file.path:"";
    req.body.priceAdult=req.body.priceAdult?parseInt(req.body.priceAdult):0;
    req.body.priceChildren=req.body.priceChildren?parseInt(req.body.priceChildren):0;
    req.body.priceBaby=req.body.priceBaby?parseInt(req.body.priceBaby):0;
    req.body.priceNewAdult=req.body.priceNewAdult?parseInt(req.body.priceNewAdult):req.body.priceAdult;
    req.body.priceNewChildren=req.body.priceNewChildren?parseInt(req.body.priceNewChildren):req.body.priceChildren;
    req.body.priceNewBaby=req.body.priceNewBaby?parseInt(req.body.priceNewBaby):req.body.priceBaby;
    req.body.stockAdult=req.body.stockAdult?parseInt(req.body.stockAdult):0;
    req.body.stockChildren=req.body.stockChildren?parseInt(req.body.stockChildren):0;
    req.body.stockBaby=req.body.stockBaby?parseInt(req.body.stockBaby):0;
    
    req.body.locations = req.body.locations?JSON.parse(req.body.locations):[];
    req.body.schedules = req.body.schedules?JSON.parse(req.body.schedules):[];
    req.body.departureDate=req.body.departureDate?moment(req.body.departureDate).toDate():null;
    const newRecord=new Tour(req.body);
    await newRecord.save();    
    req.flash("success","Tạo mới tour thành công");
    res.json({
        code:"success"
    })
}
catch(error)
{
    res.json({
        code:"error",
        message:error.message
    })
}
}