const assert=require('node:assert/strict');
const test=require('node:test');
const Tour=require('../../models/tour.model');
const UserInteraction=require('../../models/user-interaction.model');
const trackingController=require('../../controllers/client/tracking.controller');
const trackingValidate=require('../../validates/client/tracking.validate');
const {
  RecommendationCacheManager
}=require('../../services/recommendation/cache-manager');

const ids={
  user:'64b000000000000000000001',
  validTour:'64b000000000000000000002',
  invalidTour:'64b000000000000000000003'
};

const runValidation=(middleware,body)=>new Promise(resolve=>{
  const req={body};
  const res={
    statusCode:200,
    payload:null,
    status(code){
      this.statusCode=code;
      return this;
    },
    json(payload){
      this.payload=payload;
      resolve({req,res:this,nextCalled:false});
      return this;
    }
  };
  middleware(req,res,()=>resolve({req,res,nextCalled:true}));
});

const createResponse=()=>({
  statusCode:200,
  payload:null,
  status(code){
    this.statusCode=code;
    return this;
  },
  json(payload){
    this.payload=payload;
    return this;
  }
});

test('UserInteraction schema supports search, feedback, and idempotency',async()=>{
  const search=new UserInteraction({
    type:'search',
    value:1.5,
    metadata:{searchQuery:'Da Nang'}
  });
  const ignored=new UserInteraction({
    type:'recommendation_ignore',
    tourId:ids.validTour,
    metadata:{interactionKind:'recommendation_ignore'}
  });

  await search.validate();
  await ignored.validate();
  await assert.rejects(
    new UserInteraction({type:'view'}).validate(),
    error=>Boolean(error.errors.tourId)
  );
  const indexes=UserInteraction.schema.indexes();
  assert.equal(indexes.some(([fields,options])=>
    fields['metadata.clientEventId']===1
    && options.unique===true
    && options.sparse===true
  ),true);
});

test('tracking validation accepts bounded events and strips unknown fields',
  async()=>{
    const result=await runValidation(trackingValidate.events,{
      sessionId:'session_1234567890',
      unknown:'remove-me',
      events:[{
        eventId:'event_12345678901',
        type:'click_recommendation',
        tourId:ids.validTour,
        value:2.5,
        occurredAt:'2030-01-01T00:00:00.000Z',
        metadata:{
          interactionKind:'recommendation_click',
          source:'recommendation',
          deviceType:'mobile',
          unknown:'remove-me'
        }
      }]
    });

    assert.equal(result.nextCalled,true);
    assert.equal(result.req.body.unknown,undefined);
    assert.equal(result.req.body.events[0].metadata.unknown,undefined);
  });

test('tracking validation rejects malformed batches',async()=>{
  const result=await runValidation(trackingValidate.events,{
    events:[{
      eventId:'short',
      type:'purchase',
      tourId:'bad-id',
      value:-1,
      occurredAt:'not-a-date'
    }]
  });

  assert.equal(result.nextCalled,false);
  assert.equal(result.res.statusCode,400);
});

test('tracking API stores valid tours idempotently and invalidates user cache',
  async()=>{
    const originalTourFind=Tour.find;
    const originalBulkWrite=UserInteraction.bulkWrite;
    const writes=[];
    Tour.find=()=>({
      select(){
        return this;
      },
      lean:async()=>[{_id:ids.validTour}]
    });
    UserInteraction.bulkWrite=async operations=>{
      writes.push(...operations);
      return {upsertedCount:operations.length};
    };
    const cache=new RecommendationCacheManager();
    const cacheKey=cache.createKey('personalized',{userId:ids.user});
    cache.set(cacheKey,{recommendations:[]},{tags:[`user:${ids.user}`]});
    const req={
      user:{id:ids.user},
      body:{
        events:[
          {
            eventId:'event_valid_123456',
            tourId:ids.validTour,
            type:'click_recommendation',
            value:99,
            occurredAt:new Date('2030-01-01T00:00:00.000Z'),
            metadata:{source:'recommendation'}
          },
          {
            eventId:'event_invalid_1234',
            tourId:ids.invalidTour,
            type:'view',
            value:1,
            occurredAt:new Date('2030-01-01T00:00:00.000Z'),
            metadata:{source:'direct'}
          }
        ]
      },
      session:{},
      sessionID:'session_1234567890',
      app:{locals:{recommendationCache:cache}}
    };
    const res=createResponse();

    try{
      await trackingController.events(req,res);
    }finally{
      Tour.find=originalTourFind;
      UserInteraction.bulkWrite=originalBulkWrite;
    }

    assert.equal(res.statusCode,201);
    assert.equal(res.payload.accepted,1);
    assert.equal(writes.length,1);
    const record=writes[0].updateOne.update.$setOnInsert;
    assert.equal(record.userId,ids.user);
    assert.equal(record.type,'click_recommendation');
    assert.equal(record.value,2.5);
    assert.equal(record.metadata.clientEventId,'event_valid_123456');
    assert.equal(writes[0].updateOne.upsert,true);
    assert.equal(cache.cache.has(cacheKey),false);
  });
