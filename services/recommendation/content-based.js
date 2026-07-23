const Category=require('../../models/category.model');
const City=require('../../models/city.model');
const Favorite=require('../../models/favorite.model');
const Review=require('../../models/review.model');
const Tour=require('../../models/tour.model');
const User=require('../../models/user.model');
const UserInteraction=require('../../models/user-interaction.model');
const {
  FeatureExtractor,
  cosineSimilarity,
  getTourPrice,
  normalizeText
}=require('./feature-extractor');

const defaultModels={
  Category,
  City,
  Favorite,
  Review,
  Tour,
  User,
  UserInteraction
};

const interactionWeights={
  view:1,
  favorite:2,
  cart_add:3,
  purchase:5,
  click_recommendation:2.5
};

const tourTypeKeywords={
  beach:[
    'bien',
    'dao',
    'nha trang',
    'phu quoc',
    'vung tau',
    'quy nhon',
    'da nang',
    'ha long'
  ],
  mountain:[
    'nui',
    'rung',
    'sapa',
    'sa pa',
    'da lat',
    'moc chau',
    'ha giang',
    'tay bac',
    'fansipan'
  ],
  city:[
    'thanh pho',
    'city',
    'ha noi',
    'sai gon',
    'ho chi minh',
    'da nang'
  ],
  culture:[
    'van hoa',
    'di san',
    'lich su',
    'chua',
    'co do',
    'hoi an',
    'hue'
  ],
  adventure:[
    'phieu luu',
    'mao hiem',
    'trekking',
    'leo nui',
    'kham pha'
  ]
};

const dateKeyFormatter=new Intl.DateTimeFormat('en-US',{
  timeZone:'Asia/Ho_Chi_Minh',
  year:'numeric',
  month:'2-digit',
  day:'2-digit'
});

const executeLean=(query,selection='')=>{
  let current=query;
  if(selection && current && typeof current.select==='function'){
    current=current.select(selection);
  }
  return current && typeof current.lean==='function'
    ? current.lean()
    : current;
};

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

const getDateKey=value=>{
  const date=value instanceof Date ? value : new Date(value);
  if(Number.isNaN(date.getTime())){
    return 0;
  }
  const parts=Object.fromEntries(dateKeyFormatter.formatToParts(date)
    .filter(part=>part.type!=='literal')
    .map(part=>[part.type,Number(part.value)]));
  return parts.year*10000+parts.month*100+parts.day;
};

const isCandidateTour=(tour,now)=>{
  if(!tour || tour.deleted || tour.status!=='active'){
    return false;
  }
  const stockAdult=Number(tour.stockAdult);
  if(Number.isFinite(stockAdult) && stockAdult<=0){
    return false;
  }
  if(tour.departureDate && getDateKey(tour.departureDate)<getDateKey(now)){
    return false;
  }
  return true;
};

const normalizeLimit=(value,fallback)=>{
  const number=Number.parseInt(value,10);
  return Number.isInteger(number) && number>0
    ? Math.min(number,50)
    : fallback;
};

const weightedAverage=entries=>{
  const validEntries=entries.filter(entry=>
    entry
    && Array.isArray(entry.vector)
    && Number.isFinite(entry.weight)
    && entry.weight>0
  );
  if(!validEntries.length){
    return null;
  }
  const dimensions=validEntries[0].vector.length;
  const vector=Array(dimensions).fill(0);
  let totalWeight=0;

  validEntries.forEach(entry=>{
    if(entry.vector.length!==dimensions){
      throw new RangeError('Profile vectors must have the same dimensions.');
    }
    totalWeight+=entry.weight;
    entry.vector.forEach((value,index)=>{
      vector[index]+=(Number(value) || 0)*entry.weight;
    });
  });
  return {
    vector:vector.map(value=>value/totalWeight),
    totalWeight
  };
};

