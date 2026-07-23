const assert=require('node:assert/strict');
const express=require('express');
const test=require('node:test');
const recommendationRoutes=require(
  '../../routes/client/recommendation.route'
);
const {
  RecommendationCacheManager
}=require('../../services/recommendation/cache-manager');

const ids={
  user:'64b000000000000000000001',
  source:'64b000000000000000000002',
  first:'64b000000000000000000003',
  second:'64b000000000000000000004'
};

const createRecommendation=(tourId,score,ratingAvg=4,ratingCount=10)=>({
  tourId,
  score,
  components:{content:score,collaborative:score,popularity:score},
  weights:{
    strategy:'active',
    content:0.4,
    collaborative:0.4,
    popularity:0.2
  },
  tour:{
    _id:tourId,
    name:`Tour ${tourId.slice(-1)}`,
    slug:`tour-${tourId.slice(-1)}`,
    priceAdult:1000000,
    priceNewAdult:800000,
    stockAdult:10,
    ratingAvg,
    ratingCount
  }
});

const startApi=async options=>{
  const feedbackRecords=[];
  const recommendations=[
    createRecommendation(ids.first,0.8,4.5,20),
    createRecommendation(ids.second,0.6,5,5)
  ];
  const engine={
    initialized:true,
    async ensureInitialized(){},
    async getRecommendations(userId,{limit}){
      engine.lastUserId=userId;
      engine.personalizedCalls=(engine.personalizedCalls || 0)+1;
      return recommendations.slice(0,limit);
    },
    async getWeightsForUser(userId){
      return {
        strategy:userId ? 'active' : 'anonymous',
        content:userId ? 0.4 : 0.1,
        collaborative:userId ? 0.4 : 0,
        popularity:userId ? 0.2 : 0.9
      };
    },
    content:{
      tourMap:new Map([[ids.source,{_id:ids.source}]]),
      async getSimilarTours(tourId,{limit}){
        engine.lastSimilarTourId=tourId;
        engine.similarCalls=(engine.similarCalls || 0)+1;
        return recommendations.slice(0,limit);
      }
    },
    popularity:{
      async getRecommendations({limit}={}){
        engine.popularityCalls=(engine.popularityCalls || 0)+1;
        return Number.isInteger(limit)
          ? recommendations.slice(0,limit)
          : recommendations;
      }
    }
  };
  const app=express();
  app.use(express.json());
  app.use((req,res,next)=>{
    req.session={};
    req.sessionID='anonymous_session_123456';
    if(req.get('x-test-user')==='authenticated'){
      req.user={id:ids.user};
    }
    next();
  });
  app.locals.recommendationScheduler={
    getEngine:()=>engine,
    getStatus:()=>({lastTrainedAt:'2026-07-23T00:00:00.000Z'})
  };
  const cacheManager=new RecommendationCacheManager({
    ttlMs:60*1000,
    maxEntries:50
  });
  app.locals.recommendationCache=cacheManager;
  app.locals.recommendationModels={
    Tour:{exists:()=>Promise.resolve(true)},
    UserInteraction:{
      async create(record){
        if(options && options.duplicateFeedback){
          const error=new Error('duplicate');
          error.code=11000;
          throw error;
        }
        feedbackRecords.push(record);
        return record;
      }
    }
  };
  app.use('/api/recommendation',recommendationRoutes);
  const server=app.listen(0);
  await new Promise(resolve=>server.once('listening',resolve));
  return {
    cacheManager,
    engine,
    feedbackRecords,
    baseUrl:`http://127.0.0.1:${server.address().port}/api/recommendation`,
    close:()=>new Promise(resolve=>server.close(resolve))
  };
};

test('personalized API uses optional user and serializes Hybrid scores',
  async t=>{
    const api=await startApi();
    t.after(api.close);
    const response=await fetch(`${api.baseUrl}/personalized?limit=1`,{
      headers:{'x-test-user':'authenticated'}
    });
    const payload=await response.json();

    assert.equal(response.status,200);
    assert.equal(payload.data.personalized,true);
    assert.equal(payload.data.strategy,'active');
    assert.equal(payload.data.count,1);
    assert.match(payload.data.requestId,/^[a-f0-9-]{36}$/);
    assert.equal(payload.data.recommendations[0].position,0);
    assert.equal(payload.data.recommendations[0].score,0.8);
    assert.equal(payload.data.recommendations[0].tour.discount,20);
    assert.equal(api.engine.lastUserId,ids.user);
    assert.match(response.headers.get('cache-control'),/private/);
  });

test('anonymous personalized API falls back through the Hybrid Engine',
  async t=>{
    const api=await startApi();
    t.after(api.close);
    const response=await fetch(`${api.baseUrl}/personalized?limit=2`);
    const payload=await response.json();

    assert.equal(payload.data.personalized,false);
    assert.equal(payload.data.count,2);
    assert.equal(api.engine.lastUserId,null);
  });

