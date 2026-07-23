const test=require('node:test');
const assert=require('node:assert/strict');

const Category=require('../models/category.model');
const Order=require('../models/order.model');
const Tour=require('../models/tour.model');
const UserVoucher=require('../models/user-voucher.model');
const Voucher=require('../models/voucher.model');
const categoryHelper=require('../helpers/category.helper');
const generateHelper=require('../helpers/generate.helper');
const orderHelper=require('../helpers/order.helper');
const permissionHelper=require('../helpers/permission.helper');
const sortHelper=require('../helpers/sort.helper');
const voucherHelper=require('../helpers/voucher.helper');
const {restoreAll,stub}=require('./test-utils');

const restores=[];
test.afterEach(()=>restoreAll(restores));

test('generateRandomNumber returns the requested number of digits',()=>{
  const value=generateHelper.generateRandomNumber(12);
  assert.match(value,/^\d{12}$/);
});

test('generateRandomNumber supports an empty result',()=>{
  assert.equal(generateHelper.generateRandomNumber(0),'');
});

test('generateRandomNumber uses the full 0-9 range',()=>{
  stub(Math,'random',()=>0.999999,restores);
  assert.equal(generateHelper.generateRandomNumber(4),'9999');
});

test('sortObject sorts keys and encodes values for payment signatures',()=>{
  assert.deepEqual(sortHelper.sortObject({z:'a b',a:'x/y',m:null}),{
    a:'x%2Fy',
    m:'',
    z:'a+b'
  });
});

test('sortObject handles empty input',()=>{
  assert.deepEqual(sortHelper.sortObject(null),{});
});

test('normalizePath strips the admin prefix, query and trailing slash',()=>{
  global.pathAdmin='admin';
  assert.equal(permissionHelper.normalizePath('/ADMIN/order/list/?page=2'),'/order/list');
});

test('normalizePath normalizes slashes and missing leading slash',()=>{
  assert.equal(permissionHelper.normalizePath('admin\\tour//list'),'/tour/list');
});

test('normalizePath maps the admin root to slash',()=>{
  assert.equal(permissionHelper.normalizePath('/admin'),'/');
});

test('buildCode creates a stable permission code',()=>{
  assert.equal(permissionHelper.buildCode('/admin/order/edit/:id','PATCH'),'patch-order-edit-id');
});

test('pathToRegex matches route parameters only within one segment',()=>{
  const regex=permissionHelper.pathToRegex('/order/edit/:id');
  assert.equal(regex.test('/order/edit/abc'),true);
  assert.equal(regex.test('/order/edit/a/b'),false);
});

test('pathToRegex supports full wildcard segments',()=>{
  const regex=permissionHelper.pathToRegex('/setting/*');
  assert.equal(regex.test('/setting/role/edit/1'),true);
  assert.equal(regex.test('/settings/role'),false);
});

test('pathToRegex supports suffix wildcards',()=>{
  const regex=permissionHelper.pathToRegex('/tour/trash*');
  assert.equal(regex.test('/tour/trash'),true);
  assert.equal(regex.test('/tour/trash-all'),true);
});

test('buildCategoryTree builds nested active records',()=>{
  const categories=[
    {_id:'1',name:'A',slug:'a',parent:''},
    {_id:'2',name:'B',slug:'b',parent:'1'},
    {_id:'3',name:'C',slug:'c',parent:'2'}
  ];
  assert.deepEqual(categoryHelper.buildCategoryTree(categories),[{
    _id:'1',name:'A',slug:'a',children:[{
      _id:'2',name:'B',slug:'b',children:[{
        _id:'3',name:'C',slug:'c',children:[]
      }]
    }]
  }]);
});

test('buildCategoryTree ignores records disconnected from the root',()=>{
  assert.deepEqual(categoryHelper.buildCategoryTree([
    {_id:'1',name:'A',slug:'a',parent:'missing'}
  ]),[]);
});

test('CategoriesParentToRoot returns an empty breadcrumb for a missing category',async()=>{
  stub(Category,'findOne',async()=>null,restores);
  assert.deepEqual(await categoryHelper.CategoriesParentToRoot([],'missing'),[]);
});

