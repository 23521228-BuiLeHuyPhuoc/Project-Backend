const {LRUCache}=require('lru-cache');

const DEFAULT_TTL_MS=20*60*1000;
const DEFAULT_MAX_ENTRIES=1000;

const normalizePositiveInteger=(value,fallback)=>{
  const number=Number(value);
  return Number.isInteger(number) && number>0 ? number : fallback;
};

const normalizeTag=value=>String(value || '').trim();

class RecommendationCacheManager{
  constructor(options={}){
    this.ttlMs=normalizePositiveInteger(
      options.ttlMs || process.env.RECOMMENDATION_CACHE_TTL_MS,
      DEFAULT_TTL_MS
    );
    this.maxEntries=normalizePositiveInteger(
      options.maxEntries || process.env.RECOMMENDATION_CACHE_MAX_ENTRIES,
      DEFAULT_MAX_ENTRIES
    );
    this.tagsByKey=new Map();
    this.keysByTag=new Map();
    this.inFlight=new Map();
    this.generation=0;
    this.metrics={
      hits:0,
      misses:0,
      sets:0,
      evictions:0,
      invalidations:0,
      coalesced:0
    };
    this.cache=new LRUCache({
      max:this.maxEntries,
      ttl:this.ttlMs,
      allowStale:false,
      updateAgeOnGet:false,
      dispose:(_value,key,reason)=>{
        this.removeTagIndexes(key);
        if(reason==='evict'){
          this.metrics.evictions+=1;
        }
      }
    });
  }

  createKey(scope,parts={}){
    const prefix=normalizeTag(scope);
    const entries=Object.entries(parts)
      .filter(([,value])=>value!==undefined && value!==null)
      .sort(([first],[second])=>first.localeCompare(second))
      .map(([name,value])=>
        `${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`
      );
    return [prefix,...entries].join('|');
  }

  removeTagIndexes(key){
    const tags=this.tagsByKey.get(key);
    if(!tags){
      return;
    }
    tags.forEach(tag=>{
      const keys=this.keysByTag.get(tag);
      if(!keys){
        return;
      }
      keys.delete(key);
      if(!keys.size){
        this.keysByTag.delete(tag);
      }
    });
    this.tagsByKey.delete(key);
  }

  registerTags(key,tags=[]){
    const normalized=new Set(
      tags.map(normalizeTag).filter(Boolean)
    );
    if(!normalized.size){
      return;
    }
    this.tagsByKey.set(key,normalized);
    normalized.forEach(tag=>{
      if(!this.keysByTag.has(tag)){
        this.keysByTag.set(tag,new Set());
      }
      this.keysByTag.get(tag).add(key);
    });
  }

  get(key){
    const value=this.cache.get(key);
    if(value===undefined){
      this.metrics.misses+=1;
      return undefined;
    }
    this.metrics.hits+=1;
    return value;
  }

  set(key,value,options={}){
    const ttl=normalizePositiveInteger(options.ttlMs,this.ttlMs);
    this.cache.set(key,value,{ttl});
    const tags=typeof options.tags==='function'
      ? options.tags(value)
      : options.tags;
    this.registerTags(key,Array.isArray(tags) ? tags : []);
    this.metrics.sets+=1;
    return value;
  }

  async remember(key,loader,options={}){
    const cached=this.cache.get(key);
    if(cached!==undefined){
      this.metrics.hits+=1;
      return {value:cached,status:'HIT'};
    }
    if(this.inFlight.has(key)){
      this.metrics.coalesced+=1;
      return {
        value:await this.inFlight.get(key),
        status:'COALESCED'
      };
    }
    this.metrics.misses+=1;
    const generation=this.generation;
    const loading=Promise.resolve()
      .then(loader)
      .then(value=>{
        if(generation===this.generation){
          this.set(key,value,options);
        }
        return value;
      })
      .finally(()=>{
        if(this.inFlight.get(key)===loading){
          this.inFlight.delete(key);
        }
      });
    this.inFlight.set(key,loading);
    return {value:await loading,status:'MISS'};
  }

  invalidateKey(key){
    this.generation+=1;
    this.inFlight.delete(key);
    const deleted=this.cache.delete(key);
    if(deleted){
      this.metrics.invalidations+=1;
    }
    return deleted;
  }

  invalidateTags(tags=[]){
    const normalized=[...new Set(tags.map(normalizeTag).filter(Boolean))];
    if(!normalized.length){
      return 0;
    }
    this.generation+=1;
    // New requests must not join work started before the invalidation signal.
    this.inFlight.clear();
    const keys=new Set();
    normalized.forEach(tag=>{
      const taggedKeys=this.keysByTag.get(tag);
      if(taggedKeys){
        taggedKeys.forEach(key=>keys.add(key));
      }
    });
    let deleted=0;
    keys.forEach(key=>{
      if(this.cache.delete(key)){
        deleted+=1;
      }
    });
    this.metrics.invalidations+=deleted;
    return deleted;
  }

  clear(){
    const size=this.cache.size;
    this.generation+=1;
    this.cache.clear();
    this.inFlight.clear();
    this.metrics.invalidations+=size;
    return size;
  }

  getStats(){
    const requests=this.metrics.hits+this.metrics.misses;
    return {
      ...this.metrics,
      size:this.cache.size,
      maxEntries:this.maxEntries,
      ttlMs:this.ttlMs,
      hitRate:requests>0 ? this.metrics.hits/requests : 0
    };
  }
}

const getRecommendationCacheFromApp=app=>{
  const locals=app && app.locals;
  if(!locals){
    return null;
  }
  if(locals.recommendationCache){
    return locals.recommendationCache;
  }
  const scheduler=locals.recommendationScheduler;
  return scheduler && typeof scheduler.getCacheManager==='function'
    ? scheduler.getCacheManager()
    : null;
};

const invalidateRecommendationCache=(app,options={})=>{
  const cache=getRecommendationCacheFromApp(app);
  if(!cache){
    return 0;
  }
  const tags=[];
  if(options.userId){
    tags.push(`user:${options.userId}`);
  }
  if(options.tourId){
    tags.push(`tour:${options.tourId}`);
  }
  (options.scopes || []).forEach(scope=>tags.push(`scope:${scope}`));
  return cache.invalidateTags(tags);
};

module.exports={
  DEFAULT_MAX_ENTRIES,
  DEFAULT_TTL_MS,
  RecommendationCacheManager,
  getRecommendationCacheFromApp,
  invalidateRecommendationCache
};
