const fs=require('node:fs/promises');
const path=require('node:path');
const UserInteraction=require('../../models/user-interaction.model');
const {RecommendationCacheManager}=require('./cache-manager');
const {HybridRecommendationEngine}=require('./hybrid-engine');
const {MatrixFactorization}=require('./matrix-factorization');

const ARTIFACT_VERSION=1;
const DEFAULT_INTERVAL_HOURS=6;
const DEFAULT_CHECK_INTERVAL_MS=60*1000;
const DEFAULT_INTERACTION_THRESHOLD=100;
const DEFAULT_PRECISION_K=10;
const trainableInteractionTypes=[
  'view',
  'favorite',
  'cart_add',
  'purchase',
  'rating',
  'click_recommendation'
];

const normalizePositiveNumber=(value,fallback)=>{
  const number=Number(value);
  return Number.isFinite(number) && number>0 ? number : fallback;
};

const normalizePositiveInteger=(value,fallback)=>{
  const number=Number.parseInt(value,10);
  return Number.isInteger(number) && number>0 ? number : fallback;
};

const executeCount=query=>query && typeof query.exec==='function'
  ? query.exec()
  : query;

const calculateModelMetrics=(matrixData,factorization,options={})=>{
  if(!matrixData || !factorization || !factorization.trained){
    throw new TypeError('A trained factorization model is required.');
  }
  const precisionK=normalizePositiveInteger(
    options.precisionK,
    DEFAULT_PRECISION_K
  );
  const relevanceThreshold=normalizePositiveNumber(
    options.relevanceThreshold,
    4
  );
  const {rowPointers,columnIndices,values}=matrixData.matrix;
  const [userCount,tourCount]=matrixData.shape;
  let squaredError=0;
  let absoluteError=0;
  let observations=0;
  let precisionTotal=0;
  let usersEvaluated=0;

  for(let user=0;user<userCount;user+=1){
    const relevantTours=new Set();
    for(let index=rowPointers[user];index<rowPointers[user+1];index+=1){
      const tour=columnIndices[index];
      const actual=Number(values[index]);
      const prediction=factorization.predictByIndex(user,tour);
      if(Number.isFinite(prediction)){
        const error=actual-prediction;
        squaredError+=error*error;
        absoluteError+=Math.abs(error);
        observations+=1;
      }
      if(actual>=relevanceThreshold){
        relevantTours.add(tour);
      }
    }
    if(!relevantTours.size || !tourCount){
      continue;
    }
    const topK=Array.from({length:tourCount},(_,tour)=>({
      tour,
      score:factorization.predictByIndex(user,tour) || 0
    }))
      .sort((first,second)=>second.score-first.score
        || first.tour-second.tour)
      .slice(0,Math.min(precisionK,tourCount));
    const hits=topK.reduce((total,item)=>
      total+(relevantTours.has(item.tour) ? 1 : 0),0);
    precisionTotal+=hits/topK.length;
    usersEvaluated+=1;
  }

  return {
    rmse:observations>0 ? Math.sqrt(squaredError/observations) : 0,
    mae:observations>0 ? absoluteError/observations : 0,
    precisionAtK:usersEvaluated>0 ? precisionTotal/usersEvaluated : 0,
    precisionK,
    relevanceThreshold,
    observations,
    usersEvaluated
  };
};