test('CategoriesParentToRoot returns root-to-leaf order',async()=>{
  const records={
    root:{_id:'root',name:'Root',slug:'root',parent:''},
    child:{_id:'child',name:'Child',slug:'child',parent:'root'}
  };
  stub(Category,'findOne',async query=>records[query._id],restores);
  const result=await categoryHelper.CategoriesParentToRoot(Object.values(records),'child');
  assert.deepEqual(result.map(item=>item.slug),['root','child']);
});

test('CategoriesParentToRoot terminates when category data contains a cycle',async()=>{
  const records={
    a:{_id:'a',name:'A',slug:'a',parent:'b'},
    b:{_id:'b',name:'B',slug:'b',parent:'a'}
  };
  stub(Category,'findOne',async query=>records[query._id],restores);
  const result=await categoryHelper.CategoriesParentToRoot(Object.values(records),'a');
  assert.deepEqual(result.map(item=>item.slug),['b','a']);
});

test('CategoriesFamily returns parent and every descendant once',async()=>{
  const children={
    root:[{id:'a'},{id:'b'}],
    a:[{id:'c'}],
    b:[],
    c:[]
  };
  stub(Category,'find',async query=>children[String(query.parent)] || [],restores);
  assert.deepEqual(await categoryHelper.CategoriesFamily('root'),['root','a','c','b']);
});

test('CategoriesFamily terminates on cyclic parent data',async()=>{
  const children={a:[{id:'b'}],b:[{id:'a'}]};
  stub(Category,'find',async query=>children[String(query.parent)] || [],restores);
  assert.deepEqual(await categoryHelper.CategoriesFamily('a'),['a','b']);
});

test('normalizeVoucherCode trims and uppercases',()=>{
  assert.equal(voucherHelper.normalizeVoucherCode('  summer20 '),'SUMMER20');
  assert.equal(voucherHelper.normalizeVoucherCode(null),'');
});

test('calculateDiscount applies a percentage discount',()=>{
  assert.equal(voucherHelper.calculateDiscount({discountType:'percent',discountValue:15},200000),30000);
});

test('calculateDiscount rounds percentage discounts',()=>{
  assert.equal(voucherHelper.calculateDiscount({discountType:'percent',discountValue:33},101),33);
});

test('calculateDiscount applies a fixed discount',()=>{
  assert.equal(voucherHelper.calculateDiscount({discountType:'fixed',discountValue:45000},200000),45000);
});

test('calculateDiscount respects maxDiscount',()=>{
  assert.equal(voucherHelper.calculateDiscount({discountType:'percent',discountValue:50,maxDiscount:30000},200000),30000);
});

test('calculateDiscount never exceeds subtotal',()=>{
  assert.equal(voucherHelper.calculateDiscount({discountType:'fixed',discountValue:500000},200000),200000);
});

test('calculateDiscount clamps invalid and negative values',()=>{
  assert.equal(voucherHelper.calculateDiscount({discountType:'fixed',discountValue:-10},-100),0);
});

const validVoucher=overrides=>({
  _id:'voucher-id',
  id:'voucher-id',
  code:'SAVE10',
  status:'active',
  deleted:false,
  discountType:'percent',
  discountValue:10,
  minOrderValue:100000,
  maxDiscount:50000,
  usageLimit:100,
  usedCount:2,
  ...overrides
});

test('getApplicableVoucher rejects an empty code without querying',async()=>{
  await assert.rejects(
    voucherHelper.getApplicableVoucher({userId:'u',code:' ',subTotal:200000}),
    error=>error.status===400
  );
});

test('getApplicableVoucher rejects missing or expired vouchers',async()=>{
  stub(Voucher,'findOne',async()=>null,restores);
  await assert.rejects(
    voucherHelper.getApplicableVoucher({userId:'u',code:'SAVE10',subTotal:200000}),
    /không tồn tại|hết hạn/
  );
});

test('getApplicableVoucher rejects a fully used voucher',async()=>{
  stub(Voucher,'findOne',async()=>validVoucher({usageLimit:2,usedCount:2}),restores);
  await assert.rejects(
    voucherHelper.getApplicableVoucher({userId:'u',code:'SAVE10',subTotal:200000}),
    error=>error.status===409
  );
});

