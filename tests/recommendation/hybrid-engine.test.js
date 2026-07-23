const assert=require('node:assert/strict');
const test=require('node:test');
const {
  HybridRecommendationEngine,
  buildPopularityRecommendations,
  hasUserPreferences,
  selectHybridWeights
}=require('../../services/recommendation/hybrid-engine');

const createQuery=value=>({
  select(){
    return this;
  },
  lean(){
    return Promise.resolve(value);
  }
});

test('dynamic weights match all documented user groups',()=>{
  assert.deepEqual(selectHybridWeights({authenticated:false}),{
    strategy:'anonymous',
    content:0.1,
    collaborative:0,
    popularity:0.9
  });
  assert.deepEqual(selectHybridWeights({
    authenticated:true,
    hasPreferences:true,
    interactionCount:0
  }),{
    strategy:'new_with_preferences',
    content:0.6,
    collaborative:0.1,
    popularity:0.3
  });
  assert.deepEqual(selectHybridWeights({
    authenticated:true,
    hasPreferences:false,
    interactionCount:0
  }),{
    strategy:'new_without_preferences',
    content:0.2,
    collaborative:0.1,
    popularity:0.7
  });
  assert.deepEqual(selectHybridWeights({
    authenticated:true,
    hasPreferences:false,
    interactionCount:5
  }),{
    strategy:'active',
    content:0.4,
    collaborative:0.4,
    popularity:0.2
  });
  assert.deepEqual(selectHybridWeights({
    authenticated:true,
    hasPreferences:true,
    interactionCount:20
  }),{
    strategy:'established',
    content:0.2,
    collaborative:0.7,
    popularity:0.1
  });
});

test('preference detection supports tour type, location, and budget',()=>{
  assert.equal(hasUserPreferences({preferences:{}}),false);
  assert.equal(hasUserPreferences({
    preferences:{tourTypes:['beach']}
  }),true);
  assert.equal(hasUserPreferences({
    preferences:{locations:['da-nang']}
  }),true);
  assert.equal(hasUserPreferences({
    preferences:{budgetRange:{min:1000000,max:0}}
  }),true);
});

test('popularity score normalizes metrics and filters unavailable tours',()=>{
  const futureDate=new Date('2030-01-01T00:00:00.000Z');
  const tours=[
    {
      _id:'tour-a',
      status:'active',
      deleted:false,
      stockAdult:10,
      departureDate:futureDate,
      ratingAvg:5,
      ratingCount:1
    },
    {
      _id:'tour-b',
      status:'active',
      deleted:false,
      stockAdult:10,
      departureDate:futureDate,
      ratingAvg:4,
      ratingCount:100
    },
    {
      _id:'inactive-tour',
      status:'inactive',
      deleted:false,
      stockAdult:10,
      departureDate:futureDate
    }
  ];
  const recommendations=buildPopularityRecommendations({
    tours,
    purchaseCounts:new Map([['tour-a',1],['tour-b',20]]),
    now:new Date('2026-07-23T00:00:00.000Z'),
    weights:{
      ratingAvg:0,
      ratingCount:0,
      favorites:0,
      purchases:1,
      views:0
    }
  });

  assert.deepEqual(
    recommendations.map(item=>item.tourId),
    ['tour-b','tour-a']
  );
  assert.equal(recommendations[0].score,1);
  assert.ok(recommendations[1].score>0);
  assert.ok(recommendations.every(item=>item.score>=0 && item.score<=1));
});

