const mongoose=require('mongoose');
const moment=require('moment');
const Tour=require('../../models/tour.model');
const City=require('../../models/city.model');
const {
  invalidateRecommendationCache
}=require('../../services/recommendation/cache-manager');
const {getApplicableVoucher}=require('../../helpers/voucher.helper');

const quantityFields=['quantityAdult','quantityChildren','quantityBaby'];

const parseQuantity=value=>{
  const number=Number(value);
  return Number.isInteger(number) && number>=0 ? number : null;
};

const getCartDetails=async user=>{
  const cartItems=user.cart || [];
  const tourIds=[...new Set(cartItems.map(item=>String(item.tourId)))];
  const cityIds=[...new Set(cartItems.map(item=>String(item.locationFrom)))];
  const [tours,cities]=await Promise.all([
    Tour.find({
      _id:{$in:tourIds},
      status:'active',
      deleted:false
    }).lean(),
    City.find({_id:{$in:cityIds}}).lean()
  ]);
  const tourMap=new Map(tours.map(tour=>[String(tour._id),tour]));
  const cityMap=new Map(cities.map(city=>[String(city._id),city]));
  const invalidItemIds=[];
  const cart=[];

  for(const item of cartItems){
    const tour=tourMap.get(String(item.tourId));
    const city=cityMap.get(String(item.locationFrom));
    const hasLocation=tour && tour.locations.some(location=>String(location)===String(item.locationFrom));

    if(!tour || !city || !hasLocation){
      invalidItemIds.push(item._id);
      continue;
    }

    const otherItems=cartItems.filter(other=>
      String(other.tourId)===String(item.tourId) && String(other._id)!==String(item._id)
    );
    const usedByOthers=otherItems.reduce((total,other)=>({
      quantityAdult:total.quantityAdult+other.quantityAdult,
      quantityChildren:total.quantityChildren+other.quantityChildren,
      quantityBaby:total.quantityBaby+other.quantityBaby
    }),{quantityAdult:0,quantityChildren:0,quantityBaby:0});
    const subtotal=(item.quantityAdult*tour.priceNewAdult)
      +(item.quantityChildren*tour.priceNewChildren)
      +(item.quantityBaby*tour.priceNewBaby);

    cart.push({
      id:String(item._id),
      tourId:String(item.tourId),
      locationFrom:String(item.locationFrom),
      locationFromName:city.name,
      quantityAdult:item.quantityAdult,
      quantityChildren:item.quantityChildren,
      quantityBaby:item.quantityBaby,
      checked:item.checked,
      avatar:tour.avatar,
      name:tour.name,
      slug:tour.slug,
      departureDateFormat:moment(tour.departureDate).format('DD/MM/YYYY'),
      priceNewAdult:tour.priceNewAdult,
      priceNewChildren:tour.priceNewChildren,
      priceNewBaby:tour.priceNewBaby,
      stockAdult:Math.max(0,tour.stockAdult-usedByOthers.quantityAdult),
      stockChildren:Math.max(0,tour.stockChildren-usedByOthers.quantityChildren),
      stockBaby:Math.max(0,tour.stockBaby-usedByOthers.quantityBaby),
      subtotal
    });
  }

  if(invalidItemIds.length){
    user.cart.pull(...invalidItemIds);
    await user.save();
  }

  const subTotal=cart.reduce((total,item)=>item.checked ? total+item.subtotal : total,0);
  return {
    cart,
    cartCount:cart.length,
    subTotal,
    discount:0,
    total:subTotal
  };
};

module.exports.cart=async(req,res)=>{
  const cartData=await getCartDetails(req.user);
  res.render('client/pages/cart',{
    pageTitle:'Giỏ hàng',
    cartData
  });
};

module.exports.cartDetail=async(req,res)=>{
  try{
    res.json({
      code:'success',
      ...(await getCartDetails(req.user))
    });
  }
  catch(error){
    res.status(500).json({
      code:'error',
      message:'Không thể tải giỏ hàng lúc này!'
    });
  }
};

module.exports.applyVoucher=async(req,res)=>{
  try{
    const cartData=await getCartDetails(req.user);
    if(cartData.subTotal<=0){
      return res.status(400).json({
        code:'error',
        message:'Vui lòng chọn ít nhất một tour trước khi áp dụng mã giảm giá!'
      });
    }

    const result=await getApplicableVoucher({
      userId:req.user.id,
      code:req.body.voucherCode,
      subTotal:cartData.subTotal
    });
    res.json({
      code:'success',
      message:`Đã áp dụng mã ${result.code}!`,
      voucherCode:result.code,
      discount:result.discount,
      total:result.total
    });
  }
  catch(error){
    res.status(error.status || 500).json({
      code:'error',
      message:error.status ? error.message : 'Không thể áp dụng mã giảm giá lúc này!'
    });
  }
};

