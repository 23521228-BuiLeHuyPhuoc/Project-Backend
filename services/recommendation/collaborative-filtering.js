const Tour=require('../../models/tour.model');
const {isCandidateTour}=require('./content-based');
const {MatrixBuilder}=require('./matrix-builder');
const {MatrixFactorization}=require('./matrix-factorization');

const defaultModels={Tour};

const executeLean=query=>query && typeof query.lean==='function'
  ? query.lean()
  : query;

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

const createRecommendation=(tour,score)=>({
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

const buildSeenTourIds=matrixData=>{
  const seenByUser=new Map();
  const {rowPointers,columnIndices}=matrixData.matrix;
  matrixData.userIds.forEach((userId,row)=>{
    const tourIds=new Set();
    for(let index=rowPointers[row];index<rowPointers[row+1];index+=1){
      tourIds.add(getId(matrixData.tourIds[columnIndices[index]]));
    }
    seenByUser.set(getId(userId),tourIds);
  });
  return seenByUser;
};

class CollaborativeFilteringRecommender{
  constructor(options={}){
    this.models={...defaultModels,...(options.models || {})};
    this.matrixBuilder=options.matrixBuilder || new MatrixBuilder({
      models:options.models
    });
    this.factorization=options.factorization || new MatrixFactorization({
      algorithm:'als',
      ...(options.factorizationOptions || {})
    });
    this.minimumScore=Number.isFinite(options.minimumScore)
      ? options.minimumScore
      : 0;
    this.now=typeof options.now==='function' ? options.now : ()=>new Date();
    this.initialized=false;
    this.initializationPromise=null;
    this.matrixData=null;
    this.tours=[];
    this.candidateTours=[];
    this.tourMap=new Map();
    this.seenTourIdsByUser=new Map();
  }

  async train(matrixData=null){
    const [resolvedMatrix,tours]=await Promise.all([
      matrixData || this.matrixBuilder.build(),
      executeLean(this.models.Tour.find({deleted:false}))
    ]);
    this.factorization.fit(resolvedMatrix);
    this.matrixData=resolvedMatrix;
    this.tours=Array.isArray(tours) ? tours : [];
    this.tourMap=new Map(this.tours.map(tour=>[
      getId(tour._id),
      tour
    ]));
    this.candidateTours=this.tours.filter(tour=>
      this.factorization.tourIndex[getId(tour._id)]!==undefined
      && isCandidateTour(tour,this.now())
    );
    this.seenTourIdsByUser=buildSeenTourIds(resolvedMatrix);
    this.initialized=true;
    return this;
  }

  async initialize(matrixData=null){
    if(matrixData){
      return this.train(matrixData);
    }
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

  async getRecommendations(userId,options={}){
    await this.ensureInitialized();
    const id=getId(userId);
    if(!id || this.factorization.userIndex[id]===undefined){
      return [];
    }
    const limit=normalizeLimit(options.limit,10);
    const minimumScore=Number.isFinite(options.minimumScore)
      ? options.minimumScore
      : this.minimumScore;
    const seenTourIds=this.seenTourIdsByUser.get(id) || new Set();

    return this.candidateTours
      .filter(tour=>!seenTourIds.has(getId(tour._id)))
      .map(tour=>{
        const score=this.factorization.predict(id,getId(tour._id));
        return Number.isFinite(score)
          ? createRecommendation(tour,score)
          : null;
      })
      .filter(item=>item && item.score>minimumScore)
      .sort(compareRecommendations)
      .slice(0,limit);
  }

  getSeenTourIds(userId){
    const ids=this.seenTourIdsByUser.get(getId(userId));
    return new Set(ids || []);
  }

  hasUser(userId){
    return this.initialized
      && this.factorization.userIndex[getId(userId)]!==undefined;
  }

  getMetadata(){
    return {
      initialized:this.initialized,
      tours:this.tours.length,
      candidates:this.candidateTours.length,
      users:this.matrixData ? this.matrixData.shape[0] : 0,
      interactions:this.matrixData ? this.matrixData.stats.nonZero : 0,
      model:this.factorization.getMetadata()
    };
  }
}

module.exports={
  CollaborativeFilteringRecommender,
  buildSeenTourIds,
  compareRecommendations
};
