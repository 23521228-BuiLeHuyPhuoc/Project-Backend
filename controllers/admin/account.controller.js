module.exports.login=(req,res)=>{
    res.render("admin/pages/login.pug",{
        pageTitle:"Đăng nhập"
    })
}
module.exports.register=(req,res)=>{
    res.render("admin/pages/register.pug",{
        pageTitle:"Đăng ký"
    })
}
module.exports.forgotPassword=(req,res)=>{
    res.render("admin/pages/forgot-password.pug",{
        pageTitle:"Quên mật khẩu"
    })
}