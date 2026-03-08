const Tour = require("../../models/tour.model");


module.exports.detail= async(req,res)=>{
  res.render("client/pages/tour-detail",{
    pageTitle:"Chi tiết tour"
  })
}