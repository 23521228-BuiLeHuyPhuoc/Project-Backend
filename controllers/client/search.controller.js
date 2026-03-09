const Tour=require('../../models/tour.model');
const slugify=require('slugify');
const moment=require('moment');
module.exports.list=async(req,res)=>{
    const objFind={
        
        deleted:false,
        status:"active"
    
    }
    //Lọc điểm đi
    if(req.query.locationFrom)
    {
   objFind.locations = { $in: req.query.locationFrom };
    }
    if(req.query.locationTo)
    {
        const keyword=slugify(req.query.locationTo,{
            lower:true,
            replacement:"-",
            trim:true,
            locale:"vi"
        })
        const regex=new RegExp(keyword,"i");
        objFind.slug=regex;
    }
    if(req.query.departureDate){
        const departureDateStart=moment(req.query.departureDate).startOf("date").toDate();
        const departureDateEnd=moment(req.query.departureDate).endOf("date").toDate();
        const departureDate= {
            $gte: departureDateStart,
            $lte: departureDateEnd
        }
        objFind.departureDate=departureDate;
    }
    if(req.query.stockAdult)
    {
        objFind.stockAdult={$gte:parseInt(req.query.stockAdult)};
    }
    if(req.query.stockChildren)
    {
        objFind.stockChildren={$gte:parseInt(req.query.stockChildren)};

    }
    if(req.query.stockChildren)
    {
        objFind.stockChildren={$gte:parseInt(req.query.stockChildren)};

    }
    if(req.query.stockBaby)
    {
        objFind.stockBaby={$gte:parseInt(req.query.stockBaby)};
    }
    if(req.query.price)
    {
        const fromPrice=req.query.price.split('-')[0];
        const toPrice=req.query.price.split('-')[1];
        objFind.priceNewAdult={$gte:parseInt(fromPrice),$lte:parseInt(toPrice)};
    }
    const tourList=await Tour.find(objFind);
    for(const item of tourList)
    {
        const priceAdultparse=parseInt(item.priceAdult);
                    const priceNewAdultparse=parseInt(item.priceNewAdult);
                    item.priceAdult=parseInt(priceAdultparse);
                    item.priceNewAdult=parseInt(priceNewAdultparse);
                  if(item.departureDate)
                  {
                    item.departureFormatDate=moment(item.departureDate).format("DD/MM/YYYY");
                  }
                   if(item.priceAdult&&item.priceNewAdult&&priceNewAdultparse<priceAdultparse)
          {
            
            item.discount=(priceAdultparse-priceNewAdultparse)/priceAdultparse *100;
          }
          else{
            item.discount=0;
          }
    }

    res.render('client/pages/search',{
        pageTitle:"Kết quả tìm kiếm",
        tourList:tourList
    })
}