const Category=require('../../models/category.model');
const CategoryHelper=require('../../helpers/category.helper');
module.exports.list=async (req,res,next)=>{
    const categoryList=await Category.find({
        deleted:false,
        status:"active"
    })
    
    const categoryTree=CategoryHelper.buildCategoryTree(categoryList);
    res.locals.categoryTree=categoryTree;
    next();

}
