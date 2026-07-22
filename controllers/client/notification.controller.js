const moment=require('moment');
const Notification=require('../../models/notification.model');

module.exports.list=async(req,res)=>{
  const find={userId:req.user.id,deleted:false};
  if(req.query.status==='unread'){
    find.readAt=null;
  }
  if(req.query.status==='read'){
    find.readAt={$ne:null};
  }

  const notifications=await Notification.find(find).sort({createdAt:-1}).lean();
  res.render('client/pages/account/notifications',{
    pageTitle:'Thông báo',
    activeAccountPage:'notifications',
    selectedStatus:req.query.status || '',
    notifications:notifications.map(item=>({
      ...item,
      createdAtLabel:moment(item.createdAt).format('DD/MM/YYYY HH:mm')
    }))
  });
};

module.exports.read=async(req,res)=>{
  const notification=await Notification.findOneAndUpdate({
    _id:req.params.id,
    userId:req.user.id,
    deleted:false
  },{
    readAt:new Date()
  },{new:true});

  if(!notification){
    return res.status(404).json({code:'error',message:'Không tìm thấy thông báo!'});
  }
  res.json({code:'success',redirect:notification.link || '/account/notifications'});
};

module.exports.readAll=async(req,res)=>{
  await Notification.updateMany({
    userId:req.user.id,
    deleted:false,
    readAt:null
  },{
    readAt:new Date()
  });
  res.json({code:'success',message:'Đã đánh dấu tất cả là đã đọc!',redirect:'/account/notifications'});
};

module.exports.remove=async(req,res)=>{
  const result=await Notification.updateOne({
    _id:req.params.id,
    userId:req.user.id,
    deleted:false
  },{
    deleted:true
  });

  if(!result.matchedCount){
    return res.status(404).json({code:'error',message:'Không tìm thấy thông báo!'});
  }
  res.json({code:'success',message:'Đã xóa thông báo!',redirect:'/account/notifications'});
};
