const test=require('node:test');
const assert=require('node:assert/strict');

const {
  ContentBasedRecommender,
  getBudgetCompatibility
}=require('../../services/recommendation/content-based');
const {FeatureExtractor}=require('../../services/recommendation/feature-extractor');
const {
  backfillRecommendations,
  selectHybridWeights
}=require('../../services/recommendation/hybrid-engine');

const createContentRecommender=()=>{
  const recommender=new ContentBasedRecommender();
  recommender.categoryMap=new Map();
  recommender.cityMap=new Map([
    ['departure-da-nang',{_id:'departure-da-nang',name:'Da Nang'}]
  ]);
  return recommender;
};

test('departure city is not treated as a preferred destination',()=>{
  const recommender=createContentRecommender();
  const compatibility=recommender.getPreferenceCompatibility({
    name:'Singapore - Malacca - Kuala Lumpur',
    category:'',
    locations:['departure-da-nang'],
    priceNewAdult:3500000
  },{
    locations:['da-nang']
  });

  assert.equal(compatibility.locationMatch,false);
});

test('destination name and budget produce an exact preference match',()=>{
  const recommender=createContentRecommender();
  const compatibility=recommender.getPreferenceCompatibility({
    name:'Da Nang - Hoi An Heritage',
    category:'',
    locations:[],
    priceNewAdult:4500000
  },{
    tourTypes:['culture'],
    locations:['da-nang'],
    budgetRange:{min:2000000,max:5000000}
  });

  assert.equal(compatibility.locationMatch,true);
  assert.equal(compatibility.typeMatch,true);
  assert.equal(compatibility.budgetMatch,true);
  assert.equal(compatibility.score,1);
  assert.equal(compatibility.priority,7);
});

test('far outside budget is strongly penalized',()=>{
  const compatibility=getBudgetCompatibility(23990000,{
    min:2000000,
    max:5000000
  });

  assert.equal(compatibility.match,false);
  assert.ok(compatibility.score<0.01);
});

test('generic island wording does not classify every island as a beach tour',()=>{
  const recommender=createContentRecommender();

  assert.equal(
    recommender.getTourTypes({name:'Seoul - Dao Nami'}).has('beach'),
    false
  );
  assert.equal(
    recommender.getTourTypes({name:'Phan Thiet - Mui Ne'}).has('beach'),
    true
  );
});

test('departure locations are excluded from content feature vectors',()=>{
  const extractor=new FeatureExtractor();
  extractor.fit([
    {category:'domestic',locations:['a'],priceNewAdult:100,time:'2 ngay'},
    {category:'domestic',locations:['b'],priceNewAdult:200,time:'3 ngay'}
  ]);

  assert.deepEqual(extractor.getMetadata().vocabularies.locations,[]);
  assert.equal(
    extractor.getMetadata().featureNames.some(name=>name.startsWith('location:')),
    false
  );
});

test('active users with preferences prioritize preference over collaboration',()=>{
  const weights=selectHybridWeights({
    authenticated:true,
    hasPreferences:true,
    interactionCount:12
  });

  assert.equal(weights.strategy,'active_with_preferences');
  assert.ok(weights.preference+weights.content>=weights.collaborative);
});

test('preference filtering backfills the requested recommendation limit',()=>{
  const ranked=Array.from({length:10},(_,index)=>(
    {tourId:`tour-${index+1}`}
  ));
  const preferred=ranked.slice(0,4);

  const selected=backfillRecommendations(preferred,ranked,8);

  assert.equal(selected.length,8);
  assert.deepEqual(
    selected.map(item=>item.tourId),
    ranked.slice(0,8).map(item=>item.tourId)
  );
});