class RecommendationTrainingScheduler{
  constructor(options={}){
    const intervalHours=normalizePositiveNumber(
      options.intervalHours
        || process.env.RECOMMENDATION_TRAIN_INTERVAL_HOURS,
      DEFAULT_INTERVAL_HOURS
    );
    this.intervalMs=normalizePositiveNumber(
      options.intervalMs || process.env.RECOMMENDATION_TRAIN_INTERVAL_MS,
      intervalHours*60*60*1000
    );
    this.checkIntervalMs=normalizePositiveNumber(
      options.checkIntervalMs
        || process.env.RECOMMENDATION_TRAIN_CHECK_INTERVAL_MS,
      DEFAULT_CHECK_INTERVAL_MS
    );
    this.interactionThreshold=normalizePositiveInteger(
      options.interactionThreshold
        || process.env.RECOMMENDATION_RETRAIN_THRESHOLD,
      DEFAULT_INTERACTION_THRESHOLD
    );
    this.precisionK=normalizePositiveInteger(
      options.precisionK || process.env.RECOMMENDATION_PRECISION_K,
      DEFAULT_PRECISION_K
    );
    this.modelPath=path.resolve(
      options.modelPath
        || process.env.RECOMMENDATION_MODEL_PATH
        || path.join('data','recommendation-model.json')
    );
    this.models={
      UserInteraction,
      ...(options.models || {})
    };
    this.engine=options.engine || new HybridRecommendationEngine({
      models:options.models,
      factorizationOptions:options.factorizationOptions,
      popularityWeights:options.popularityWeights
    });
    this.cacheManager=options.cacheManager
      || new RecommendationCacheManager(options.cacheOptions);
    this.logger=options.logger || console;
    this.now=typeof options.now==='function' ? options.now : ()=>new Date();
    this.setInterval=options.setInterval || global.setInterval;
    this.clearInterval=options.clearInterval || global.clearInterval;
    this.running=false;
    this.timer=null;
    this.startPromise=null;
    this.trainingPromise=null;
    this.lastTrainedAt=null;
    this.lastInteractionCount=0;
    this.metrics=null;
    this.lastReason=null;
  }

  log(level,message,data){
    const writer=this.logger[level] || this.logger.log;
    if(typeof writer==='function'){
      writer.call(this.logger,message,data || '');
    }
  }

  async getInteractionCount(){
    const count=await executeCount(
      this.models.UserInteraction.countDocuments({
        userId:{$ne:null},
        tourId:{$ne:null},
        type:{$in:trainableInteractionTypes}
      })
    );
    return Math.max(0,Number(count) || 0);
  }

  async saveArtifact(){
    const collaborative=this.engine.collaborative;
    if(!collaborative || !collaborative.matrixData
      || !collaborative.factorization
      || !collaborative.factorization.trained){
      throw new Error('Collaborative model is not ready to be persisted.');
    }
    const artifact={
      version:ARTIFACT_VERSION,
      savedAt:this.now().toISOString(),
      lastTrainedAt:this.lastTrainedAt,
      lastInteractionCount:this.lastInteractionCount,
      lastReason:this.lastReason,
      metrics:this.metrics,
      matrixData:collaborative.matrixData,
      factorization:collaborative.factorization.toJSON()
    };
    await fs.mkdir(path.dirname(this.modelPath),{recursive:true});
    const temporaryPath=`${this.modelPath}.${process.pid}.${Date.now()}.tmp`;
    try{
      await fs.writeFile(temporaryPath,JSON.stringify(artifact),'utf8');
      try{
        await fs.rename(temporaryPath,this.modelPath);
      }catch(error){
        if(!['EEXIST','EPERM'].includes(error.code)){
          throw error;
        }
        await fs.rm(this.modelPath,{force:true});
        await fs.rename(temporaryPath,this.modelPath);
      }
    }catch(error){
      await fs.rm(temporaryPath,{force:true}).catch(()=>{});
      throw error;
    }
    return artifact;
  }

  async restore(){
    let content;
    try{
      content=await fs.readFile(this.modelPath,'utf8');
    }catch(error){
      if(error.code==='ENOENT'){
        return false;
      }
      throw error;
    }
    const artifact=JSON.parse(content);
    if(!artifact || artifact.version!==ARTIFACT_VERSION
      || !artifact.matrixData || !artifact.factorization){
      throw new TypeError('Invalid recommendation model artifact.');
    }
    const factorization=MatrixFactorization.fromJSON(
      artifact.factorization
    );
    await this.engine.restore(artifact.matrixData,factorization);
    this.cacheManager.clear();
    this.lastTrainedAt=artifact.lastTrainedAt || artifact.savedAt || null;
    this.lastInteractionCount=Math.max(
      0,
      Number(artifact.lastInteractionCount) || 0
    );
    this.lastReason=artifact.lastReason || 'restored';
    this.metrics=artifact.metrics || null;
    this.log('info','Recommendation model restored',{
      modelPath:this.modelPath,
      lastTrainedAt:this.lastTrainedAt,
      metrics:this.metrics
    });
    return true;
  }

