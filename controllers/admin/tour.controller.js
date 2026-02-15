module.exports.list=(req,res)=>{
    res.render("admin/pages/tour-list",{
        pageTitle:"Quản lý tour"
    })
}
module.exports.create=(req,res)=>{
    res.render("admin/pages/tour-create",{
        pageTitle:"Tạo mới tour"
    })
}
module.exports.trash=(req,res)=>{
    res.render("admin/pages/tour-trash",{
        pageTitle:"Thùng rác tour"
    })
}