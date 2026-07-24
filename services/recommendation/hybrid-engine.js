const Favorite=require('../../models/favorite.model');
const Order=require('../../models/order.model');
const Tour=require('../../models/tour.model');
const User=require('../../models/user.model');
const UserInteraction=require('../../models/user-interaction.model');
const {
  ContentBasedRecommender,
  isCandidateTour
}=require('./content-based');
const {
  CollaborativeFilteringRecommender
}=require('./collaborative-filtering');

const defaultModels={
  Favorite,
  Order,
  Tour,
  User,
  UserInteraction
};

const profileInteractionTypes=[
  'view',
  'favorite',
  'cart_add',
  'purchase',
  'rating',
  'click_recommendation'
];

const excludedRecommendationTypes=[
  'purchase',
  'click_recommendation'
];

const defaultPopularityWeights={
  ratingAvg:0.35,
  ratingCount:0.15,
  favorites:0.15,
  purchases:0.25,
  views:0.1
};

const hybridStrategies={
  anonymous:{preference:0,content:0.05,collaborative:0,popularity:0.95},
  newWithPreferences:{
    preference:0.45,
    content:0.4,
    collaborative:0.05,
    popularity:0.1
  },
  newWithoutPreferences:{
    preference:0,
    content:0.2,
    collaborative:0.15,
    popularity:0.65
  },
  activeWithPreferences:{
    preference:0.35,
    content:0.35,
    collaborative:0.2,
    popularity:0.1
  },
  activeWithoutPreferences:{
    preference:0,
    content:0.25,
    collaborative:0.5,
    popularity:0.25
  },
  establishedWithPreferences:{
    preference:0.3,
    content:0.3,
    collaborative:0.3,
    popularity:0.1
  },
  establishedWithoutPreferences:{
    preference:0,
    content:0.15,
    collaborative:0.7,
    popularity:0.15
  }
};

const executeLean=(query,selection='')=>{
  let current=query;
  if(selection && current && typeof current.select==='function'){
    current=current.select(selection);
  }
  return current && typeof current.lean==='function'
    ? current.lean()
    : current;
};

const executeAggregate=aggregate=>aggregate
  && typeof aggregate.exec==='function'
  ? aggregate.exec()
  : aggregate;

const getId=value=>{
  if(value===null || value===undefined){
    return '';
  }
  if(typeof value.toHexString==='function'){
    return value.toHexString();
  }
  if(Buffer.isBuffer(value)){
    return value.toString('hex');
  }
  if(typeof value==='object'){
    return getId(value._id || value.id || '');
  }
  return String(value);
};

const normalizeLimit=(value,fallback)=>{
  const number=Number.parseInt(value,10);
  return Number.isInteger(number) && number>0
    ? Math.min(number,50)
    : fallback;
};

const clamp01=value=>Math.min(1,Math.max(0,Number(value) || 0));

const normalizeWeights=(weights,defaults)=>{
  const normalized={};
  let total=0;
  Object.keys(defaults).forEach(key=>{
    const value=Number(weights && weights[key]);
    normalized[key]=Number.isFinite(value) && value>=0
      ? value
      : defaults[key];
    total+=normalized[key];
  });
  if(total<=0){
    return {...defaults};
  }
  Object.keys(normalized).forEach(key=>{
    normalized[key]/=total;
  });
  return normalized;
};

const countRecordsToMap=records=>new Map((records || []).map(record=>[
  getId(record._id),
  Math.max(0,Number(record.count) || 0)
]));

const getCount=(counts,id)=>counts instanceof Map
  ? counts.get(id) || 0
  : Number(counts && counts[id]) || 0;

const logNormalize=(value,maximum)=>maximum>0
  ? Math.log1p(Math.max(0,value))/Math.log1p(maximum)
  : 0;

