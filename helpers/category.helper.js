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
module.exports.buildCategoryTree=buildCategoryTree;