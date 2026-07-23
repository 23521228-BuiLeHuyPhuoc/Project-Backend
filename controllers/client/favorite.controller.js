const moment=require('moment');
const mongoose=require('mongoose');
const Favorite=require('../../models/favorite.model');
const Tour=require('../../models/tour.model');
const User=require('../../models/user.model');
const {
  removeFavoriteInteraction,
  syncFavoriteInteraction
}=require('../../helpers/user-interaction.helper');
const {
  invalidateRecommendationCache
}=require('../../services/recommendation/cache-manager');

module.exports.list=async(req,res)=>{
  const viewedAt=new Date();
  const favorites=await Favorite.find({userId:req.user.id})
    .populate({
      path:'tourId',
      match:{status:'active',deleted:false}
    })
    .sort({createdAt:-1})
    .lean();

  const items=favorites.filter(item=>item.tourId).map(item=>{
    const tour=item.tourId;
    const basePrice=Number(tour.priceAdult || 0);
    const salePrice=Number(tour.priceNewAdult || basePrice);
    return {
      ...item,
      tour:{
        ...tour,
        discount:basePrice>salePrice
          ? Math.round((basePrice-salePrice)/basePrice*100)
          : 0,
        departureDateLabel:tour.departureDate
          ? moment(tour.departureDate).format('DD/MM/YYYY')
          : 'Đang cập nhật'
      }
    };
  });

  await User.updateOne({_id:req.user.id},{
    $set:{'accountSeenAt.favorites':viewedAt}
  });
  res.locals.accountMeta.favoriteBadgeCount=0;
  res.render('client/pages/account/favorites',{
    pageTitle:'Tour yêu thích',
    activeAccountPage:'favorites',
    favorites:items
  });
};

module.exports.toggle=async(req,res)=>{
  try{
    if(!mongoose.isValidObjectId(req.params.tourId)){
      return res.status(400).json({code:'error',message:'Thông tin tour không hợp lệ!'});
    }
    const tour=await Tour.findOne({
      _id:req.params.tourId,
      status:'active',
      deleted:false
    });
    if(!tour){
      return res.status(404).json({code:'error',message:'Không tìm thấy tour!'});
    }

    const favorite=await Favorite.findOne({
      userId:req.user.id,
      tourId:tour.id
    });
    if(favorite){
      await favorite.deleteOne();
      await removeFavoriteInteraction({userId:req.user.id,tourId:tour.id});
      invalidateRecommendationCache(req.app,{
        userId:req.user.id,
        scopes:['trending']
      });
      return res.json({
        code:'success',
        favorited:false,
        message:'Đã xóa khỏi danh sách yêu thích!'
      });
    }

    await Favorite.create({userId:req.user.id,tourId:tour.id});
    await syncFavoriteInteraction({userId:req.user.id,tourId:tour.id});
    invalidateRecommendationCache(req.app,{
      userId:req.user.id,
      scopes:['trending']
    });
    res.json({
      code:'success',
      favorited:true,
      message:'Đã thêm tour vào yêu thích!'
    });
  }
  catch(error){
    if(error && error.code===11000){
      await syncFavoriteInteraction({userId:req.user.id,tourId:req.params.tourId});
      invalidateRecommendationCache(req.app,{
        userId:req.user.id,
        scopes:['trending']
      });
      return res.json({
        code:'success',
        favorited:true,
        message:'Đã thêm tour vào yêu thích!'
      });
    }
    res.status(500).json({code:'error',message:'Không thể cập nhật yêu thích lúc này!'});
  }
};