module.exports.addPost=async(req,res)=>{
  try{
    const {tourId,locationFrom}=req.body;
    const quantities=quantityFields.reduce((result,field)=>{
      result[field]=parseQuantity(req.body[field]);
      return result;
    },{});

    if(!mongoose.isValidObjectId(tourId) || !mongoose.isValidObjectId(locationFrom)){
      return res.status(400).json({code:'error',message:'Thông tin tour không hợp lệ!'});
    }
    if(quantityFields.some(field=>quantities[field]===null)){
      return res.status(400).json({code:'error',message:'Số lượng hành khách không hợp lệ!'});
    }
    if(quantityFields.every(field=>quantities[field]===0)){
      return res.status(400).json({code:'error',message:'Vui lòng chọn ít nhất một hành khách!'});
    }

    const [tour,cityExists]=await Promise.all([
      Tour.findOne({_id:tourId,status:'active',deleted:false}),
      City.exists({_id:locationFrom})
    ]);
    const supportsLocation=tour && tour.locations.some(location=>String(location)===String(locationFrom));
    if(!tour || !cityExists || !supportsLocation){
      return res.status(404).json({code:'error',message:'Tour hoặc điểm khởi hành không còn khả dụng!'});
    }

    const currentTotals=req.user.cart
      .filter(item=>String(item.tourId)===String(tourId))
      .reduce((total,item)=>({
        quantityAdult:total.quantityAdult+item.quantityAdult,
        quantityChildren:total.quantityChildren+item.quantityChildren,
        quantityBaby:total.quantityBaby+item.quantityBaby
      }),{quantityAdult:0,quantityChildren:0,quantityBaby:0});
    const exceedsStock=currentTotals.quantityAdult+quantities.quantityAdult>tour.stockAdult
      || currentTotals.quantityChildren+quantities.quantityChildren>tour.stockChildren
      || currentTotals.quantityBaby+quantities.quantityBaby>tour.stockBaby;
    if(exceedsStock){
      return res.status(409).json({
        code:'error',
        message:'Số lượng tour trong giỏ vượt quá số chỗ hiện có!'
      });
    }

    const existingItem=req.user.cart.find(item=>
      String(item.tourId)===String(tourId) && String(item.locationFrom)===String(locationFrom)
    );
    if(existingItem){
      quantityFields.forEach(field=>{
        existingItem[field]+=quantities[field];
      });
      existingItem.checked=true;
    }
    else{
      req.user.cart.push({
        tourId,
        locationFrom,
        ...quantities,
        checked:true
      });
    }
    await req.user.save();
    invalidateRecommendationCache(req.app,{userId:req.user.id});

    res.status(201).json({
      code:'success',
      message:'Đã thêm tour vào giỏ hàng!',
      cartCount:req.user.cart.length,
      redirect:'/cart'
    });
  }
  catch(error){
    res.status(500).json({code:'error',message:'Không thể thêm tour vào giỏ hàng lúc này!'});
  }
};

module.exports.updatePatch=async(req,res)=>{
  try{
    if(!mongoose.isValidObjectId(req.params.itemId)){
      return res.status(400).json({code:'error',message:'Mục giỏ hàng không hợp lệ!'});
    }
    const item=req.user.cart.id(req.params.itemId);
    if(!item){
      return res.status(404).json({code:'error',message:'Không tìm thấy tour trong giỏ hàng!'});
    }

    if(Object.prototype.hasOwnProperty.call(req.body,'checked')){
      if(typeof req.body.checked!=='boolean'){
        return res.status(400).json({code:'error',message:'Trạng thái lựa chọn không hợp lệ!'});
      }
      item.checked=req.body.checked;
    }

    const hasQuantityUpdate=quantityFields.some(field=>Object.prototype.hasOwnProperty.call(req.body,field));
    if(hasQuantityUpdate){
      const nextQuantities={};
      for(const field of quantityFields){
        nextQuantities[field]=Object.prototype.hasOwnProperty.call(req.body,field)
          ? parseQuantity(req.body[field])
          : item[field];
      }
      if(quantityFields.some(field=>nextQuantities[field]===null)){
        return res.status(400).json({code:'error',message:'Số lượng hành khách không hợp lệ!'});
      }
      if(quantityFields.every(field=>nextQuantities[field]===0)){
        return res.status(400).json({
          code:'error',
          message:'Vui lòng chọn ít nhất một hành khách hoặc xóa tour khỏi giỏ!'
        });
      }

      const tour=await Tour.findOne({_id:item.tourId,status:'active',deleted:false});
      if(!tour){
        return res.status(404).json({code:'error',message:'Tour không còn khả dụng!'});
      }
      const otherTotals=req.user.cart
        .filter(other=>String(other.tourId)===String(item.tourId) && String(other._id)!==String(item._id))
        .reduce((total,other)=>({
          quantityAdult:total.quantityAdult+other.quantityAdult,
          quantityChildren:total.quantityChildren+other.quantityChildren,
          quantityBaby:total.quantityBaby+other.quantityBaby
        }),{quantityAdult:0,quantityChildren:0,quantityBaby:0});
      const exceedsStock=otherTotals.quantityAdult+nextQuantities.quantityAdult>tour.stockAdult
        || otherTotals.quantityChildren+nextQuantities.quantityChildren>tour.stockChildren
        || otherTotals.quantityBaby+nextQuantities.quantityBaby>tour.stockBaby;
      if(exceedsStock){
        return res.status(409).json({
          code:'error',
          message:'Số lượng tour trong giỏ vượt quá số chỗ hiện có!'
        });
      }
      quantityFields.forEach(field=>{
        item[field]=nextQuantities[field];
      });
    }

    await req.user.save();
    invalidateRecommendationCache(req.app,{userId:req.user.id});
    res.json({code:'success',message:'Đã cập nhật giỏ hàng!'});
  }
  catch(error){
    res.status(500).json({code:'error',message:'Không thể cập nhật giỏ hàng lúc này!'});
  }
};

module.exports.deleteItem=async(req,res)=>{
  try{
    if(!mongoose.isValidObjectId(req.params.itemId) || !req.user.cart.id(req.params.itemId)){
      return res.status(404).json({code:'error',message:'Không tìm thấy tour trong giỏ hàng!'});
    }
    req.user.cart.pull(req.params.itemId);
    await req.user.save();
    invalidateRecommendationCache(req.app,{userId:req.user.id});
    res.json({
      code:'success',
      message:'Đã xóa tour khỏi giỏ hàng!',
      cartCount:req.user.cart.length
    });
  }
  catch(error){
    res.status(500).json({code:'error',message:'Không thể xóa tour khỏi giỏ hàng lúc này!'});
  }
};