const comparePopularity=(first,second)=>{
  if(second.score!==first.score){
    return second.score-first.score;
  }
  const ratingDifference=Number(second.tour.ratingAvg || 0)
    -Number(first.tour.ratingAvg || 0);
  if(ratingDifference!==0){
    return ratingDifference;
  }
  const countDifference=Number(second.tour.ratingCount || 0)
    -Number(first.tour.ratingCount || 0);
  if(countDifference!==0){
    return countDifference;
  }
  return first.tourId.localeCompare(second.tourId);
};

const buildPopularityRecommendations=({
  tours,
  favoriteCounts=new Map(),
  purchaseCounts=new Map(),
  viewCounts=new Map(),
  now=new Date(),
  weights=defaultPopularityWeights
})=>{
  const normalizedWeights=normalizeWeights(weights,defaultPopularityWeights);
  const candidates=(Array.isArray(tours) ? tours : [])
    .filter(tour=>isCandidateTour(tour,now));
  const rawMetrics=candidates.map(tour=>{
    const tourId=getId(tour._id);
    return {
      tour,
      tourId,
      ratingAvg:Math.min(5,Math.max(0,Number(tour.ratingAvg) || 0)),
      ratingCount:Math.max(0,Number(tour.ratingCount) || 0),
      favorites:getCount(favoriteCounts,tourId),
      purchases:getCount(purchaseCounts,tourId),
      views:getCount(viewCounts,tourId)
    };
  });
  const maxima=rawMetrics.reduce((result,metrics)=>({
    ratingCount:Math.max(result.ratingCount,metrics.ratingCount),
    favorites:Math.max(result.favorites,metrics.favorites),
    purchases:Math.max(result.purchases,metrics.purchases),
    views:Math.max(result.views,metrics.views)
  }),{ratingCount:0,favorites:0,purchases:0,views:0});

  return rawMetrics.map(metrics=>{
    const normalized={
      ratingAvg:metrics.ratingAvg/5,
      ratingCount:logNormalize(metrics.ratingCount,maxima.ratingCount),
      favorites:logNormalize(metrics.favorites,maxima.favorites),
      purchases:logNormalize(metrics.purchases,maxima.purchases),
      views:logNormalize(metrics.views,maxima.views)
    };
    const score=Object.keys(normalizedWeights).reduce((total,key)=>
      total+normalizedWeights[key]*normalized[key],0);
    return {
      tourId:metrics.tourId,
      score:Number(score.toFixed(6)),
      metrics:{
        ratingAvg:metrics.ratingAvg,
        ratingCount:metrics.ratingCount,
        favorites:metrics.favorites,
        purchases:metrics.purchases,
        views:metrics.views
      },
      normalized,
      tour:metrics.tour
    };
  }).sort(comparePopularity);
};

const hasUserPreferences=user=>{
  const preferences=user && user.preferences ? user.preferences : {};
  const budget=preferences.budgetRange || {};
  return (Array.isArray(preferences.tourTypes)
      && preferences.tourTypes.length>0)
    || (Array.isArray(preferences.locations)
      && preferences.locations.length>0)
    || Number(budget.min)>0
    || Number(budget.max)>0;
};

const selectHybridWeights=context=>{
  if(!context || !context.authenticated){
    return {strategy:'anonymous',...hybridStrategies.anonymous};
  }
  const interactionCount=Math.max(0,Number(context.interactionCount) || 0);
  if(interactionCount>=20){
    return context.hasPreferences
      ? {
        strategy:'established_with_preferences',
        ...hybridStrategies.establishedWithPreferences
      }
      : {
        strategy:'established_without_preferences',
        ...hybridStrategies.establishedWithoutPreferences
      };
  }
  if(interactionCount>=5){
    return context.hasPreferences
      ? {
        strategy:'active_with_preferences',
        ...hybridStrategies.activeWithPreferences
      }
      : {
        strategy:'active_without_preferences',
        ...hybridStrategies.activeWithoutPreferences
      };
  }
  if(context.hasPreferences){
    return {
      strategy:'new_with_preferences',
      ...hybridStrategies.newWithPreferences
    };
  }
  return {
    strategy:'new_without_preferences',
    ...hybridStrategies.newWithoutPreferences
  };
};

