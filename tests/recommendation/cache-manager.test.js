const assert=require('node:assert/strict');
const test=require('node:test');
const {
  RecommendationCacheManager
}=require('../../services/recommendation/cache-manager');

test('recommendation cache reuses values within its TTL',async()=>{
  const cache=new RecommendationCacheManager({ttlMs:60*1000,maxEntries:10});
  const key=cache.createKey('personalized',{limit:8,userId:'user-1'});
  let loads=0;
  const loader=async()=>{
    loads+=1;
    return {recommendations:[{tourId:'tour-1'}]};
  };

  const first=await cache.remember(key,loader,{
    tags:['scope:personalized','user:user-1']
  });
  const second=await cache.remember(key,loader);

  assert.equal(first.status,'MISS');
  assert.equal(second.status,'HIT');
  assert.equal(loads,1);
  assert.deepEqual(second.value,first.value);
  assert.equal(cache.getStats().hitRate,0.5);
});

test('concurrent cache misses share one recommendation calculation',async()=>{
  const cache=new RecommendationCacheManager({ttlMs:60*1000,maxEntries:10});
  const key=cache.createKey('similar',{limit:4,tourId:'tour-1'});
  let loads=0;
  let release;
  const gate=new Promise(resolve=>{
    release=resolve;
  });
  const loader=async()=>{
    loads+=1;
    await gate;
    return [{tourId:'tour-2'}];
  };

  const firstPromise=cache.remember(key,loader);
  await Promise.resolve();
  const secondPromise=cache.remember(key,loader);
  release();
  const [first,second]=await Promise.all([firstPromise,secondPromise]);

  assert.equal(first.status,'MISS');
  assert.equal(second.status,'COALESCED');
  assert.equal(loads,1);
  assert.deepEqual(second.value,first.value);
});

test('tag invalidation removes only affected recommendation entries',()=>{
  const cache=new RecommendationCacheManager({ttlMs:60*1000,maxEntries:10});
  const firstUser=cache.createKey('personalized',{userId:'user-1'});
  const secondUser=cache.createKey('personalized',{userId:'user-2'});
  const trending=cache.createKey('trending',{limit:8});
  cache.set(firstUser,[{tourId:'tour-1'}],{
    tags:['scope:personalized','user:user-1','tour:tour-1']
  });
  cache.set(secondUser,[{tourId:'tour-2'}],{
    tags:['scope:personalized','user:user-2','tour:tour-2']
  });
  cache.set(trending,[{tourId:'tour-3'}],{
    tags:['scope:trending','tour:tour-3']
  });

  assert.equal(cache.invalidateTags(['user:user-1','scope:trending']),2);
  assert.equal(cache.get(firstUser),undefined);
  assert.deepEqual(cache.get(secondUser),[{tourId:'tour-2'}]);
  assert.equal(cache.get(trending),undefined);
  assert.equal(cache.getStats().size,1);
});

test('invalidation prevents new requests from joining stale in-flight work',
  async()=>{
    const cache=new RecommendationCacheManager({ttlMs:60*1000,maxEntries:10});
    const key=cache.createKey('personalized',{userId:'user-1'});
    let release;
    const gate=new Promise(resolve=>{
      release=resolve;
    });
    const stale=cache.remember(key,async()=>{
      await gate;
      return 'stale';
    },{tags:['user:user-1']});
    await Promise.resolve();

    cache.invalidateTags(['user:user-1']);
    const fresh=await cache.remember(key,async()=>'fresh',{
      tags:['user:user-1']
    });
    release();
    const staleResult=await stale;

    assert.equal(fresh.status,'MISS');
    assert.equal(fresh.value,'fresh');
    assert.equal(staleResult.value,'stale');
    assert.equal(cache.get(key),'fresh');
  });
