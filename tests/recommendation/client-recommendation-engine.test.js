const assert=require('node:assert/strict');
const test=require('node:test');
const {
  TourRecommendationEngine,
  buildCardViewModel,
  buildFeatureVector,
  inferTourTypes,
  parseDurationDays,
  scoreFeatureVector
}=require('../../public/assets/js/recommendation-engine');

const createStorage=()=>{
  const values=new Map();
  return {
    getItem:key=>values.get(key) || null,
    setItem:(key,value)=>values.set(key,value)
  };
};

test('client parses common Vietnamese tour durations',()=>{
  assert.equal(parseDurationDays('3N2D'),3);
  assert.equal(parseDurationDays('5 Ngay 4 Dem'),5);
  assert.equal(parseDurationDays('Tour 12 gio'),1);
  assert.equal(parseDurationDays(''),0);
});

test('context vector represents morning, mobile, and session affinity',()=>{
  const candidate={
    score:0.5,
    components:{popularity:0.4},
    tour:{
      name:'Trekking Sapa va leo nui',
      time:'3N2D',
      ratingAvg:4
    }
  };
  const vector=buildFeatureVector(candidate,{
    hour:8,
    deviceType:'mobile',
    sessionProfile:{typeCounts:{outdoor:3}}
  });

  assert.equal(inferTourTypes(candidate).has('outdoor'),true);
  assert.deepEqual(vector,[0.5,0.5,1,0,1,0,0.4,0.8]);
});

test('evening city and desktop long-tour rules are independent',()=>{
  const cityVector=buildFeatureVector({
    score:0.4,
    tour:{name:'Kham pha thanh pho Ha Noi',time:'2 ngay'}
  },{
    hour:20,
    deviceType:'desktop',
    sessionProfile:{typeCounts:{}}
  });
  const longVector=buildFeatureVector({
    score:0.4,
    tour:{name:'Hanh trinh van hoa',time:'6 ngay'}
  },{
    hour:14,
    deviceType:'desktop',
    sessionProfile:{typeCounts:{}}
  });

  assert.equal(cityVector[3],1);
  assert.equal(cityVector[5],0);
  assert.equal(longVector[3],0);
  assert.equal(longVector[5],1);
});

test('three same-type session views boost matching candidates',async()=>{
  const engine=new TourRecommendationEngine({
    fetch:null,
    tf:null,
    storage:createStorage(),
    now:()=>new Date('2026-07-23T08:00:00.000Z'),
    deviceType:'desktop'
  });
  const outdoor={
    tourId:'outdoor-tour',
    score:0.5,
    tour:{name:'Trekking Sapa',time:'4 ngay'}
  };
  for(let count=0;count<3;count+=1){
    engine.recordInteraction(outdoor,'view');
  }
  const ranked=await engine.rank([
    {
      tourId:'city-tour',
      score:0.5,
      tour:{name:'Kham pha thanh pho',time:'4 ngay'}
    },
    outdoor
  ],{hour:8});

  assert.equal(ranked[0].tourId,'outdoor-tour');
  assert.equal(ranked[0].contextFeatures.sessionAffinity,0.5);
  assert.ok(ranked[0].score>ranked[1].score);
});

test('fallback scorer clamps contextual output to zero-one',()=>{
  assert.equal(scoreFeatureVector(Array(8).fill(1)),1);
  assert.equal(scoreFeatureVector(Array(8).fill(0)),0);
});

test('candidate API request IDs are attached for later feedback',async()=>{
  const engine=new TourRecommendationEngine({
    fetch:async()=>({
      ok:true,
      json:async()=>({
        data:{
          requestId:'request_1234567890',
          recommendations:[{tourId:'tour-1',score:0.8}]
        }
      })
    }),
    tf:null,
    storage:null
  });
  const candidates=await engine.fetchCandidates('/api/recommendation/test');

  assert.equal(candidates[0].recommendationRequestId,'request_1234567890');
});

test('recommendation card view model formats API tour data',()=>{
  const view=buildCardViewModel({
    tourId:'tour-1',
    recommendationRequestId:'request_1234567890',
    score:0.876,
    components:{content:0.7,collaborative:0.8,popularity:0.6},
    tour:{
      name:'Tour Da Nang',
      slug:'tour-da-nang',
      priceAdult:1000000,
      priceNewAdult:800000,
      stockAdult:9,
      ratingAvg:4.6,
      ratingCount:20,
      time:'3N2D',
      departureDate:'2030-01-02T00:00:00.000Z'
    }
  },2);

  assert.equal(view.requestId,'request_1234567890');
  assert.equal(view.position,2);
  assert.equal(view.link,'/tour/detail/tour-da-nang?source=recommendation');
  assert.equal(view.discount,20);
  assert.equal(view.matchPercent,88);
  assert.equal(view.stockAdult,9);
});

test('client feedback sends request, position, and component scores',async()=>{
  let request=null;
  const engine=new TourRecommendationEngine({
    fetch:async(url,options)=>{
      request={url,options};
      return {ok:true};
    },
    tf:null,
    storage:null,
    deviceType:'mobile'
  });
  const accepted=await engine.sendFeedback({
    tourId:'64b000000000000000000003',
    recommendationRequestId:'request_1234567890',
    score:0.8,
    components:{content:0.7,collaborative:0.9,popularity:0.6}
  },'click',{
    position:2,
    source:'home',
    pagePath:'/'
  });
  const payload=JSON.parse(request.options.body);

  assert.equal(accepted,true);
  assert.equal(request.url,'/api/recommendation/feedback');
  assert.equal(request.options.keepalive,true);
  assert.equal(request.options.headers['X-Device-Type'],'mobile');
  assert.equal(payload.requestId,'request_1234567890');
  assert.equal(payload.position,2);
  assert.deepEqual(payload.scores,{
    final:0.8,
    content:0.7,
    collaborative:0.9,
    popularity:0.6,
    contextual:0.8
  });
});
