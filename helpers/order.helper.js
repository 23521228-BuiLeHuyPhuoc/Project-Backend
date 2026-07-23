const Order=require('../models/order.model');
const Tour=require('../models/tour.model');
const UserVoucher=require('../models/user-voucher.model');
const Voucher=require('../models/voucher.model');

const releaseOrderResources=async order=>{
  await Promise.all((order.items || []).map(item=>Tour.updateOne(
    {_id:item.tourId},
    {$inc:{
      stockAdult:Number(item.quantityAdult || 0),
      stockChildren:Number(item.quantityChildren || 0),
      stockBaby:Number(item.quantityBaby || 0)
    }}
  )));

  const userVoucher=await UserVoucher.findOneAndUpdate({
    userId:order.userId,
    orderId:order._id,
    status:'used'
  },{
    $set:{status:'available',usedAt:null,orderId:null}
  });

  if(userVoucher){
    await Voucher.updateOne({
      _id:userVoucher.voucherId,
      usedCount:{$gt:0}
    },{
      $inc:{usedCount:-1}
    });
  }
};

const cancelOrderAndRelease=async(filter,updatedBy='')=>{
  const updateData={
    status:'cancelled',
    cancelledAt:new Date()
  };
  if(updatedBy){
    updateData.updatedBy=updatedBy;
  }

  const order=await Order.findOneAndUpdate({
    ...filter,
    deleted:false
  },{
    $set:updateData
  });
  if(!order){
    return null;
  }

  await releaseOrderResources(order);
  return order;
};

module.exports={cancelOrderAndRelease,releaseOrderResources};
