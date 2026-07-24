const assert=require('node:assert/strict');
const test=require('node:test');
const {
  MatrixFactorization,
  compareFactorizationAlgorithms,
  validateMatrixData
}=require('../../services/recommendation/matrix-factorization');

const rankOneMatrix={
  shape:[2,3],
  userIds:['user-1','user-2'],
  tourIds:['tour-1','tour-2','tour-3'],
  matrix:{
    rowPointers:[0,3,6],
    columnIndices:[0,1,2,0,1,2],
    values:[1,2,3,1.5,3,4.5]
  }
};

test('ALS reconstructs observed values and ranks tours',()=>{
  const model=new MatrixFactorization({
    algorithm:'als',
    factors:1,
    iterations:60,
    regularization:0.001,
    tolerance:1e-8,
    seed:7
  }).fit(rankOneMatrix);
  const metadata=model.getMetadata();
  const predictions=model.predictForUser('user-1');

  assert.equal(metadata.trained,true);
  assert.equal(metadata.stats.algorithm,'als');
  assert.ok(metadata.stats.rmse<0.001);
  assert.deepEqual(
    predictions.map(item=>item.tourId),
    ['tour-3','tour-2','tour-1']
  );
  assert.ok(Math.abs(model.predict('user-1','tour-2')-2)<0.001);
  assert.equal(model.predict('missing-user','tour-1'),null);
  assert.deepEqual(model.predictForUser('missing-user'),[]);
});

test('truncated SVD reconstructs a low-rank matrix',()=>{
  const model=new MatrixFactorization({
    algorithm:'svd',
    factors:1,
    seed:7
  }).train(rankOneMatrix);
  const metadata=model.getMetadata();

  assert.equal(metadata.stats.algorithm,'svd');
  assert.equal(metadata.stats.factors,1);
  assert.equal(metadata.stats.singularValues.length,1);
  assert.ok(metadata.stats.rmse<1e-10);
  assert.ok(Math.abs(model.predict('user-2','tour-3')-4.5)<1e-10);
});

test('serialized models preserve predictions',()=>{
  const original=new MatrixFactorization({
    algorithm:'als',
    factors:1,
    iterations:30,
    regularization:0.01,
    seed:11
  }).fit(rankOneMatrix);
  const restored=MatrixFactorization.fromJSON(
    JSON.stringify(original.toJSON())
  );

  assert.equal(restored.getMetadata().trained,true);
  assert.equal(
    restored.predict('user-2','tour-2'),
    original.predict('user-2','tour-2')
  );
  assert.deepEqual(restored.predictForUser('user-1'),
    original.predictForUser('user-1'));
});

test('algorithm comparison trains ALS and SVD on the same matrix',()=>{
  const comparison=compareFactorizationAlgorithms(rankOneMatrix,{
    factors:1,
    iterations:20,
    regularization:0.01,
    seed:5
  });

  assert.equal(comparison.metrics.als.algorithm,'als');
  assert.equal(comparison.metrics.svd.algorithm,'svd');
  assert.ok(Number.isFinite(comparison.metrics.als.rmse));
  assert.ok(Number.isFinite(comparison.metrics.svd.rmse));
});

test('empty sparse matrices train without non-finite predictions',()=>{
  const matrix={
    shape:[2,2],
    userIds:['user-1','user-2'],
    tourIds:['tour-1','tour-2'],
    matrix:{
      rowPointers:[0,0,0],
      columnIndices:[],
      values:[]
    }
  };

  for(const algorithm of ['als','svd']){
    const model=new MatrixFactorization({algorithm,factors:2}).fit(matrix);
    assert.equal(model.getMetadata().stats.rmse,0);
    assert.equal(model.predict('user-1','tour-1'),0);
  }
});

test('invalid CSR matrices are rejected before training',()=>{
  assert.throws(()=>validateMatrixData({
    shape:[1,1],
    userIds:['user-1'],
    tourIds:['tour-1'],
    matrix:{
      rowPointers:[0,2],
      columnIndices:[0],
      values:[1]
    }
  }),/row pointers/i);
});
