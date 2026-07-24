const moment=require('moment');
const mongoose=require('mongoose');
const {createNotificationSafe}=require('../../helpers/notification.helper');
const UserVoucher=require('../../models/user-voucher.model');
const Voucher=require('../../models/voucher.model');

const formatVoucher=voucher=>({
  ...voucher,
  valueLabel:voucher.discountType==='percent'
    ? `${voucher.discountValue}%`
    : `${Number(voucher.discountValue).toLocaleString('vi-VN')}đ`,
  minOrderLabel:Number(voucher.minOrderValue || 0).toLocaleString('vi-VN'),
  maxDiscountLabel:Number(voucher.maxDiscount || 0).toLocaleString('vi-VN'),
  endAtLabel:moment(voucher.endAt).format('DD/MM/YYYY')
});

const prioritizeFeaturedVoucher=(items,featuredCode,getCode)=>{
  if(!featuredCode){
    return items;
  }
  return [...items].sort((first,second)=>
    Number(getCode(second)===featuredCode)-Number(getCode(first)===featuredCode)
  );
};

module.exports.list=async(req,res)=>{
  const now=new Date();
  const featuredVoucherCode=typeof req.query.code==='string'
    ? req.query.code.trim().toUpperCase().slice(0,50)
    : '';
  const [vouchers,wallet]=await Promise.all([
    Voucher.find({
      status:'active',
      deleted:false,
      startAt:{$lte:now},
      endAt:{$gte:now}
    }).sort({endAt:1}).lean(),
    UserVoucher.find({userId:req.user.id})
      .populate('voucherId')
      .sort({createdAt:-1})
      .lean()
  ]);

  const ownedIds=new Set(wallet.map(item=>String(item.voucherId && item.voucherId._id)));
  const formattedWallet=wallet.filter(item=>item.voucherId).map(item=>({
    ...item,
    voucher:formatVoucher(item.voucherId),
    isFeatured:item.voucherId.code===featuredVoucherCode
  }));
  const availableVouchers=vouchers
    .filter(voucher=>!ownedIds.has(String(voucher._id)))
    .map(voucher=>({
      ...formatVoucher(voucher),
      isFeatured:voucher.code===featuredVoucherCode
    }));

  res.render('client/pages/account/vouchers',{
    pageTitle:'Ví voucher',
    activeAccountPage:'vouchers',
    wallet:prioritizeFeaturedVoucher(
      formattedWallet,
      featuredVoucherCode,
      item=>item.voucher.code
    ),
    availableVouchers:prioritizeFeaturedVoucher(
      availableVouchers,
      featuredVoucherCode,
      voucher=>voucher.code
    )
  });
};

module.exports.claim=async(req,res)=>{
  try{
    if(!mongoose.isValidObjectId(req.params.id)){
      return res.status(400).json({code:'error',message:'Voucher không hợp lệ!'});
    }
    const now=new Date();
    const voucher=await Voucher.findOne({
      _id:req.params.id,
      status:'active',
      deleted:false,
      startAt:{$lte:now},
      endAt:{$gte:now}
    });

    if(!voucher || (voucher.usageLimit>0 && voucher.usedCount>=voucher.usageLimit)){
      return res.status(400).json({code:'error',message:'Voucher không còn khả dụng!'});
    }

    const existing=await UserVoucher.findOne({
      userId:req.user.id,
      voucherId:voucher.id
    });
    if(existing){
      return res.status(409).json({code:'error',message:'Voucher đã có trong ví của bạn!'});
    }

    await UserVoucher.create({userId:req.user.id,voucherId:voucher.id});
    await createNotificationSafe({
      userId:req.user.id,
      title:'Đã lưu voucher mới',
      message:`Voucher ${voucher.code} đã được thêm vào ví của bạn.`,
      type:'voucher',
      link:'/account/vouchers'
    });

    res.json({
      code:'success',
      message:'Đã lưu voucher!',
      redirect:'/account/vouchers'
    });
  }
  catch(error){
    if(error && error.code===11000){
      return res.status(409).json({code:'error',message:'Voucher đã có trong ví của bạn!'});
    }
    res.status(500).json({code:'error',message:'Không thể lưu voucher lúc này!'});
  }
};

module.exports.remove=async(req,res)=>{
  if(!mongoose.isValidObjectId(req.params.id)){
    return res.status(400).json({code:'error',message:'Voucher không hợp lệ!'});
  }
  const result=await UserVoucher.deleteOne({
    _id:req.params.id,
    userId:req.user.id,
    status:'available'
  });

  if(!result.deletedCount){
    return res.status(400).json({code:'error',message:'Không thể xóa voucher này!'});
  }
  res.json({code:'success',message:'Đã xóa voucher khỏi ví!',redirect:'/account/vouchers'});
};
