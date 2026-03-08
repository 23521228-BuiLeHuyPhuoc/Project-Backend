const Contact=require('../../models/contact.model');
module.exports.sendMail=async(req,res)=>{
  const {email}=req.body;
  const existRecord=await Contact.findOne({
    email:email,
    deleted:false
  })
  if(existRecord){
    return res.json({
      code:"error",
      message:"Email đã tồn tại!"
    })
  }
  console.log(req.body.email);
  const contact=new Contact({
    email:req.body.email,
    deleted:false
  });
    await contact.save();
  req.flash('success', 'Cảm ơn bạn đã đăng ký nhận thông tin từ chúng tôi!');
  res.json({
    code:"success",
  })
}