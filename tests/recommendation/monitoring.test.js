const assert=require('node:assert/strict');
const test=require('node:test');
const {
  calculateRecommendationMonitoring,
  findAttributedClickKeys
}=require('../../services/recommendation/monitoring');

test('monitoring calculates CTR, conversion, quality, and model metrics',()=>{
  const clicks=[
    {
      _id:'click-1',
      userId:'user-1',
      tourId:'tour-1',
      createdAt:new Date('2026-07-01T00:00:00.000Z')
    },
    {
      _id:'click-2',
      userId:'user-1',
      tourId:'tour-2',
      createdAt:new Date('2026-07-02T00:00:00.000Z')
    },
    {
      _id:'click-3',
      userId:null,
      tourId:'tour-1',
      createdAt:new Date('2026-07-03T00:00:00.000Z')
    }
  ];
  const orders=[{
    userId:'user-1',
    items:[{tourId:'tour-1'}],
    createdAt:new Date('2026-07-10T00:00:00.000Z')
  }];
  const metrics=calculateRecommendationMonitoring({
    clicks,
    orders,
    ignoreCount:1,
    reviewSummary:{
      averageRating:4.25,
      reviewCount:8,
      reviewedTourCount:3
    },
    totalTours:6,
    schedulerStatus:{
      lastTrainedAt:'2026-07-20T00:00:00.000Z',
      lastReason:'scheduled_interval',
      metrics:{rmse:0.12345,mae:0.1,precisionAtK:0.75,precisionK:10},
      cache:{hits:3,misses:1,size:4,maxEntries:1000}
    }
  });

  assert.equal(metrics.engagement.ctr,75);
  assert.equal(metrics.engagement.dataQuality,'complete');
  assert.equal(metrics.conversion.rate,50);
  assert.equal(metrics.conversion.attributedClicks,1);
  assert.equal(metrics.conversion.eligibleClicks,2);
  assert.equal(metrics.quality.averageRating,4.25);
  assert.equal(metrics.quality.reviewCoverage,50);
  assert.equal(metrics.model.rmse,0.1235);
  assert.equal(metrics.model.mae,0.1);
  assert.equal(metrics.model.precisionAtK,0.75);
  assert.equal(metrics.cache.hitRate,75);
});

test('conversion attributes an order to the latest eligible click',()=>{
  const clicks=[
    {
      _id:'older-click',
      userId:'user-1',
      tourId:'tour-1',
      createdAt:new Date('2026-06-01T00:00:00.000Z')
    },
    {
      _id:'latest-click',
      userId:'user-1',
      tourId:'tour-1',
      createdAt:new Date('2026-06-10T00:00:00.000Z')
    }
  ];
  const orders=[
    {
      userId:'user-1',
      items:[{tourId:'tour-1'}],
      createdAt:new Date('2026-06-12T00:00:00.000Z')
    },
    {
      userId:'user-1',
      items:[{tourId:'tour-1'}],
      createdAt:new Date('2026-08-20T00:00:00.000Z')
    }
  ];

  const attributed=findAttributedClickKeys(clicks,orders,30);

  assert.deepEqual([...attributed],['latest-click']);
});

test('CTR marks click-only feedback as partial data',()=>{
  const metrics=calculateRecommendationMonitoring({
    clicks:[{
      _id:'click-1',
      userId:null,
      tourId:'tour-1',
      createdAt:new Date()
    }],
    orders:[],
    ignoreCount:0,
    reviewSummary:{},
    totalTours:0
  });

  assert.equal(metrics.engagement.ctr,100);
  assert.equal(metrics.engagement.dataQuality,'partial');
  assert.equal(metrics.conversion.rate,0);
  assert.equal(metrics.quality.reviewCoverage,0);
});
