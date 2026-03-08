const moment=require('moment');
const Contact=require('../../models/contact.model');
module.exports.list=async(req,res)=>{
    const contactList=await Contact.find({
        deleted:false
    })
    for(let i of contactList)
    {
    i.createdFormatAt=moment(i.createdAt).format('HH:mm DD/MM/YYYY');
    }
    res.render("admin/pages/contact-list",{
        contactList:contactList,
        pageTitle:"Danh sách liên hệ"
    })
}