class PopularityRecommender{
  constructor(options={}){
    this.models={...defaultModels,...(options.models || {})};
    this.weights=normalizeWeights(
      options.weights,
      defaultPopularityWeights
    );
    this.now=typeof options.now==='function' ? options.now : ()=>new Date();
    this.initialized=false;
    this.initializationPromise=null;
    this.recommendations=[];
  }

  async refresh(){
    const [tours,favorites,purchases,views]=await Promise.all([
      executeLean(this.models.Tour.find({deleted:false})),
      executeAggregate(this.models.Favorite.aggregate([
        {$group:{_id:'$tourId',count:{$sum:1}}}
      ])),
      executeAggregate(this.models.Order.aggregate([
        {$match:{status:'completed',deleted:false}},
        {$unwind:'$items'},
        {$match:{'items.tourId':{$ne:null}}},
        {$group:{_id:'$items.tourId',count:{$sum:1}}}
      ])),
      executeAggregate(this.models.UserInteraction.aggregate([
        {$match:{type:'view',tourId:{$ne:null}}},
        {$group:{_id:'$tourId',count:{$sum:1}}}
      ]))
    ]);
    this.recommendations=buildPopularityRecommendations({
      tours,
      favoriteCounts:countRecordsToMap(favorites),
      purchaseCounts:countRecordsToMap(purchases),
      viewCounts:countRecordsToMap(views),
      now:this.now(),
      weights:this.weights
    });
    this.initialized=true;
    return this;
  }

  async initialize(){
    await this.ensureInitialized();
    return this;
  }

  async ensureInitialized(){
    if(this.initialized){
      return;
    }
    if(!this.initializationPromise){
      this.initializationPromise=this.refresh()
        .finally(()=>{
          this.initializationPromise=null;
        });
    }
    await this.initializationPromise;
  }

  async getRecommendations(options={}){
    await this.ensureInitialized();
    const limit=normalizeLimit(options.limit,this.recommendations.length);
    return this.recommendations.slice(0,limit);
  }

  getMetadata(){
    return {
      initialized:this.initialized,
      candidates:this.recommendations.length,
      weights:{...this.weights}
    };
  }
}

const compareHybridRecommendations=(first,second)=>{
  const retainedDifference=Number(second.retained
    && second.retained.priority || 0)
    -Number(first.retained && first.retained.priority || 0);
  if(retainedDifference!==0){
    return retainedDifference;
  }
  const preferenceDifference=Number(second.preference
    && second.preference.priority || 0)
    -Number(first.preference && first.preference.priority || 0);
  if(preferenceDifference!==0){
    return preferenceDifference;
  }
  if(second.score!==first.score){
    return second.score-first.score;
  }
  if(second.components.popularity!==first.components.popularity){
    return second.components.popularity-first.components.popularity;
  }
  const ratingDifference=Number(second.tour.ratingAvg || 0)
    -Number(first.tour.ratingAvg || 0);
  if(ratingDifference!==0){
    return ratingDifference;
  }
  return first.tourId.localeCompare(second.tourId);
};

const backfillRecommendations=(preferred,ranked,limit)=>{
  const selected=[];
  const selectedTourIds=new Set();
  [...preferred,...ranked].forEach(item=>{
    if(!item || selectedTourIds.has(item.tourId) || selected.length>=limit){
      return;
    }
    selected.push(item);
    selectedTourIds.add(item.tourId);
  });
  return selected;
};

class HybridRecommendationEngine{
  constructor(options={}){
    this.models={...defaultModels,...(options.models || {})};
    this.content=options.contentRecommender
      || new ContentBasedRecommender({
        models:options.models,
        now:options.now
      });
    this.collaborative=options.collaborativeRecommender
      || new CollaborativeFilteringRecommender({
        models:options.models,
        now:options.now,
        factorizationOptions:options.factorizationOptions
      });
    this.popularity=options.popularityRecommender
      || new PopularityRecommender({
        models:options.models,
        now:options.now,
        weights:options.popularityWeights
      });
    this.minimumScore=Number.isFinite(options.minimumScore)
      ? options.minimumScore
      : 0;
    this.initialized=false;
    this.initializationPromise=null;
    this.interactionCounts=new Map();
  }

