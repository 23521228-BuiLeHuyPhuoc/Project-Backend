module.exports.list=(req,res)=>{
    res.render("admin/pages/order-list",{
        pageTitle:"Danh sách đơn hàng"
    })
}
module.exports.edit=(req,res)=>{
    res.render("admin/pages/order-edit",{
        pageTitle:"Chỉnh sửa đơn hàng"
    })
}