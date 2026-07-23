const Contact=require("../../models/contact.model");
const SettingWebsiteInfo=require("../../models/setting-website-info.model");
const mailHelper=require("../../helpers/mail.helper");
const {topics,topicLabels}=require("../../config/contact");

const escapeHtml=value=>String(value || "")
  .replace(/&/g,"&amp;")
  .replace(/</g,"&lt;")
  .replace(/>/g,"&gt;")
  .replace(/"/g,"&quot;")
  .replace(/'/g,"&#039;");

const notifyAdmin=async(req,contact)=>{
  const websiteInfo=await SettingWebsiteInfo.findOne().lean();
  const adminEmail=process.env.ADMIN_EMAIL || websiteInfo?.email || process.env.EMAIL_USERNAME;
  if(!adminEmail || !process.env.EMAIL_USERNAME || !process.env.EMAIL_PASSWORD){
    return;
  }

  const baseUrl=(process.env.BASE_URL || process.env.NGROK || `${req.protocol}://${req.get("host")}`).replace(/\/$/,"");
  const detailUrl=`${baseUrl}/${global.pathAdmin}/contact/detail/${contact.id}`;
  const subjectLabel=topicLabels[contact.subject] || "Liên hệ khác";
  const content=`
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#25282b;max-width:640px">
      <h2 style="margin:0 0 16px">Có liên hệ mới từ website</h2>
      <p><strong>Người gửi:</strong> ${escapeHtml(contact.fullName)}</p>
      <p><strong>Email:</strong> ${escapeHtml(contact.email)}</p>
      <p><strong>Số điện thoại:</strong> ${escapeHtml(contact.phone || "Không cung cấp")}</p>
      <p><strong>Nội dung cần hỗ trợ:</strong> ${escapeHtml(subjectLabel)}</p>
      <p><strong>Lời nhắn:</strong></p>
      <div style="white-space:pre-wrap;background:#f5f5f5;padding:14px 16px;border-left:3px solid #4502c7">${escapeHtml(contact.message)}</div>
      <p style="margin-top:22px"><a href="${escapeHtml(detailUrl)}">Mở liên hệ trong trang quản trị</a></p>
    </div>
  `;
  const result=await mailHelper.sendMail(adminEmail,`[Liên hệ mới] ${subjectLabel}`,content);
  if(result.success){
    await Contact.updateOne({_id:contact._id},{adminNotificationSentAt:new Date()});
  }
};

module.exports.index=(req,res)=>{
  res.render("client/pages/contact",{
    pageTitle:"Liên hệ",
    topics,
    contactUser:req.user || null
  });
};

module.exports.subscribe=async(req,res)=>{
  const email=String(req.body.email || "").trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>150){
    return res.status(400).json({
      code:"error",
      message:"Email không đúng định dạng!"
    });
  }

  const existRecord=await Contact.exists({
    email,
    deleted:false,
    $or:[
      {type:"newsletter"},
      {type:{$exists:false},message:{$exists:false}}
    ]
  });
  if(existRecord){
    return res.json({
      code:"error",
      message:"Email đã được đăng ký trước đó!"
    });
  }

  await Contact.create({email,type:"newsletter"});
  req.flash("success","Cảm ơn bạn đã đăng ký nhận thông tin từ chúng tôi!");
  res.json({code:"success"});
};

module.exports.createMessage=async(req,res)=>{
  // Honeypot submissions are acknowledged without storing spam.
  if(req.body.website){
    return res.json({
      code:"success",
      message:"Cảm ơn bạn. Chúng tôi đã nhận được lời nhắn!"
    });
  }

  const duplicate=await Contact.findOne({
    type:"message",
    email:req.body.email,
    message:req.body.message,
    deleted:false,
    createdAt:{$gte:new Date(Date.now()-2*60*1000)}
  }).select("_id").lean();
  if(duplicate){
    return res.json({
      code:"success",
      message:"Lời nhắn của bạn đã được ghi nhận. Chúng tôi sẽ phản hồi sớm nhất có thể!"
    });
  }

  const contact=await Contact.create({
    type:"message",
    userId:req.user?._id || null,
    fullName:req.body.fullName,
    email:req.body.email,
    phone:req.body.phone,
    subject:req.body.subject,
    message:req.body.message,
    status:"unread"
  });

  await notifyAdmin(req,contact).catch(error=>{
    console.error(`Không thể gửi email thông báo liên hệ: ${error.message}`);
  });

  res.status(201).json({
    code:"success",
    message:"Cảm ơn bạn đã liên hệ. Chúng tôi sẽ phản hồi trong thời gian sớm nhất!"
  });
};
