const assert=require('node:assert/strict');
const test=require('node:test');
const {
  MatrixBuilder,
  buildMatrixFromRecords,
  getMatrixValue,
  getUserSparseVector,
  toDenseMatrix
}=require('../../services/recommendation/matrix-builder');

const createQuery=value=>({
  select(){
    return this;
  },
  lean(){
    return Promise.resolve(value);
  }
});

test('matrix builder applies source priority and produces valid CSR data',()=>{
  const matrix=buildMatrixFromRecords({
    users:[{_id:'user-b'},{_id:'user-a'}],
    tours:[{_id:'tour-b'},{_id:'tour-a'}],
    interactions:[
      {userId:'user-a',tourId:'tour-a',type:'view'},
      {userId:'user-a',tourId:'tour-a',type:'click_recommendation'},
      {userId:'user-a',tourId:'tour-b',type:'cart_add'},
      {userId:'missing-user',tourId:'tour-a',type:'view'}
    ],
    favorites:[{userId:'user-a',tourId:'tour-a'}],
    orders:[{userId:'user-a',items:[{tourId:'tour-a'}]}],
    reviews:[{userId:'user-a',tourId:'tour-a',rating:4}]
  });

  assert.deepEqual(matrix.userIds,['user-a','user-b']);
  assert.deepEqual(matrix.tourIds,['tour-a','tour-b']);
  assert.deepEqual(matrix.shape,[2,2]);
  assert.deepEqual(matrix.matrix.rowPointers,[0,2,2]);
  assert.deepEqual(matrix.matrix.columnIndices,[0,1]);
  assert.deepEqual(matrix.matrix.values,[4,3]);
  assert.deepEqual(matrix.matrix.sources,['review','interaction:cart_add']);
  assert.equal(matrix.stats.nonZero,2);
  assert.equal(matrix.stats.density,0.5);
  assert.ok(matrix.stats.overriddenSignals>=3);
  assert.ok(matrix.stats.ignoredSignals>=1);
  assert.deepEqual(toDenseMatrix(matrix),[[4,3],[0,0]]);
});

test('matrix lookup helpers return sparse and dense user values',()=>{
  const matrix=buildMatrixFromRecords({
    users:[{_id:'user-a'}],
    tours:[{_id:'tour-a'},{_id:'tour-b'}],
    interactions:[{
      userId:'user-a',
      tourId:'tour-b',
      type:'click_recommendation'
    }]
  });

  assert.equal(getMatrixValue(matrix,'user-a','tour-b'),2.5);
  assert.equal(getMatrixValue(matrix,'user-a','missing-tour'),0);
  assert.deepEqual(getUserSparseVector(matrix,'user-a'),[{
    tourId:'tour-b',
    tourIndex:1,
    value:2.5,
    source:'interaction:click_recommendation'
  }]);
  assert.deepEqual(getUserSparseVector(matrix,'missing-user'),[]);
});

test('MatrixBuilder queries each documented signal source',async()=>{
  const calls=[];
  const models={
    User:{find:query=>{calls.push(['users',query]);return createQuery([{_id:'u'}]);}},
    Tour:{find:query=>{calls.push(['tours',query]);return createQuery([{_id:'t'}]);}},
    Review:{find:query=>{calls.push(['reviews',query]);return createQuery([]);}},
    Order:{find:query=>{calls.push(['orders',query]);return createQuery([]);}},
    Favorite:{find:query=>{calls.push(['favorites',query]);return createQuery([]);}},
    UserInteraction:{find:query=>{
      calls.push(['interactions',query]);
      return createQuery([{userId:'u',tourId:'t',type:'view'}]);
    }}
  };

  const matrix=await new MatrixBuilder({models}).build();

  assert.equal(calls.length,6);
  assert.deepEqual(matrix.shape,[1,1]);
  assert.equal(getMatrixValue(matrix,'u','t'),1);
});
