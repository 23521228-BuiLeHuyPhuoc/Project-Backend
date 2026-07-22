const Article=require("../models/article.model");
const newsList=require("../data/news.data");

const escapeHtml=value=>String(value || "")
  .replace(/&/g,"&amp;")
  .replace(/</g,"&lt;")
  .replace(/>/g,"&gt;")
  .replace(/"/g,"&quot;")
  .replace(/'/g,"&#039;");

const buildContentHtml=sections=>(sections || []).map(section=>{
  const heading=section.heading ? `<h2>${escapeHtml(section.heading)}</h2>` : "";
  const paragraphs=(section.paragraphs || []).map(item=>`<p>${escapeHtml(item)}</p>`).join("");
  const bullets=section.bullets && section.bullets.length
    ? `<ul>${section.bullets.map(item=>`<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : "";
  return `${heading}${paragraphs}${bullets}`;
}).join("");

const parsePublishedAt=value=>{
  const [day,month,year]=String(value || "").split("/").map(Number);
  if(day && month && year){
    return new Date(year,month-1,day,8,0,0);
  }
  return new Date();
};

module.exports.ensureDefaultArticles=async()=>{
  const operations=newsList.map(item=>({
    updateOne:{
      filter:{slug:item.slug},
      update:{$setOnInsert:{
        title:item.title,
        slug:item.slug,
        image:item.image,
        category:item.category,
        description:item.description,
        quote:item.quote || "",
        contentHtml:buildContentHtml(item.content),
        contentSections:item.content || [],
        author:item.author || "28.TRAVEL",
        readTime:item.readTime || "5 phút",
        featured:Boolean(item.featured),
        status:"published",
        publishedAt:parsePublishedAt(item.date),
        createdBy:"system",
        updatedBy:"system",
        deleted:false
      }},
      upsert:true
    }
  }));
  if(operations.length){
    await Article.bulkWrite(operations,{ordered:false});
  }
};
