const Category=require('../../models/category.model');
const Tour=require('../../models/tour.model');
const moment=require('moment');
const FamilyHelper=require('../../helpers/category.helper');
const City=require('../../models/city.model');

const ITEMS_PER_PAGE=9;
const DEFAULT_SORT='discount';
const SORT_OPTIONS=[
  {
    value:'price-asc',
    label:'Giá tăng dần',
    icon:'fa-solid fa-square-caret-up'
  },
  {
    value:'price-desc',
    label:'Giá giảm dần',
    icon:'fa-solid fa-square-caret-down'
  },
  {
    value:'discount',
    label:'Khuyến Mại Hot',
    icon:'fa-solid fa-tag'
  },
  {
    value:'views',
    label:'Xem Nhiều',
    icon:'fa-solid fa-eye'
  }
];
const VALID_SORTS=new Set(SORT_OPTIONS.map(option=>option.value));

const buildTourPipeline=({find,sort,skip})=>{
  const pipeline=[
    {$match:find},
    {
      $addFields:{
        positionSort:{
          $convert:{input:'$position',to:'int',onError:0,onNull:0}
        },
        salePriceSort:{
          $cond:[
            {$gt:[{$ifNull:['$priceNewAdult',0]},0]},
            '$priceNewAdult',
            {$ifNull:['$priceAdult',0]}
          ]
        }
      }
    }
  ];

  if(sort==='discount'){
    pipeline.push({
      $addFields:{
        discountSort:{
          $cond:[
            {
              $and:[
                {$gt:[{$ifNull:['$priceAdult',0]},0]},
                {$gt:[{$ifNull:['$priceNewAdult',0]},0]},
                {$lt:['$priceNewAdult','$priceAdult']}
              ]
            },
            {
              $divide:[
                {$subtract:['$priceAdult','$priceNewAdult']},
                '$priceAdult'
              ]
            },
            0
          ]
        }
      }
    });
  }

  if(sort==='views'){
    pipeline.push(
      {
        $lookup:{
          from:'user-interactions',
          let:{tourId:'$_id'},
          pipeline:[
            {
              $match:{
                $expr:{
                  $and:[
                    {$eq:['$tourId','$$tourId']},
                    {$eq:['$type','view']},
                    {
                      $eq:[
                        {$ifNull:['$metadata.interactionKind','']},
                        ''
                      ]
                    }
                  ]
                }
              }
            },
            {$count:'count'}
          ],
          as:'viewStats'
        }
      },
      {
        $addFields:{
          viewCount:{$ifNull:[{$arrayElemAt:['$viewStats.count',0]},0]}
        }
      }
    );
  }

  const sortBy={
    'price-asc':{salePriceSort:1,positionSort:-1,_id:1},
    'price-desc':{salePriceSort:-1,positionSort:-1,_id:1},
    discount:{discountSort:-1,positionSort:-1,_id:1},
    views:{viewCount:-1,positionSort:-1,_id:1}
  };

  pipeline.push(
    {$sort:sortBy[sort]},
    {$skip:skip},
    {$limit:ITEMS_PER_PAGE},
    {$project:{positionSort:0,salePriceSort:0,discountSort:0,viewStats:0}}
  );

  return pipeline;
};

const formatTour=tour=>{
  tour.priceAdult=Number(tour.priceAdult || 0);
  tour.priceNewAdult=Number(tour.priceNewAdult || 0);
  tour.departureFormatDate=tour.departureDate
    ? moment(tour.departureDate).format('DD/MM/YYYY')
    : '';
  tour.discount=tour.priceAdult>0
    && tour.priceNewAdult>0
    && tour.priceNewAdult<tour.priceAdult
    ? Number(((tour.priceAdult-tour.priceNewAdult)/tour.priceAdult*100).toFixed(2))
    : 0;
  return tour;
};

module.exports.list=async(req,res)=>{
  const slug=req.params.slug;
  const category=await Category.findOne({
    slug,
    deleted:false,
    status:'active'
  });

  if(!category){
    return res.redirect('/');
  }

  const breadcrumb={
    image:category.avatar,
    title:category.name,
    list:[
      {
        link:'/',
        title:'Trang Chủ'
      }
    ]
  };

  if(category.parent){
    const parent=await Category.findOne({
      _id:category.parent,
      deleted:false,
      status:'active'
    });
    if(parent){
      breadcrumb.list.push({
        link:`/category/${parent.slug}`,
        title:parent.name
      });
    }
  }
  breadcrumb.list.push({
    link:`/category/${category.slug}`,
    title:category.name
  });

  const categoryFamily=await FamilyHelper.CategoriesFamily(category._id);
  const categoryIds=categoryFamily.map(item=>String(item));
  const find={
    category:{$in:categoryIds},
    deleted:false,
    status:'active'
  };
  const requestedSort=String(req.query.sort || '');
  const currentSort=VALID_SORTS.has(requestedSort) ? requestedSort : DEFAULT_SORT;
  const requestedPage=Number.parseInt(req.query.page,10);
  const page=Number.isInteger(requestedPage) && requestedPage>0 ? requestedPage : 1;
  const tourTotal=await Tour.countDocuments(find);
  const totalPages=Math.ceil(tourTotal/ITEMS_PER_PAGE);
  const currentPage=totalPages>0 ? Math.min(page,totalPages) : 1;
  const skip=(currentPage-1)*ITEMS_PER_PAGE;

  const createCategoryUrl=({sort=currentSort,page=1}={})=>{
    const params=new URLSearchParams();
    if(sort!==DEFAULT_SORT){
      params.set('sort',sort);
    }
    if(page>1){
      params.set('page',String(page));
    }
    const query=params.toString();
    return `/category/${category.slug}${query ? `?${query}` : ''}`;
  };

  const [tourList,cityList]=await Promise.all([
    Tour.aggregate(buildTourPipeline({find,sort:currentSort,skip})),
    City.find({})
  ]);

  res.render('client/pages/tour-list.pug',{
    pageTitle:'Danh sách tour',
    breadcrumb,
    category,
    tourList:tourList.map(formatTour),
    tourTotal,
    cityList,
    sortOptions:SORT_OPTIONS.map(option=>({
      ...option,
      active:option.value===currentSort,
      url:createCategoryUrl({sort:option.value})
    })),
    pagination:{
      currentPage,
      totalPages,
      pages:Array.from({length:totalPages},(_,index)=>({
        number:index+1,
        url:createCategoryUrl({page:index+1})
      })),
      previousUrl:currentPage>1
        ? createCategoryUrl({page:currentPage-1})
        : null,
      nextUrl:currentPage<totalPages
        ? createCategoryUrl({page:currentPage+1})
        : null
    }
  });
};