test('personalized API caches calculations and keeps request IDs unique',
  async t=>{
    const api=await startApi();
    t.after(api.close);
    const request=()=>fetch(`${api.baseUrl}/personalized?limit=1`,{
      headers:{'x-test-user':'authenticated'}
    });
    const firstResponse=await request();
    const first=await firstResponse.json();
    const secondResponse=await request();
    const second=await secondResponse.json();

    assert.equal(firstResponse.headers.get('x-recommendation-cache'),'MISS');
    assert.equal(secondResponse.headers.get('x-recommendation-cache'),'HIT');
    assert.equal(api.engine.personalizedCalls,1);
    assert.notEqual(first.data.requestId,second.data.requestId);

    await fetch(`${api.baseUrl}/feedback`,{
      method:'POST',
      headers:{
        'content-type':'application/json',
        'x-test-user':'authenticated'
      },
      body:JSON.stringify({
        eventId:'feedback_cache_invalidation_1234',
        requestId:first.data.requestId,
        tourId:ids.first,
        action:'click',
        position:0,
        source:'home',
        pagePath:'/',
        scores:{final:0.8,content:0.8,collaborative:0.8,popularity:0.8}
      })
    });
    const thirdResponse=await request();

    assert.equal(thirdResponse.headers.get('x-recommendation-cache'),'MISS');
    assert.equal(api.engine.personalizedCalls,2);
  });

test('similar, trending, and top-rated APIs use their dedicated engines',
  async t=>{
    const api=await startApi();
    t.after(api.close);
    const [similarResponse,trendingResponse,topRatedResponse,badResponse]=
      await Promise.all([
        fetch(`${api.baseUrl}/similar/${ids.source}?limit=1`),
        fetch(`${api.baseUrl}/trending?limit=1`),
        fetch(`${api.baseUrl}/top-rated?limit=2`),
        fetch(`${api.baseUrl}/similar/not-an-id`)
      ]);
    const similar=await similarResponse.json();
    const trending=await trendingResponse.json();
    const topRated=await topRatedResponse.json();

    assert.equal(similar.data.count,1);
    assert.equal(similar.data.sourceTourId,ids.source);
    assert.equal(trending.data.algorithm,'popularity');
    assert.equal(trending.data.count,1);
    assert.equal(topRated.data.algorithm,'top_rated');
    assert.deepEqual(
      topRated.data.recommendations.map(item=>item.tourId),
      [ids.second,ids.first]
    );
    assert.equal(badResponse.status,400);
  });

test('feedback stores click and ignore as separate interaction types',
  async t=>{
    const api=await startApi();
    t.after(api.close);
    const basePayload={
      requestId:'request_1234567890',
      tourId:ids.first,
      position:1,
      source:'home',
      pagePath:'/',
      scores:{final:0.8,content:0.7,collaborative:0.9,popularity:0.6}
    };
    const clickResponse=await fetch(`${api.baseUrl}/feedback`,{
      method:'POST',
      headers:{
        'content-type':'application/json',
        'x-test-user':'authenticated',
        'x-device-type':'mobile'
      },
      body:JSON.stringify({
        ...basePayload,
        eventId:'feedback_click_123456',
        action:'click'
      })
    });
    const ignoreResponse=await fetch(`${api.baseUrl}/feedback`,{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({
        ...basePayload,
        eventId:'feedback_ignore_12345',
        action:'ignore'
      })
    });

    assert.equal(clickResponse.status,201);
    assert.equal(ignoreResponse.status,201);
    assert.equal(api.feedbackRecords[0].type,'click_recommendation');
    assert.equal(api.feedbackRecords[0].value,2.5);
    assert.equal(api.feedbackRecords[0].metadata.deviceType,'mobile');
    assert.equal(api.feedbackRecords[1].type,'recommendation_ignore');
    assert.equal(api.feedbackRecords[1].value,0);
    assert.equal(api.feedbackRecords[1].sessionId,'anonymous_session_123456');
  });

test('feedback validation rejects malformed events and accepts duplicates',
  async t=>{
    const api=await startApi({duplicateFeedback:true});
    t.after(api.close);
    const invalidResponse=await fetch(`${api.baseUrl}/feedback`,{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({action:'click',tourId:'bad'})
    });
    const duplicateResponse=await fetch(`${api.baseUrl}/feedback`,{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({
        eventId:'feedback_duplicate_1234',
        requestId:'request_1234567890',
        tourId:ids.first,
        action:'click'
      })
    });
    const duplicate=await duplicateResponse.json();

    assert.equal(invalidResponse.status,400);
    assert.equal(duplicateResponse.status,200);
    assert.equal(duplicate.accepted,0);
    assert.equal(duplicate.duplicate,true);
  });
