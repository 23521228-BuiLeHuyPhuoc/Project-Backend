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