const Category=require("../models/category.model");
const buildCategoryTree=(categories,parentId="")=>{
    const tree=[];
    categories.forEach(category=>{
        if(category.parent==parentId)
        {
            tree.push({
                _id:category._id,
                name:category.name,
                slug:category.slug,
                children:buildCategoryTree(categories,category._id.toString())
            })
        }
    })
    return tree;
}
const CategoriesFamily=async(parentId)=>
{
    const family=[];
    const visited=new Set();
    const findChildren=async(currentId)=>{
        const normalizedId=String(currentId || "");
        if(!normalizedId || visited.has(normalizedId)){
            return;
        }
        visited.add(normalizedId);
        family.push(currentId);
        const children=await Category.find({
            parent:currentId,
            deleted:false,
            status:"active"
        });
    for(const child of children){
        await findChildren(child.id)
    } 
    };
    await findChildren(parentId);
    return family
   

}
const CategoriesParentToRoot=async(categories,categoryId,visited=new Set())=>
{
    const normalizedId=String(categoryId || "");
    if(!normalizedId || visited.has(normalizedId)){
        return [];
    }
    visited.add(normalizedId);

    const catRecord=await Category.findOne({
        _id:categoryId,
        
    })
    if(!catRecord){
        return [];
    }
    const list=[];
    list.push({
        _id:catRecord._id,
        name:catRecord.name,
        slug:catRecord.slug
    })
    if(!catRecord.parent) return list;
    for(const cat of categories)
    {
        if(cat._id.toString()==catRecord.parent.toString())
        {
             const parents = await CategoriesParentToRoot(categories,cat._id.toString(),visited);
             list.unshift(...parents);
             
             break;
       }

    }

    return list;
}
module.exports.CategoriesParentToRoot=CategoriesParentToRoot;
module.exports.CategoriesFamily=CategoriesFamily;
module.exports.buildCategoryTree=buildCategoryTree;