  async refreshInteractionCounts(){
    const records=await executeAggregate(this.models.UserInteraction.aggregate([
      {$match:{
        userId:{$ne:null},
        tourId:{$ne:null},
        type:{$in:profileInteractionTypes}
      }},
      {$group:{
        _id:{userId:'$userId',tourId:'$tourId',type:'$type'}
      }},
      {$group:{_id:'$_id.userId',count:{$sum:1}}}
    ]));
    this.interactionCounts=countRecordsToMap(records);
    return this.interactionCounts;
  }

  async train(){
    await Promise.all([
      this.content.initialize(),
      this.collaborative.train(),
      this.popularity.refresh(),
      this.refreshInteractionCounts()
    ]);
    this.initialized=true;
    return this;
  }

  async restore(matrixData,factorization){
    await Promise.all([
      this.content.initialize(),
      this.collaborative.restore(matrixData,factorization),
      this.popularity.refresh(),
      this.refreshInteractionCounts()
    ]);
    this.initialized=true;
    return this;
  }

  async initialize(){
    await this.ensureInitialized();
    return this;
  }

  async ensureInitialized(){
    if(this.initialized){
      return;
    }
    if(!this.initializationPromise){
      this.initializationPromise=this.train()
        .finally(()=>{
          this.initializationPromise=null;
        });
    }
    await this.initializationPromise;
  }

  async getUserContext(userId){
    const id=getId(userId);
    if(!id){
      return {
        userId:null,
        authenticated:false,
        hasPreferences:false,
        interactionCount:0,
        preferences:null,
        retainedTours:new Map()
      };
    }
    const [user,favorites]=await Promise.all([
      executeLean(this.models.User.findOne({
        _id:id,
        status:'active',
        deleted:false
      }),'preferences cart.tourId'),
      executeLean(this.models.Favorite.find({userId:id}),'tourId')
    ]);
    if(!user){
      return {
        userId:null,
        authenticated:false,
        hasPreferences:false,
        interactionCount:0,
        preferences:null,
        retainedTours:new Map()
      };
    }
    const retainedTours=new Map();
    (favorites || []).forEach(item=>{
      const tourId=getId(item.tourId);
      if(tourId){
        retainedTours.set(tourId,{
          favorite:true,
          cart:false,
          priority:1
        });
      }
    });
    (user.cart || []).forEach(item=>{
      const tourId=getId(item.tourId);
      if(!tourId){
        return;
      }
      retainedTours.set(tourId,{
        favorite:Boolean(retainedTours.get(tourId)?.favorite),
        cart:true,
        priority:2
      });
    });
    return {
      userId:id,
      authenticated:true,
      hasPreferences:hasUserPreferences(user),
      interactionCount:this.interactionCounts.get(id) || 0,
      preferences:user.preferences || null,
      retainedTours
    };
  }

  async getLiveExcludedTourIds(userId,retainedTourIds=[]){
    const id=getId(userId);
    if(!id){
      return new Set();
    }
    const interactions=await executeLean(this.models.UserInteraction.find({
      userId:id,
      tourId:{$ne:null},
      type:{$in:excludedRecommendationTypes}
    }),'tourId type');
    const retainedIds=new Set([...retainedTourIds].map(getId).filter(Boolean));
    const excludedTourIds=new Set();
    (interactions || []).forEach(interaction=>{
      const tourId=getId(interaction.tourId);
      if(!tourId){
        return;
      }
      if(interaction.type==='purchase' || !retainedIds.has(tourId)){
        excludedTourIds.add(tourId);
      }
    });
    return excludedTourIds;
  }

  async getWeightsForUser(userId){
    await this.ensureInitialized();
    return selectHybridWeights(await this.getUserContext(userId));
  }