  async performTraining(reason){
    const startedAt=Date.now();
    await this.engine.train();
    this.cacheManager.clear();
    const collaborative=this.engine.collaborative;
    this.metrics=calculateModelMetrics(
      collaborative.matrixData,
      collaborative.factorization,
      {precisionK:this.precisionK}
    );
    this.lastInteractionCount=await this.getInteractionCount();
    this.lastTrainedAt=this.now().toISOString();
    this.lastReason=reason;
    await this.saveArtifact();
    const durationMs=Date.now()-startedAt;
    this.log('info','Recommendation model trained',{
      reason,
      durationMs,
      interactions:this.lastInteractionCount,
      metrics:this.metrics
    });
    return {
      reason,
      durationMs,
      interactions:this.lastInteractionCount,
      metrics:{...this.metrics}
    };
  }

  async train(reason='manual'){
    if(!this.trainingPromise){
      this.trainingPromise=this.performTraining(reason)
        .finally(()=>{
          this.trainingPromise=null;
        });
    }
    return this.trainingPromise;
  }

  isModelStale(){
    if(!this.lastTrainedAt){
      return true;
    }
    const trainedAt=new Date(this.lastTrainedAt).getTime();
    return !Number.isFinite(trainedAt)
      || this.now().getTime()-trainedAt>=this.intervalMs;
  }

  async checkForRetraining(){
    if(!this.lastTrainedAt){
      await this.train('missing_model');
      return 'missing_model';
    }
    const interactionCount=await this.getInteractionCount();
    const newInteractions=Math.max(
      0,
      interactionCount-this.lastInteractionCount
    );
    if(newInteractions>=this.interactionThreshold){
      await this.train('interaction_threshold');
      return 'interaction_threshold';
    }
    if(this.isModelStale()){
      await this.train('scheduled_interval');
      return 'scheduled_interval';
    }
    return null;
  }

  async performStart(options={}){
    this.running=true;
    try{
      let restored=false;
      if(options.restore!==false){
        try{
          restored=await this.restore();
        }catch(error){
          this.log('warn','Recommendation model restore failed',{
            message:error.message
          });
        }
      }
      if(options.trainOnStart!==false
        && (!restored || this.isModelStale())){
        await this.train(restored ? 'stale_model' : 'startup');
      }
      this.timer=this.setInterval(()=>{
        this.checkForRetraining().catch(error=>{
          this.log('error','Recommendation retraining check failed',{
            message:error.message
          });
        });
      },this.checkIntervalMs);
      if(this.timer && typeof this.timer.unref==='function'){
        this.timer.unref();
      }
      return this;
    }catch(error){
      this.running=false;
      throw error;
    }
  }

  async start(options={}){
    if(!this.startPromise){
      if(this.running){
        return this;
      }
      this.startPromise=this.performStart(options)
        .finally(()=>{
          this.startPromise=null;
        });
    }
    return this.startPromise;
  }

  stop(){
    if(this.timer){
      this.clearInterval(this.timer);
      this.timer=null;
    }
    this.running=false;
  }

  getEngine(){
    return this.engine;
  }

  getCacheManager(){
    return this.cacheManager;
  }

  getStatus(){
    return {
      running:this.running,
      training:Boolean(this.trainingPromise),
      modelPath:this.modelPath,
      intervalMs:this.intervalMs,
      checkIntervalMs:this.checkIntervalMs,
      interactionThreshold:this.interactionThreshold,
      lastTrainedAt:this.lastTrainedAt,
      lastInteractionCount:this.lastInteractionCount,
      lastReason:this.lastReason,
      metrics:this.metrics ? {...this.metrics} : null,
      cache:this.cacheManager.getStats()
    };
  }
}

let defaultScheduler=null;

const getRecommendationScheduler=()=>{
  if(!defaultScheduler){
    defaultScheduler=new RecommendationTrainingScheduler();
  }
  return defaultScheduler;
};

const startRecommendationScheduler=options=>
  getRecommendationScheduler().start(options);

const stopRecommendationScheduler=()=>{
  if(defaultScheduler){
    defaultScheduler.stop();
  }
};

module.exports={
  RecommendationTrainingScheduler,
  calculateModelMetrics,
  getRecommendationScheduler,
  startRecommendationScheduler,
  stopRecommendationScheduler
};
