const assert=require('node:assert/strict');
const test=require('node:test');
const {
  FeatureExtractor,
  cosineSimilarity,
  getDepartureSeason,
  getTourPrice,
  parseDuration
}=require('../../services/recommendation/feature-extractor');

test('feature extractor builds the documented normalized tour vector',()=>{
  const tours=[
    {
      category:'category-a',
      locations:['departure-city'],
      priceAdult:120,
      priceNewAdult:100,
      time:'2 ngay 1 dem',
      vehicle:'Bus',
      departureDate:'2030-04-10T00:00:00.000Z',
      ratingAvg:5,
      ratingCount:9
    },
    {
      category:'category-b',
      locations:['another-departure-city'],
      priceAdult:300,
      time:'4 days',
      vehicle:'Plane',
      departureDate:'2030-07-10T00:00:00.000Z',
      ratingAvg:2.5,
      ratingCount:0
    }
  ];
  const extractor=new FeatureExtractor();
  const vectors=extractor.fitTransform(tours);
  const metadata=extractor.getMetadata();

  assert.equal(metadata.dimensions,12);
  assert.deepEqual(metadata.vocabularies.locations,[]);
  assert.deepEqual(vectors[0],[
    1,0,
    0,
    0,
    1,0,
    1,0,0,0,
    1,1
  ]);
  assert.deepEqual(vectors[1],[
    0,1,
    1,
    1,
    0,1,
    0,1,0,0,
    0.5,0
  ]);
  assert.deepEqual(metadata.normalization.price,{minimum:100,maximum:300});
  assert.deepEqual(metadata.normalization.duration,{minimum:2,maximum:4});
});

test('duration, season, and price helpers handle common tour data',()=>{
  assert.equal(parseDuration('3N2D'),3);
  assert.equal(parseDuration('12 gio'),0.5);
  assert.equal(parseDuration('2 dem'),3);
  assert.equal(getDepartureSeason('2030-01-10'),'winter');
  assert.equal(getDepartureSeason('2030-04-10'),'spring');
  assert.equal(getDepartureSeason('2030-07-10'),'summer');
  assert.equal(getDepartureSeason('2030-10-10'),'autumn');
  assert.equal(getTourPrice({priceAdult:500,priceNewAdult:400}),400);
  assert.equal(getTourPrice({priceAdult:500}),500);
});

test('cosine similarity validates dimensions and zero vectors',()=>{
  assert.equal(cosineSimilarity([1,0],[1,0]),1);
  assert.equal(cosineSimilarity([1,0],[0,1]),0);
  assert.equal(cosineSimilarity([0,0],[1,1]),0);
  assert.throws(()=>cosineSimilarity([1],[1,2]),RangeError);
  assert.throws(()=>cosineSimilarity(null,[1]),TypeError);
});

test('feature extractor requires fitting before transformation',()=>{
  const extractor=new FeatureExtractor();

  assert.throws(()=>extractor.transform({}),/must be fitted/);
  assert.throws(()=>extractor.getMetadata(),/must be fitted/);
  assert.throws(()=>extractor.fit(null),TypeError);
});