  async getRecommendations(userId,options={}){
    await this.ensureInitialized();
    const context=await this.getUserContext(userId);
    const weights=selectHybridWeights(context);
    const limit=normalizeLimit(options.limit,10);
    const candidateLimit=Math.min(50,Math.max(20,limit*4));
    const [
      contentResults,
      collaborativeResults,
      popularityResults,
      liveExcludedTourIds
    ]=
      await Promise.all([
        context.authenticated
          ? this.content.getPersonalizedRecommendations(context.userId,{
            limit:candidateLimit
          })
          : [],
        context.authenticated
          ? this.collaborative.getRecommendations(context.userId,{
            limit:candidateLimit
          })
          : [],
        this.popularity.getRecommendations(),
        context.authenticated
          ? this.getLiveExcludedTourIds(
            context.userId,
            context.retainedTours.keys()
          )
          : new Set()
      ]);

    const contentScores=new Map(contentResults.map(item=>[
      item.tourId,
      clamp01(item.score)
    ]));
    const collaborativeScale=Math.max(
      1,
      Number(this.collaborative.factorization
        && this.collaborative.factorization.maxValue) || 5
    );
    const collaborativeScores=new Map(collaborativeResults.map(item=>[
      item.tourId,
      clamp01(item.score/collaborativeScale)
    ]));
    const popularityScores=new Map(popularityResults.map(item=>[
      item.tourId,
      clamp01(item.score)
    ]));
    const candidateMap=new Map();
    [...popularityResults,...contentResults,...collaborativeResults]
      .forEach(item=>{
        if(item && item.tour && item.tourId){
          candidateMap.set(item.tourId,item.tour);
        }
      });
    const seenTourIds=new Set(liveExcludedTourIds);
    const minimumScore=Number.isFinite(options.minimumScore)
      ? options.minimumScore
      : this.minimumScore;
    const excludedTourIds=new Set((Array.isArray(options.excludeTourIds)
      ? options.excludeTourIds
      : [options.excludeTourIds])
      .map(getId)
      .filter(Boolean));

    const rankedRecommendations=[...candidateMap.entries()]
      .filter(([tourId])=>
        !seenTourIds.has(tourId) && !excludedTourIds.has(tourId)
      )
      .map(([tourId,tour])=>{
        const preference=context.hasPreferences
          && typeof this.content.getPreferenceCompatibility==='function'
          ? this.content.getPreferenceCompatibility(tour,context.preferences)
          : null;
        const components={
          retained:context.retainedTours.has(tourId) ? 1 : 0,
          preference:preference ? preference.score : 0,
          content:contentScores.get(tourId) || 0,
          collaborative:collaborativeScores.get(tourId) || 0,
          popularity:popularityScores.get(tourId) || 0
        };
        const retained=context.retainedTours.get(tourId) || null;
        const baseScore=weights.preference*components.preference
          +weights.content*components.content
          +weights.collaborative*components.collaborative
          +weights.popularity*components.popularity;
        const score=Math.min(
          1,
          baseScore+(retained ? retained.cart ? 0.2 : 0.12 : 0)
        );
        return {
          tourId,
          score:Number(score.toFixed(6)),
          components,
          preference,
          retained,
          weights:{...weights},
          tour
        };
      })
      .filter(item=>item.score>=minimumScore)
      .sort(compareHybridRecommendations);
    const budgetRelevant=context.hasPreferences
      ? rankedRecommendations.filter(item=>
        item.retained
        || !item.preference
        || !item.preference.provided.budget
        || item.preference.budgetMatch
        || item.preference.budgetScore>=0.3
      )
      : rankedRecommendations;
    return backfillRecommendations(
      budgetRelevant,
      rankedRecommendations,
      limit
    );
  }

  getMetadata(){
    return {
      initialized:this.initialized,
      usersWithInteractions:this.interactionCounts.size,
      content:this.content.getMetadata(),
      collaborative:this.collaborative.getMetadata(),
      popularity:this.popularity.getMetadata()
    };
  }
}

module.exports={
  backfillRecommendations,
  HybridRecommendationEngine,
  PopularityRecommender,
  buildPopularityRecommendations,
  hasUserPreferences,
  selectHybridWeights
};