test('getApplicableVoucher requires the voucher to be in the user wallet',async()=>{
  stub(Voucher,'findOne',async()=>validVoucher(),restores);
  stub(UserVoucher,'findOne',async()=>null,restores);
  await assert.rejects(
    voucherHelper.getApplicableVoucher({userId:'u',code:'SAVE10',subTotal:200000}),
    /ví voucher/
  );
});

test('getApplicableVoucher rejects an already used wallet voucher',async()=>{
  stub(Voucher,'findOne',async()=>validVoucher(),restores);
  stub(UserVoucher,'findOne',async()=>({status:'used'}),restores);
  await assert.rejects(
    voucherHelper.getApplicableVoucher({userId:'u',code:'SAVE10',subTotal:200000}),
    error=>error.status===409
  );
});

test('getApplicableVoucher enforces minimum order value',async()=>{
  stub(Voucher,'findOne',async()=>validVoucher({minOrderValue:300000}),restores);
  stub(UserVoucher,'findOne',async()=>({status:'available'}),restores);
  await assert.rejects(
    voucherHelper.getApplicableVoucher({userId:'u',code:'SAVE10',subTotal:200000}),
    /tối thiểu/
  );
});

test('getApplicableVoucher returns server-calculated totals',async()=>{
  const voucher=validVoucher();
  const userVoucher={_id:'wallet',status:'available'};
  stub(Voucher,'findOne',async()=>voucher,restores);
  stub(UserVoucher,'findOne',async()=>userVoucher,restores);
  const result=await voucherHelper.getApplicableVoucher({userId:'u',code:' save10 ',subTotal:200000});
  assert.equal(result.code,'SAVE10');
  assert.equal(result.discount,20000);
  assert.equal(result.total,180000);
  assert.equal(result.voucher,voucher);
  assert.equal(result.userVoucher,userVoucher);
});

test('releaseOrderResources restores all passenger stocks',async()=>{
  const updates=[];
  stub(Tour,'updateOne',async(...args)=>updates.push(args),restores);
  stub(UserVoucher,'findOneAndUpdate',async()=>null,restores);
  await orderHelper.releaseOrderResources({
    _id:'order',
    userId:'user',
    items:[
      {tourId:'t1',quantityAdult:2,quantityChildren:1,quantityBaby:0},
      {tourId:'t2',quantityAdult:0,quantityChildren:0,quantityBaby:3}
    ]
  });
  assert.equal(updates.length,2);
  assert.deepEqual(updates[0][1].$inc,{stockAdult:2,stockChildren:1,stockBaby:0});
});

test('releaseOrderResources makes an attached voucher available again',async()=>{
  let voucherUpdate=null;
  stub(Tour,'updateOne',async()=>({}),restores);
  stub(UserVoucher,'findOneAndUpdate',async()=>({voucherId:'v1'}),restores);
  stub(Voucher,'updateOne',async(...args)=>{voucherUpdate=args;},restores);
  await orderHelper.releaseOrderResources({_id:'order',userId:'user',items:[]});
  assert.equal(voucherUpdate[0]._id,'v1');
  assert.equal(voucherUpdate[1].$inc.usedCount,-1);
});

test('cancelOrderAndRelease does nothing when no cancellable order matches',async()=>{
  let released=false;
  stub(Order,'findOneAndUpdate',async()=>null,restores);
  stub(Tour,'updateOne',async()=>{released=true;},restores);
  assert.equal(await orderHelper.cancelOrderAndRelease({_id:'missing'}),null);
  assert.equal(released,false);
});

test('cancelOrderAndRelease marks the order then releases resources',async()=>{
  const order={_id:'order',userId:'user',items:[]};
  let updateArgs=null;
  stub(Order,'findOneAndUpdate',async(...args)=>{updateArgs=args; return order;},restores);
  stub(UserVoucher,'findOneAndUpdate',async()=>null,restores);
  const result=await orderHelper.cancelOrderAndRelease({_id:'order'},'admin');
  assert.equal(result,order);
  assert.equal(updateArgs[0].deleted,false);
  assert.equal(updateArgs[1].$set.status,'cancelled');
  assert.equal(updateArgs[1].$set.updatedBy,'admin');
});
