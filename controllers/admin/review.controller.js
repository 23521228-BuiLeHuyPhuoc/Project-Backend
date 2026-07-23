const Review=require("../../models/review.model");
const moment=require("moment");
const {removeRatingInteraction}=require("../../helpers/user-interaction.helper");
const {updateTourRatingSafe}=require("../../helpers/tour-rating.helper");

module.exports.list=async(req,res)=>{
  const find={deleted:false};
  const filters={status:req.query.status || "",rating:req.query.rating || ""};
  if(["published","hidden"].includes(filters.status)){
    find.status=filters.status;
  }
  const rating=Number(filters.rating);
  if(Number.isInteger(rating) && rating>=1 && rating<=5){
    find.rating=rating;
  }

  const reviewList=(await Review.find(find)
    .populate("userId","fullName email avatar")
    .populate("tourId","name slug avatar")
    .populate("orderId","orderCode")
    .sort({createdAt:-1})
    .lean()).map(item=>({...item,createdAtLabel:moment(item.createdAt).format("HH:mm DD/MM/YYYY")}));
  res.render("admin/pages/review-list",{pageTitle:"Quản lý đánh giá",reviewList,filters});
};

module.exports.statusPatch=async(req,res)=>{
  if(!["published","hidden"].includes(req.body.status)){
    return res.status(400).json({code:"error",message:"Trạng thái đánh giá không hợp lệ!"});
  }
  const review=await Review.findOneAndUpdate({_id:req.params.id,deleted:false},{
    status:req.body.status,
    updatedBy:req.account.id
  },{new:true});
  if(!review){
    return res.status(404).json({code:"error",message:"Không tìm thấy đánh giá!"});
  }
  await updateTourRatingSafe(review.tourId);
  req.flash("success","Cập nhật trạng thái đánh giá thành công!");
  res.json({code:"success"});
};

module.exports.deletePatch=async(req,res)=>{
  const review=await Review.findOneAndUpdate({_id:req.params.id,deleted:false},{
    deleted:true,
    deletedBy:req.account.id,
    deletedAt:new Date()
  },{new:true});
  if(!review){
    return res.status(404).json({code:"error",message:"Không tìm thấy đánh giá!"});
  }
  await removeRatingInteraction(review);
  await updateTourRatingSafe(review.tourId);
  req.flash("success","Xóa đánh giá thành công!");
  res.json({code:"success"});
};