const createHybridFixture=({interactionCount=25,preferences={}}={})=>{
  const tours={
    a:{_id:'tour-a',ratingAvg:4},
    b:{_id:'tour-b',ratingAvg:5},
    c:{_id:'tour-c',ratingAvg:3},
    d:{_id:'tour-d',ratingAvg:4.5}
  };
  const calls={
    contentInitialize:0,
    contentRecommend:0,
    collaborativeTrain:0,
    collaborativeRecommend:0,
    popularityRefresh:0,
    popularityRecommend:0,
    interactionAggregate:0
  };
  const contentRecommender={
    async initialize(){
      calls.contentInitialize+=1;
      return this;
    },
    async getPersonalizedRecommendations(){
      calls.contentRecommend+=1;
      return [
        {tourId:'tour-a',score:1,tour:tours.a},
        {tourId:'tour-b',score:0.2,tour:tours.b}
      ];
    },
    getMetadata:()=>({initialized:true})
  };
  const collaborativeRecommender={
    factorization:{maxValue:5},
    async train(){
      calls.collaborativeTrain+=1;
      return this;
    },
    async getRecommendations(){
      calls.collaborativeRecommend+=1;
      return [
        {tourId:'tour-a',score:1,tour:tours.a},
        {tourId:'tour-b',score:5,tour:tours.b}
      ];
    },
    getSeenTourIds:()=>new Set(['tour-d']),
    getMetadata:()=>({initialized:true})
  };
  const popularityRecommender={
    async refresh(){
      calls.popularityRefresh+=1;
      return this;
    },
    async getRecommendations(){
      calls.popularityRecommend+=1;
      return [
        {tourId:'tour-a',score:0.1,tour:tours.a},
        {tourId:'tour-b',score:1,tour:tours.b},
        {tourId:'tour-c',score:0.8,tour:tours.c},
        {tourId:'tour-d',score:1,tour:tours.d}
      ];
    },
    getMetadata:()=>({initialized:true})
  };
  const models={
    User:{
      findOne:()=>createQuery({
        _id:'user-1',
        preferences
      })
    },
    UserInteraction:{
      aggregate:()=>{
        calls.interactionAggregate+=1;
        return Promise.resolve([{
          _id:'user-1',
          count:interactionCount
        }]);
      }
    }
  };
  const engine=new HybridRecommendationEngine({
    models,
    contentRecommender,
    collaborativeRecommender,
    popularityRecommender
  });
  return {engine,calls};
};

test('hybrid ranking favors collaborative score for established users',
  async()=>{
    const {engine,calls}=createHybridFixture({interactionCount:25});
    const [first,second]=await Promise.all([
      engine.getRecommendations('user-1'),
      engine.getRecommendations('user-1')
    ]);

    assert.deepEqual(
      first.map(item=>item.tourId),
      ['tour-b','tour-a','tour-c']
    );
    assert.deepEqual(second.map(item=>item.tourId),
      first.map(item=>item.tourId));
    assert.equal(first[0].score,0.84);
    assert.deepEqual(first[0].components,{
      content:0.2,
      collaborative:1,
      popularity:1
    });
    assert.equal(first[0].weights.strategy,'established');
    assert.equal(calls.contentInitialize,1);
    assert.equal(calls.collaborativeTrain,1);
    assert.equal(calls.popularityRefresh,1);
    assert.equal(calls.interactionAggregate,1);
  });

test('anonymous recommendations use popularity without login engines',
  async()=>{
    const {engine,calls}=createHybridFixture();
    const recommendations=await engine.getRecommendations(null,{limit:2});

    assert.equal(recommendations.length,2);
    assert.ok(recommendations.every(item=>
      item.weights.strategy==='anonymous'
      && item.components.content===0
      && item.components.collaborative===0));
    assert.equal(calls.contentRecommend,0);
    assert.equal(calls.collaborativeRecommend,0);
    assert.equal(calls.popularityRecommend,1);
  });

test('new users with preferences receive content-heavy weights',async()=>{
  const {engine}=createHybridFixture({
    interactionCount:0,
    preferences:{tourTypes:['beach']}
  });
  const weights=await engine.getWeightsForUser('user-1');

  assert.deepEqual(weights,{
    strategy:'new_with_preferences',
    content:0.6,
    collaborative:0.1,
    popularity:0.3
  });
});
