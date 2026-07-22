const AccountAdmin=require('../../models/account-admin.model');
const mongoose=require('mongoose');

const escapeRegex=(value)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

module.exports.list=async(req,res)=>{
    const find={
        deleted:false
    };
    const filters={
        status:req.query.status || "",
        startDate:req.query.startDate || "",
        endDate:req.query.endDate || "",
        search:(req.query.search || "").trim()
    };

    if(["initial","active","inactive"].includes(filters.status)){
        find.status=filters.status;
    }

    const createdAt={};
    const objectIdCreatedAt={};
    if(filters.startDate){
        const startDate=new Date(`${filters.startDate}T00:00:00`);
        if(!Number.isNaN(startDate.getTime())){
            createdAt.$gte=startDate;
            objectIdCreatedAt.$gte=mongoose.Types.ObjectId.createFromTime(
                Math.floor(startDate.getTime()/1000)
            );
        }
    }
    if(filters.endDate){
        const endDate=new Date(`${filters.endDate}T23:59:59.999`);
        if(!Number.isNaN(endDate.getTime())){
            createdAt.$lt=new Date(endDate.getTime()+1);
            objectIdCreatedAt.$lt=mongoose.Types.ObjectId.createFromTime(
                Math.floor((endDate.getTime()+1)/1000)
            );
        }
    }
    if(Object.keys(createdAt).length>0){
        find.$and=[{
            $or:[
                {createdAt},
                {createdAt:{$exists:false},_id:objectIdCreatedAt}
            ]
        }];
    }

    if(filters.search){
        const regex=new RegExp(escapeRegex(filters.search),"i");
        find.$or=[
            {fullName:regex},
            {email:regex},
            {phone:regex},
            {address:regex}
        ];
    }

    const limitItem=9;
    const requestedPage=Number.parseInt(req.query.page,10);
    let currentPage=Number.isInteger(requestedPage) && requestedPage>0 ? requestedPage : 1;
    const totalRecord=await AccountAdmin.countDocuments(find);
    const totalPage=Math.ceil(totalRecord/limitItem);

    if(totalPage>0 && currentPage>totalPage){
        currentPage=totalPage;
    }

    const skip=(currentPage-1)*limitItem;
    const userList=await AccountAdmin.find(find)
        .select("-password")
        .sort({createdAt:-1,_id:-1})
        .skip(skip)
        .limit(limitItem);

    const pagination={
        currentPage,
        limitItem,
        totalPage,
        totalRecord,
        start:totalRecord===0 ? 0 : skip+1,
        end:Math.min(skip+limitItem,totalRecord)
    };

    res.render("admin/pages/user-list",{
        pageTitle:"Danh sách người dùng",
        userList,
        filters,
        pagination
    });
}

module.exports.editPage=async(req,res)=>{
    try{
        const user=await AccountAdmin.findOne({
            _id:req.params.id,
            deleted:false
        }).select("-password");

        if(!user){
            return res.status(404).render("admin/pages/error-404",{
                pageTitle:"Không tìm thấy người dùng"
            });
        }

        res.render("admin/pages/user-edit",{
            pageTitle:"Sửa người dùng",
            user
        });
    }
    catch(error){
        res.status(404).render("admin/pages/error-404",{
            pageTitle:"Không tìm thấy người dùng"
        });
    }
}

module.exports.edit=async(req,res)=>{
    try{
        const allowedFields=["fullName","email","phone","address","status"];
        const updateData={};

        allowedFields.forEach(field=>{
            if(Object.prototype.hasOwnProperty.call(req.body,field)){
                updateData[field]=typeof req.body[field]==="string"
                    ? req.body[field].trim()
                    : req.body[field];
            }
        });

        if(updateData.fullName!==undefined && !updateData.fullName){
            return res.status(400).json({
                code:"error",
                message:"Vui lòng nhập họ tên!"
            });
        }

        if(updateData.email!==undefined){
            updateData.email=updateData.email.toLowerCase();
            if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updateData.email)){
                return res.status(400).json({
                    code:"error",
                    message:"Email không đúng định dạng!"
                });
            }

            const existingEmail=await AccountAdmin.findOne({
                _id:{$ne:req.params.id},
                email:updateData.email,
                deleted:false
            });
            if(existingEmail){
                return res.status(409).json({
                    code:"error",
                    message:"Email đã tồn tại trong hệ thống!"
                });
            }
        }

        if(updateData.status!==undefined && !["initial","active","inactive"].includes(updateData.status)){
            return res.status(400).json({
                code:"error",
                message:"Trạng thái không hợp lệ!"
            });
        }

        updateData.updatedBy=req.account.id;
        updateData.updatedAt=new Date();

        const result=await AccountAdmin.findOneAndUpdate({
            _id:req.params.id,
            deleted:false
        },updateData,{new:true,runValidators:true});

        if(!result){
            return res.status(404).json({
                code:"error",
                message:"Không tìm thấy người dùng!"
            });
        }

        req.flash("success","Cập nhật người dùng thành công!");
        res.json({code:"success"});
    }
    catch(error){
        res.status(400).json({
            code:"error",
            message:"Không thể cập nhật người dùng!"
        });
    }
}

module.exports.deletePatch=async(req,res)=>{
    try{
        if(req.account.id===req.params.id){
            return res.status(400).json({
                code:"error",
                message:"Bạn không thể xóa tài khoản đang đăng nhập!"
            });
        }

        const result=await AccountAdmin.findOneAndUpdate({
            _id:req.params.id,
            deleted:false
        },{
            deleted:true,
            deletedBy:req.account.id,
            deletedAt:new Date()
        });

        if(!result){
            return res.status(404).json({
                code:"error",
                message:"Không tìm thấy người dùng!"
            });
        }

        req.flash("success","Xóa người dùng thành công!");
        res.json({code:"success"});
    }
    catch(error){
        res.status(400).json({
            code:"error",
            message:"Không thể xóa người dùng!"
        });
    }
}

module.exports.changeStatusPatch=async(req,res)=>{
    try{
        const {status,idList}=req.body;
        const allowedActions=["active","inactive","delete"];

        if(!allowedActions.includes(status)){
            return res.status(400).json({
                code:"error",
                message:"Vui lòng chọn hành động hợp lệ!"
            });
        }

        if(!Array.isArray(idList) || idList.length===0){
            return res.status(400).json({
                code:"error",
                message:"Vui lòng chọn ít nhất một người dùng!"
            });
        }

        const uniqueIds=[...new Set(idList.map(id=>String(id)))];
        if(["inactive","delete"].includes(status) && uniqueIds.includes(req.account.id)){
            return res.status(400).json({
                code:"error",
                message:"Không thể dừng hoạt động hoặc xóa tài khoản đang đăng nhập!"
            });
        }

        const find={
            _id:{$in:uniqueIds},
            deleted:false
        };

        if(status==="delete"){
            await AccountAdmin.updateMany(find,{
                deleted:true,
                deletedBy:req.account.id,
                deletedAt:new Date()
            });
            req.flash("success","Xóa người dùng đã chọn thành công!");
        }
        else{
            await AccountAdmin.updateMany(find,{
                status,
                updatedBy:req.account.id,
                updatedAt:new Date()
            });
            req.flash("success","Cập nhật trạng thái người dùng thành công!");
        }

        res.json({code:"success"});
    }
    catch(error){
        res.status(400).json({
            code:"error",
            message:"Không thể cập nhật các người dùng đã chọn!"
        });
    }
}