const getRatingSignal=value=>{
  const rating=Number(value);
  if(!Number.isFinite(rating) || rating<1 || rating>5){
    return null;
  }
  const normalizedRating=Math.min(5,Math.max(1,rating));
  const signedWeight=normalizedRating-3;
  return {
    rating:normalizedRating,
    direction:signedWeight>0
      ? 'positive'
      : signedWeight<0
        ? 'negative'
        : 'neutral',
    weight:Math.abs(signedWeight)
  };
};

const getInteractionWeight=interaction=>{
  if(interaction.type==='rating'){
    const signal=getRatingSignal(interaction.value);
    return signal ? signal.rating : 0;
  }
  return interactionWeights[interaction.type] || 0;
};

const addSignal=(signalMap,tourId,type,weight)=>{
  const id=getId(tourId);
  if(!id || !Number.isFinite(weight) || weight<=0){
    return;
  }
  if(!signalMap.has(id)){
    signalMap.set(id,new Map());
  }
  const tourSignals=signalMap.get(id);
  tourSignals.set(type,Math.max(tourSignals.get(type) || 0,weight));
};

const getRecommendationResult=(tour,score)=>({
  tourId:getId(tour._id),
  score:Number(score.toFixed(6)),
  tour
});

const compareRecommendations=(first,second)=>{
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

class ContentBasedRecommender{
  constructor(options={}){
    this.models={...defaultModels,...(options.models || {})};
    this.preferenceWeight=Number.isFinite(options.preferenceWeight)
      ? Math.max(0,options.preferenceWeight)
      : 4;
    this.negativePenalty=Number.isFinite(options.negativePenalty)
      ? Math.max(0,options.negativePenalty)
      : 1;
    this.now=typeof options.now==='function' ? options.now : ()=>new Date();
    this.extractor=options.extractor || new FeatureExtractor();
    this.initialized=false;
    this.tours=[];
    this.candidateTours=[];
    this.tourMap=new Map();
    this.vectorMap=new Map();
    this.categoryMap=new Map();
    this.cityMap=new Map();
  }

  async initialize(){
    const [tours,categories,cities]=await Promise.all([
      executeLean(this.models.Tour.find({deleted:false})),
      executeLean(
        this.models.Category.find({deleted:false}),
        '_id name slug'
      ),
      executeLean(this.models.City.find({}),'_id name')
    ]);
    this.tours=Array.isArray(tours) ? tours : [];
    this.categoryMap=new Map((categories || []).map(category=>[
      getId(category._id),
      category
    ]));
    this.cityMap=new Map((cities || []).map(city=>[
      getId(city._id),
      city
    ]));
    const vectors=this.extractor.fitTransform(this.tours);
    this.tourMap=new Map();
    this.vectorMap=new Map();
    this.tours.forEach((tour,index)=>{
      const id=getId(tour._id);
      this.tourMap.set(id,tour);
      this.vectorMap.set(id,vectors[index]);
    });
    const now=this.now();
    this.candidateTours=this.tours.filter(tour=>isCandidateTour(tour,now));
    this.initialized=true;
    return this;
  }

  async ensureInitialized(){
    if(!this.initialized){
      await this.initialize();
    }
  }

  async getSimilarTours(tourId,options={}){
    await this.ensureInitialized();
    const id=getId(tourId);
    const sourceVector=this.vectorMap.get(id);
    if(!sourceVector){
      return [];
    }
    const limit=normalizeLimit(options.limit,6);

    return this.candidateTours
      .filter(tour=>getId(tour._id)!==id)
      .map(tour=>getRecommendationResult(
        tour,
        cosineSimilarity(sourceVector,this.vectorMap.get(getId(tour._id)))
      ))
      .filter(item=>item.score>0)
      .sort(compareRecommendations)
      .slice(0,limit);
  }

  getTourText(tour){
    const category=this.categoryMap.get(getId(tour.category));
    return normalizeText([
      tour.name,
      tour.slug,
      category && category.name,
      category && category.slug
    ].filter(Boolean).join(' '));
  }

  getTourTypes(tour){
    const text=this.getTourText(tour);
    return new Set(Object.entries(tourTypeKeywords)
      .filter(([,keywords])=>keywords.some(keyword=>text.includes(keyword)))
      .map(([type])=>type));
  }

  getTourLocationKeys(tour){
    const keys=new Set();
    (Array.isArray(tour.locations) ? tour.locations : []).forEach(locationId=>{
      const rawId=getId(locationId);
      if(rawId){
        keys.add(normalizeText(rawId));
      }
      const city=this.cityMap.get(rawId);
      if(city && city.name){
        keys.add(normalizeText(city.name).replace(/[^a-z0-9]+/g,'-'));
      }
    });
    return keys;
  }

  buildPreferenceProfile(user){
    const preferences=user && user.preferences ? user.preferences : {};
    const tourTypes=Array.isArray(preferences.tourTypes)
      ? preferences.tourTypes.map(normalizeText).filter(Boolean)
      : [];
    const locations=Array.isArray(preferences.locations)
      ? preferences.locations.map(location=>normalizeText(location)
        .replace(/[^a-z0-9]+/g,'-')).filter(Boolean)
      : [];
    const budget=preferences.budgetRange || {};
    const budgetMinimum=Number(budget.min) || 0;
    const budgetMaximum=Number(budget.max) || 0;
    const hasBudget=budgetMinimum>0 || budgetMaximum>0;

    if(!tourTypes.length && !locations.length && !hasBudget){
      return null;
    }

    const entries=[];
    this.tours.forEach(tour=>{
      let score=0;
      const types=this.getTourTypes(tour);
      const typeMatches=tourTypes.filter(type=>types.has(type)).length;
      score+=typeMatches*2;

      if(locations.length){
        const tourLocations=this.getTourLocationKeys(tour);
        const tourText=this.getTourText(tour);
        const matchesLocation=locations.some(location=>
          tourLocations.has(location)
          || tourText.includes(normalizeText(location.replace(/-/g,' ')))
        );
        if(matchesLocation){
          score+=2;
        }
      }

      if(hasBudget){
        const price=getTourPrice(tour);
        const aboveMinimum=price>=budgetMinimum;
        const belowMaximum=budgetMaximum<=0 || price<=budgetMaximum;
        if(aboveMinimum && belowMaximum){
          score+=1;
        }
      }

      if(score>0){
        entries.push({
          vector:this.vectorMap.get(getId(tour._id)),
          weight:score
        });
      }
    });
    return weightedAverage(entries);
  }

  async buildUserProfile(userId){
    await this.ensureInitialized();
    const [user,interactions,reviews,favorites]=await Promise.all([
      executeLean(this.models.User.findOne({
        _id:userId,
        status:'active',
        deleted:false
      }),'preferences'),
      executeLean(this.models.UserInteraction.find({userId}),
        'tourId type value'),
      executeLean(this.models.Review.find({userId,deleted:false}),
        'tourId rating'),
      executeLean(this.models.Favorite.find({userId}),'tourId')
    ]);
    if(!user){
      return null;
    }

    const signalMap=new Map();
    const explicitRatings=new Map();
    const interactedTourIds=new Set();
    (interactions || []).forEach(interaction=>{
      const tourId=getId(interaction.tourId);
      if(!tourId){
        return;
      }
      interactedTourIds.add(tourId);
      if(interaction.type==='rating'){
        const ratingSignal=getRatingSignal(interaction.value);
        if(ratingSignal){
          explicitRatings.set(tourId,ratingSignal);
        }
        return;
      }
      addSignal(
        signalMap,
        tourId,
        interaction.type,
        getInteractionWeight(interaction)
      );
    });
    (reviews || []).forEach(review=>{
      const tourId=getId(review.tourId);
      if(!tourId){
        return;
      }
      interactedTourIds.add(tourId);
      const ratingSignal=getRatingSignal(review.rating);
      if(ratingSignal){
        explicitRatings.set(tourId,ratingSignal);
      }
    });
    (favorites || []).forEach(favorite=>{
      const tourId=getId(favorite.tourId);
      if(!tourId){
        return;
      }
      interactedTourIds.add(tourId);
      addSignal(signalMap,tourId,'favorite',interactionWeights.favorite);
    });

    const positiveBehaviorEntries=[];
    const negativeBehaviorEntries=[];
    const profileTourIds=new Set([
      ...signalMap.keys(),
      ...explicitRatings.keys()
    ]);
    profileTourIds.forEach(tourId=>{
      const vector=this.vectorMap.get(tourId);
      if(!vector){
        return;
      }
      const ratingSignal=explicitRatings.get(tourId);
      if(ratingSignal){
        if(ratingSignal.direction==='positive'){
          positiveBehaviorEntries.push({
            vector,
            weight:ratingSignal.weight
          });
        }else if(ratingSignal.direction==='negative'){
          negativeBehaviorEntries.push({
            vector,
            weight:ratingSignal.weight
          });
        }
        return;
      }
      const signals=signalMap.get(tourId);
      const weight=[...signals.values()].reduce((total,value)=>total+value,0);
      positiveBehaviorEntries.push({vector,weight});
    });
    const positiveBehaviorProfile=weightedAverage(positiveBehaviorEntries);
    const negativeBehaviorProfile=weightedAverage(negativeBehaviorEntries);
    const preferenceProfile=this.buildPreferenceProfile(user);
    const positiveProfileEntries=[];
    if(positiveBehaviorProfile){
      positiveProfileEntries.push({
        vector:positiveBehaviorProfile.vector,
        weight:positiveBehaviorProfile.totalWeight
      });
    }
    if(preferenceProfile && this.preferenceWeight>0){
      positiveProfileEntries.push({
        vector:preferenceProfile.vector,
        weight:this.preferenceWeight
      });
    }
    const positiveProfile=weightedAverage(positiveProfileEntries);

    return {
      // Keep vector as an alias for callers written before negative profiles.
      vector:positiveProfile ? positiveProfile.vector : null,
      positiveVector:positiveProfile ? positiveProfile.vector : null,
      negativeVector:negativeBehaviorProfile
        ? negativeBehaviorProfile.vector
        : null,
      interactedTourIds,
      behaviorWeight:positiveBehaviorProfile
        ? positiveBehaviorProfile.totalWeight
        : 0,
      positiveBehaviorWeight:positiveBehaviorProfile
        ? positiveBehaviorProfile.totalWeight
        : 0,
      negativeBehaviorWeight:negativeBehaviorProfile
        ? negativeBehaviorProfile.totalWeight
        : 0,
      preferenceWeight:preferenceProfile ? this.preferenceWeight : 0
    };
  }

  async getPersonalizedRecommendations(userId,options={}){
    const profile=await this.buildUserProfile(userId);
    if(!profile || (!profile.positiveVector && !profile.negativeVector)){
      return [];
    }
    const limit=normalizeLimit(options.limit,10);

    return this.candidateTours
      .filter(tour=>!profile.interactedTourIds.has(getId(tour._id)))
      .map(tour=>{
        const candidateVector=this.vectorMap.get(getId(tour._id));
        const positiveScore=profile.positiveVector
          ? cosineSimilarity(profile.positiveVector,candidateVector)
          : 1;
        const negativeScore=profile.negativeVector
          ? cosineSimilarity(profile.negativeVector,candidateVector)
          : 0;
        return getRecommendationResult(
          tour,
          positiveScore-this.negativePenalty*negativeScore
        );
      })
      .filter(item=>item.score>0)
      .sort(compareRecommendations)
      .slice(0,limit);
  }

  getMetadata(){
    return {
      initialized:this.initialized,
      tours:this.tours.length,
      candidates:this.candidateTours.length,
      featureSpace:this.initialized ? this.extractor.getMetadata() : null
    };
  }
}

module.exports={
  ContentBasedRecommender,
  getInteractionWeight,
  getRatingSignal,
  isCandidateTour,
  weightedAverage
};
