const assert=require('node:assert/strict');
const test=require('node:test');
const {
  ContentBasedRecommender,
  getRatingSignal
}=require('../../services/recommendation/content-based');

const createQuery=value=>({
  select(){
    return this;
  },
  lean(){
    return Promise.resolve(value);
  }
});

const createRecommender=rating=>{
  const tours=[
    {
      _id:'rated-tour',
      name:'Rated tour',
      status:'active',
      deleted:false,
      vector:[1,0]
    },
    {
      _id:'similar-tour',
      name:'Similar tour',
      status:'active',
      deleted:false,
      vector:[1,0]
    },
    {
      _id:'different-tour',
      name:'Different tour',
      status:'active',
      deleted:false,
      vector:[0,1]
    }
  ];
  const models={
    Tour:{find:()=>createQuery(tours)},
    Category:{find:()=>createQuery([])},
    City:{find:()=>createQuery([])},
    User:{
      findOne:()=>createQuery({_id:'user-1',preferences:{}})
    },
    UserInteraction:{
      find:()=>createQuery([
        {tourId:'rated-tour',type:'view',value:1},
        {tourId:'rated-tour',type:'cart_add',value:3}
      ])
    },
    Review:{
      find:()=>createQuery([{
        tourId:'rated-tour',
        rating
      }])
    },
    Favorite:{
      find:()=>createQuery([{tourId:'rated-tour'}])
    }
  };
  const extractor={
    fitTransform:items=>items.map(item=>item.vector),
    getMetadata:()=>({dimensions:2})
  };
  return new ContentBasedRecommender({models,extractor});
};

const createBehaviorRecommender=interactions=>{
  const tours=[
    {
      _id:'source-tour',
      name:'Source tour',
      status:'active',
      deleted:false,
      vector:[1,0]
    },
    {
      _id:'similar-tour',
      name:'Similar tour',
      status:'active',
      deleted:false,
      vector:[1,0]
    },
    {
      _id:'different-tour',
      name:'Different tour',
      status:'active',
      deleted:false,
      vector:[0,1]
    }
  ];
  const models={
    Tour:{find:()=>createQuery(tours)},
    Category:{find:()=>createQuery([])},
    City:{find:()=>createQuery([])},
    User:{findOne:()=>createQuery({_id:'user-1',preferences:{},cart:[]})},
    UserInteraction:{find:()=>createQuery(interactions)},
    Review:{find:()=>createQuery([])},
    Favorite:{find:()=>createQuery([])}
  };
  const extractor={
    fitTransform:items=>items.map(item=>item.vector),
    getMetadata:()=>({dimensions:2})
  };
  return new ContentBasedRecommender({models,extractor});
};

test('rating values are centered around neutral three stars',()=>{
  assert.deepEqual(getRatingSignal(1),{
    rating:1,
    direction:'negative',
    weight:2
  });
  assert.deepEqual(getRatingSignal(2),{
    rating:2,
    direction:'negative',
    weight:1
  });
  assert.deepEqual(getRatingSignal(3),{
    rating:3,
    direction:'neutral',
    weight:0
  });
  assert.deepEqual(getRatingSignal(4),{
    rating:4,
    direction:'positive',
    weight:1
  });
  assert.deepEqual(getRatingSignal(5),{
    rating:5,
    direction:'positive',
    weight:2
  });
});

for(const rating of [1,2]){
  test(`${rating}-star rating penalizes similar tours`,async()=>{
    const recommender=createRecommender(rating);
    const profile=await recommender.buildUserProfile('user-1');
    const recommendations=await recommender
      .getPersonalizedRecommendations('user-1');

    assert.equal(profile.positiveVector,null);
    assert.deepEqual(profile.negativeVector,[1,0]);
    assert.equal(profile.positiveBehaviorWeight,0);
    assert.equal(profile.negativeBehaviorWeight,3-rating);
    assert.deepEqual(
      recommendations.map(item=>item.tourId),
      ['different-tour']
    );
  });
}

test('3-star rating is neutral and overrides implicit signals',async()=>{
  const recommender=createRecommender(3);
  const profile=await recommender.buildUserProfile('user-1');
  const recommendations=await recommender
    .getPersonalizedRecommendations('user-1');

  assert.equal(profile.positiveVector,null);
  assert.equal(profile.negativeVector,null);
  assert.equal(profile.positiveBehaviorWeight,0);
  assert.equal(profile.negativeBehaviorWeight,0);
  assert.deepEqual(recommendations,[]);
});

for(const rating of [4,5]){
  test(`${rating}-star rating boosts similar tours`,async()=>{
    const recommender=createRecommender(rating);
    const profile=await recommender.buildUserProfile('user-1');
    const recommendations=await recommender
      .getPersonalizedRecommendations('user-1');

    assert.deepEqual(profile.positiveVector,[1,0]);
    assert.equal(profile.negativeVector,null);
    assert.equal(profile.positiveBehaviorWeight,rating-3);
    assert.equal(profile.negativeBehaviorWeight,0);
    assert.deepEqual(
      recommendations.map(item=>item.tourId),
      ['similar-tour']
    );
  });
}

test('recommendation clicks boost similar tours without hiding the clicked tour',
  async()=>{
    const recommender=createBehaviorRecommender([{
      tourId:'source-tour',
      type:'click_recommendation',
      value:2.5
    }]);
    const profile=await recommender.buildUserProfile('user-1');
    const recommendations=await recommender
      .getPersonalizedRecommendations('user-1');

    assert.equal(profile.excludedTourIds.has('source-tour'),false);
    assert.equal(profile.positiveBehaviorWeight,2.5);
    assert.deepEqual(
      recommendations.map(item=>item.tourId),
      ['similar-tour','source-tour']
    );
  });

test('ignored recommendations create a negative content profile',async()=>{
  const recommender=createBehaviorRecommender([{
    tourId:'source-tour',
    type:'recommendation_ignore',
    value:0
  }]);
  const profile=await recommender.buildUserProfile('user-1');
  const recommendations=await recommender
    .getPersonalizedRecommendations('user-1');

  assert.deepEqual(profile.negativeVector,[1,0]);
  assert.equal(profile.negativeBehaviorWeight,1);
  assert.deepEqual(
    recommendations.map(item=>item.tourId),
    ['different-tour']
  );
});
