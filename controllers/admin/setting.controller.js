module.exports.list=(req,res)=>{
    res.render("admin/pages/setting-list",{
        pageTitle:"Cài đặt chung"
    })
}
module.exports.websiteInfo=(req,res)=>{
    res.render("admin/pages/setting-website-info",{
        pageTitle:"Thông tin website"
    })
}
module.exports.accountAdminList=(req,res)=>{
    res.render("admin/pages/setting-account-admin-list",{
        pageTitle:"Tài khoản quản trị"
    })
}
module.exports.accountAdminCreate=(req,res)=>{
    res.render("admin/pages/setting-account-admin-create",{
        pageTitle:"Tạo mới tài khoản quản trị"
    })
}
module.exports.roleList=(req,res)=>{
    res.render("admin/pages/setting-role-list",{
        pageTitle:"Vai trò quản trị"
    })
}
module.exports.roleCreate=(req,res)=>{
    res.render("admin/pages/setting-role-create",{
        pageTitle:"Tạo mới vai trò quản trị"
    })
}