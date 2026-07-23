const assert=require('node:assert/strict');
const test=require('node:test');
const {
  CollaborativeFilteringRecommender,
  buildSeenTourIds
}=require('../../services/recommendation/collaborative-filtering');

const createQuery=value=>({
  lean:()=>Promise.resolve(value)
});

const createFixture=()=>{
  const tourIds=[
    'seen-tour',
    'high-rated-tour',
    'low-rated-tour',
    'lower-score-tour',
    'deleted-tour',
    'inactive-tour',
    'expired-tour',
    'sold-out-tour',
    'zero-score-tour'
  ];
  const matrix={
    shape:[1,tourIds.length],
    userIds:['user-1'],
    tourIds,
    userIndex:{'user-1':0},
    tourIndex:Object.fromEntries(tourIds.map((id,index)=>[id,index])),
    matrix:{
      rowPointers:[0,1],
      columnIndices:[0],
      values:[5],
      sources:['order']
    },
    stats:{nonZero:1}
  };
  const futureDate=new Date('2030-01-01T00:00:00.000Z');
  const tours=[
    {
      _id:'seen-tour',
      status:'active',
      deleted:false,
      stockAdult:10,
      departureDate:futureDate
    },
    {
      _id:'high-rated-tour',
      status:'active',
      deleted:false,
      stockAdult:10,
      departureDate:futureDate,
      ratingAvg:4.8,
      ratingCount:100
    },
    {
      _id:'low-rated-tour',
      status:'active',
      deleted:false,
      stockAdult:10,
      departureDate:futureDate,
      ratingAvg:4.2,
      ratingCount:200
    },
    {
      _id:'lower-score-tour',
      status:'active',
      deleted:false,
      stockAdult:10,
      departureDate:futureDate,
      ratingAvg:5,
      ratingCount:300
    },
    {
      _id:'deleted-tour',
      status:'active',
      deleted:true,
      stockAdult:10,
      departureDate:futureDate
    },
    {
      _id:'inactive-tour',
      status:'inactive',
      deleted:false,
      stockAdult:10,
      departureDate:futureDate
    },
    {
      _id:'expired-tour',
      status:'active',
      deleted:false,
      stockAdult:10,
      departureDate:new Date('2025-01-01T00:00:00.000Z')
    },
    {
      _id:'sold-out-tour',
      status:'active',
      deleted:false,
      stockAdult:0,
      departureDate:futureDate
    },
    {
      _id:'zero-score-tour',
      status:'active',
      deleted:false,
      stockAdult:10,
      departureDate:futureDate
    },
    {
      _id:'tour-outside-model',
      status:'active',
      deleted:false,
      stockAdult:10,
      departureDate:futureDate
    }
  ];
  const scores={
    'seen-tour':5,
    'high-rated-tour':4,
    'low-rated-tour':4,
    'lower-score-tour':3,
    'deleted-tour':5,
    'inactive-tour':5,
    'expired-tour':5,
    'sold-out-tour':5,
    'zero-score-tour':0
  };
  let buildCount=0;
  let fitCount=0;
  const matrixBuilder={
    async build(){
      buildCount+=1;
      return matrix;
    }
  };
  const factorization={
    userIndex:{},
    tourIndex:{},
    fit(value){
      fitCount+=1;
      this.userIndex=value.userIndex;
      this.tourIndex=value.tourIndex;
      return this;
    },
    predict(userId,tourId){
      if(this.userIndex[userId]===undefined
        || this.tourIndex[tourId]===undefined){
        return null;
      }
      return scores[tourId] || 0;
    },
    getMetadata(){
      return {trained:fitCount>0,stats:{algorithm:'als'}};
    }
  };
  const recommender=new CollaborativeFilteringRecommender({
    models:{Tour:{find:()=>createQuery(tours)}},
    matrixBuilder,
    factorization,
    now:()=>new Date('2026-07-23T00:00:00.000Z')
  });
  return {
    matrix,
    recommender,
    getBuildCount:()=>buildCount,
    getFitCount:()=>fitCount
  };
};

test('recommendations exclude seen and unavailable tours',async()=>{
  const fixture=createFixture();
  const [first,second]=await Promise.all([
    fixture.recommender.getRecommendations('user-1'),
    fixture.recommender.getRecommendations('user-1')
  ]);

  const expected=[
    'high-rated-tour',
    'low-rated-tour',
    'lower-score-tour'
  ];
  assert.deepEqual(first.map(item=>item.tourId),expected);
  assert.deepEqual(second.map(item=>item.tourId),expected);
  assert.equal(fixture.getBuildCount(),1);
  assert.equal(fixture.getFitCount(),1);
  assert.deepEqual(
    [...fixture.recommender.getSeenTourIds('user-1')],
    ['seen-tour']
  );
});

test('ranking uses rating as a tie breaker and respects limit',async()=>{
  const {recommender}=createFixture();
  const recommendations=await recommender.getRecommendations('user-1',{
    limit:2
  });

  assert.deepEqual(
    recommendations.map(item=>item.tourId),
    ['high-rated-tour','low-rated-tour']
  );
  assert.deepEqual(recommendations.map(item=>item.score),[4,4]);
});

test('cold-start users and scores below the threshold return no results',
  async()=>{
    const {recommender}=createFixture();

    assert.deepEqual(
      await recommender.getRecommendations('unknown-user'),
      []
    );
    assert.deepEqual(
      await recommender.getRecommendations('user-1',{minimumScore:4}),
      []
    );
    assert.equal(recommender.hasUser('user-1'),true);
    assert.equal(recommender.hasUser('unknown-user'),false);
  });

test('seen tour IDs are read directly from CSR rows',()=>{
  const {matrix}=createFixture();
  const seenByUser=buildSeenTourIds(matrix);

  assert.deepEqual([...seenByUser.get('user-1')],['seen-tour']);
});
