const categoryHelper=require("../../helpers/category.helper");
const categoryModel=require("../../models/category.model");
const cityModel=require("../../models/city.model");
const Tour=require("../../models/tour.model");
const moment=require("moment");
const slugify=require("slugify");
const AccountAdmin=require("../../models/account-admin.model");
module.exports.list=async(req,res)=>{
    const findObject={
        deleted:false
    }
    const statusFilter=req.query.status;
    if(statusFilter=="active"){
        findObject.status="active";
    }
    else if(statusFilter=="inactive"){
        findObject.status="inactive";
    }
    const creatorFilter=req.query.creator;
    if(creatorFilter){
        findObject.createdBy=creatorFilter;
    }

    const startDateFilter=req.query.startDate;
    const endDateFilter=req.query.endDate;
    const dateFilter={};
    if(startDateFilter){
        dateFilter.$gte=moment(startDateFilter,"YYYY-MM-DD").startOf("day").toDate();
    }
    if(endDateFilter){
        dateFilter.$lte=moment(endDateFilter,"YYYY-MM-DD").endOf("day").toDate();
    } 
    if(Object.keys(dateFilter).length>0){
        findObject.createdAt=dateFilter;
    }
    const categoryFilter=req.query.category?req.query.category:"";
    if(categoryFilter){
        findObject.category=categoryFilter;
    }
    const priceFilter=req.query.price?req.query.price:"";
    if(priceFilter){
        const priceRange=priceFilter.split("-");
        if(priceRange.length==2){
            const lower=parseInt(priceRange[0]);
            const upper=parseInt(priceRange[1]);
            findObject.priceNewAdult={$gte:lower,$lte:upper};
            findObject.priceNewChildren={$gte:lower,$lte:upper};
            findObject.priceNewBaby={$gte:lower,$lte:upper};
        }
    }
    const itemperPage=3;
    let currentPage=1;
    if(req.query.page){
        currentPage=parseInt(req.query.page);
        if(currentPage<1){
            currentPage=1;
        }
    }
    const totalRecord=await Tour.countDocuments({
        deleted:false
    });
    if(req.query.search){
        const keyword=slugify(req.query.search,{
            lower:true,
            replacement:"-",
            trim:true
        })
        const regex=new RegExp(keyword,"i");
        findObject.name=regex;
    }

    const totalPage=Math.ceil(totalRecord/itemperPage);
    const skipPage=(currentPage-1)*itemperPage;
    const tourList= await Tour.find(findObject).sort({
        position:"asc"
    }).limit(itemperPage).skip(skipPage);
    
    const creator=await AccountAdmin.find({});
    for(const tour of tourList){
        tour.createdtime=moment(tour.createdAt).format("HH:mm - DD/MM/YYYY");
        tour.updatedtime=moment(tour.updatedAt).format("HH:mm - DD/MM/YYYY");
        if(tour.createdBy){
            const createdUser=await AccountAdmin.findOne({
                _id:tour.createdBy
            })
            tour.createdUser=createdUser.fullName;
        }
        if(tour.updatedBy){
            const updatedUser=await AccountAdmin.findOne({
                _id:tour.updatedBy
            })
            tour.updatedUser=updatedUser.fullName;
        }
    }
    const categoryList=await categoryModel.find({
        deleted:false
    })
    res.render("admin/pages/tour-list",{
        pageTitle:"Quản lý tour",
        tourList:tourList,
        creator:creator,
        totalRecord:totalRecord,
        totalPage:totalPage,
        currentPage:currentPage,
        itemperPage:itemperPage,
        categoryList:categoryHelper.buildCategoryTree(categoryList)
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
module.exports.trash= async(req,res)=>{
    const findObject={
        deleted:true
    }
    if(req.query.search){
        const keyword=slugify(req.query.search,{
            lower:true,
            replacement:"-",
            trim:true
        })
        const regex=new RegExp(keyword,"i");
    findObject.name=regex;
    }
    let currentPage=1;
    if(req.query.page){
        currentPage=parseInt(req.query.page);
        if(currentPage<1){
            currentPage=1;
        }
    }
    const itemperPage=3;
    const totalRecord=await Tour.countDocuments({
        deleted:true
    });
    const totalPage=Math.ceil(totalRecord/itemperPage);
    const skipPage=(currentPage-1)*itemperPage;
    const trashList=await Tour.find(findObject).sort({
        position:"asc"
    }).limit(itemperPage).skip(skipPage);
    for(tour of trashList){
        const accountCreated=await AccountAdmin.findOne({
            _id:tour.createdBy
        })
        tour.createdByFullName=accountCreated.fullName;
        const accountDeleted=await AccountAdmin.findOne({
            _id:tour.deletedBy
        })
        tour.deletedByFullName=accountDeleted.fullName;
        tour.deletedAtFormat=moment(tour.deletedAt).format("HH:mm - DD/MM/YYYY");
        tour.createdAtFormat=moment(tour.createdAt).format("HH:mm - DD/MM/YYYY");
    }

    res.render("admin/pages/tour-trash",{
        pageTitle:"Thùng rác tour",
        currentPage:currentPage,
        totalPage:totalPage,
        itemperPage:itemperPage,
        totalRecord:totalRecord,
        trashList:trashList
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
module.exports.edit=async(req,res)=>{
    const tour=await Tour.findOne({
        _id:req.params.id,
        deleted:false
    })
    const categoryList=await categoryModel.find({
        deleted:false
    })
    const tourDepartureDate=tour.departureDate?moment(tour.departureDate).format("YYYY-MM-DD"):"";
    const cityList=await cityModel.find({})
    res.render("admin/pages/tour-edit",{
        pageTitle:"Chỉnh sửa tour",
        tour:tour,
        tourDepartureDate:tourDepartureDate,
        categoryList:categoryHelper.buildCategoryTree(categoryList),
        cityList:cityList
    })
}
module.exports.trashPatch=async(req,res)=>{
    try{
    const id=req.params.id;
    const tour=await Tour.findOne({
        _id:id
    })
    if(tour)
    {
        await Tour.updateOne({
            _id:id
        },{
            deleted:true,
            deletedBy:req.account.id,
            deletedAt:new Date()
        })
    }
    req.flash("success","Xoá tour thành công");
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
module.exports.trashUndoPatch=async(req,res)=>{
    try{
    const id=req.params.id;
    const tour=await Tour.findOne({
        _id:id,
        deleted:true
    })
    if(tour)
    {
        await Tour.updateOne({
            _id:id,
            deleted:true
        },{
            deleted:false,
            deletedBy:null,
            deletedAt:null
        })
        req.flash("success","Khôi phục tour thành công");
        res.json({
            code:"success"
        })
    }
}
catch(error)
{
    res.json({
        code:"error",
        message:error.message
    })
}
}
module.exports.editPatch=async(req,res)=>{
    try{
    const id=req.params.id;
    req.body.position=req.body.position?parseInt(req.body.position):0;
    req.body.updatedBy=req.account.id;
    req.body.updatedAt=Date.now();
    req.body.locations=req.body.locations?JSON.parse(req.body.locations):[];
    req.body.schedules=req.body.schedules?JSON.parse(req.body.schedules):[];
    req.body.departureDate=req.body.departureDate?moment(req.body.departureDate).toDate():null;
    req.body.avatar=req.file?req.file.path:delete req.body.avatar;
    req.body.priceAdult=req.body.priceAdult?parseInt(req.body.priceAdult):0;
    req.body.priceChildren=req.body.priceChildren?parseInt(req.body.priceChildren):0;
    req.body.priceBaby=req.body.priceBaby?parseInt(req.body.priceBaby):0;
    req.body.priceNewAdult=req.body.priceNewAdult?parseInt(req.body.priceNewAdult):req.body.priceAdult;
    req.body.priceNewChildren=req.body.priceNewChildren?parseInt(req.body.priceNewChildren):req.body.priceChildren;
    req.body.priceNewBaby=req.body.priceNewBaby?parseInt(req.body.priceNewBaby):req.body.priceBaby;
    req.body.stockAdult=req.body.stockAdult?parseInt(req.body.stockAdult):0;
    req.body.stockChildren=req.body.stockChildren?parseInt(req.body.stockChildren):0;
    req.body.stockBaby=req.body.stockBaby?parseInt(req.body.stockBaby):0;
    
    const tour=await Tour.findOne({
        _id:id,
        deleted:false
    })
    if(tour){
        await Tour.updateOne(tour,
            req.body
        )
        req.flash("success","Cập nhật tour thành công");
        res.json({
            code:"success"
        })
    }
    else{
        res.json({
            code:"error",
            message:"Không tìm thấy tour!"
        })
    }
}
catch(error){
    res.json({
        code:"error",
        message:error.message
    })
}
}
module.exports.changeStatusPatch=async(req,res)=>{
    const status=req.body.status;
    const idList=req.body.idList;
    const changeList=await Tour.find({
        _id:{$in:idList},
        deleted:false
    });
    if(status=="active"||status=="inactive"){
        await Tour.updateMany(
            {_id:{$in:idList},deleted:false},
            {status:status,updatedBy:req.account.id,updatedAt:Date.now()}
        )
    }
    req.flash("success","Cập nhật trạng thái tour thành công");
    res.json({
        code:"success"
    })
}
module.exports.changeStatusTrashPatch=async(req,res)=>{
    const status=req.body.status;
    const idList=req.body.idList;
    const changeList={
        _id:{$in:idList},
        deleted:true
    };
    if(status=="undo"){
        await Tour.updateMany(
            changeList,{
                deleted:false
            } )
    }
    if(status=="delete"){
        await Tour.deleteMany(changeList)
    }
    req.flash("success","Cập nhật/Xoá trạng thái tour thành công");
    res.json({
        code:"success"
    })

}