const moment=require("moment");
const Article=require("../../models/article.model");
const staticNewsList=require("../../data/news.data");

const mapDatabaseArticle=item=>{
  const hasStructuredContent=Array.isArray(item.contentSections) && item.contentSections.length>0;
  return {
    ...item,
    content:hasStructuredContent ? item.contentSections : undefined,
    contentHtml:hasStructuredContent ? null : item.contentHtml,
    date:moment(item.publishedAt || item.createdAt).format("DD/MM/YYYY"),
    image:item.image || "/assets/images/blog-1.jpg"
  };
};

const getNewsList=async()=>{
  const managedArticles=await Article.find({}).sort({featured:-1,publishedAt:-1,createdAt:-1}).lean();
  const databaseArticles=managedArticles
    .filter(item=>!item.deleted && item.status==="published")
    .map(mapDatabaseArticle);
  const managedSlugs=new Set(managedArticles.map(item=>item.slug));
  const hasDatabaseFeatured=databaseArticles.some(item=>item.featured);
  const fallbackArticles=staticNewsList
    .filter(item=>!managedSlugs.has(item.slug))
    .map(item=>({...item,featured:hasDatabaseFeatured ? false : item.featured}));
  return [...databaseArticles,...fallbackArticles];
};

module.exports.index=async(req,res)=>{
  const newsList=await getNewsList();
  const breadcrumb={
    image:"/assets/images/banner-7.jpg",
    title:"Tin tức du lịch",
    list:[
      {link:"/",title:"Trang Chủ"},
      {link:"/tin-tuc",title:"Tin tức"}
    ]
  };
  res.render("client/pages/news",{
    pageTitle:"Tin tức du lịch",
    breadcrumb,
    newsList
  });
};

module.exports.detail=async(req,res)=>{
  const newsList=await getNewsList();
  const article=newsList.find(item=>item.slug===req.params.slug);
  if(!article){
    return res.redirect("/tin-tuc");
  }

  const breadcrumb={
    image:"/assets/images/banner-7.jpg",
    title:article.title,
    list:[
      {link:"/",title:"Trang Chủ"},
      {link:"/tin-tuc",title:"Tin tức"},
      {link:`/tin-tuc/${article.slug}`,title:article.title}
    ]
  };
  const relatedArticles=newsList.filter(item=>item.slug!==article.slug).slice(0,3);
  res.render("client/pages/news-detail",{
    pageTitle:article.title,
    breadcrumb,
    article,
    relatedArticles
  });
};
