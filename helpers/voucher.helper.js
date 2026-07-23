const UserVoucher=require('../models/user-voucher.model');
const Voucher=require('../models/voucher.model');

class VoucherValidationError extends Error{
  constructor(message,status=400){
    super(message);
    this.status=status;
  }
}

const normalizeVoucherCode=value=>typeof value==='string'
  ? value.trim().toUpperCase()
  : '';

const calculateDiscount=(voucher,subTotal)=>{
  const orderValue=Math.max(0,Number(subTotal) || 0);
  const discountValue=Math.max(0,Number(voucher.discountValue) || 0);
  let discount=voucher.discountType==='percent'
    ? Math.round(orderValue*discountValue/100)
    : Math.round(discountValue);
  const maxDiscount=Math.max(0,Number(voucher.maxDiscount) || 0);

  if(maxDiscount>0){
    discount=Math.min(discount,maxDiscount);
  }
  return Math.min(orderValue,Math.max(0,discount));
};

const getApplicableVoucher=async({userId,code,subTotal})=>{
  const normalizedCode=normalizeVoucherCode(code);
  if(!normalizedCode){
    throw new VoucherValidationError('Vui lòng nhập mã giảm giá!');
  }

  const now=new Date();
  const voucher=await Voucher.findOne({
    code:normalizedCode,
    status:'active',
    deleted:false,
    startAt:{$lte:now},
    endAt:{$gte:now}
  });

  if(!voucher){
    throw new VoucherValidationError('Mã giảm giá không tồn tại hoặc đã hết hạn!');
  }
  if(voucher.usageLimit>0 && voucher.usedCount>=voucher.usageLimit){
    throw new VoucherValidationError('Mã giảm giá đã hết lượt sử dụng!',409);
  }

  const userVoucher=await UserVoucher.findOne({
    userId,
    voucherId:voucher.id
  });
  if(!userVoucher){
    throw new VoucherValidationError('Mã giảm giá này chưa có trong ví voucher của bạn!');
  }
  if(userVoucher.status!=='available'){
    throw new VoucherValidationError('Mã giảm giá đã được sử dụng!',409);
  }

  const orderValue=Math.max(0,Number(subTotal) || 0);
  if(orderValue<Number(voucher.minOrderValue || 0)){
    const minOrderValue=Number(voucher.minOrderValue || 0).toLocaleString('vi-VN');
    throw new VoucherValidationError(`Đơn hàng cần tối thiểu ${minOrderValue}đ để dùng mã này!`);
  }

  const discount=calculateDiscount(voucher,orderValue);
  return {
    code:normalizedCode,
    discount,
    total:orderValue-discount,
    userVoucher,
    voucher
  };
};

module.exports={
  VoucherValidationError,
  calculateDiscount,
  getApplicableVoucher,
  normalizeVoucherCode
};
