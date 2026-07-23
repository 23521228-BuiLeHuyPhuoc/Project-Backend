const test=require('node:test');
const assert=require('node:assert/strict');
const mongoose=require('mongoose');

const City=require('../models/city.model');
const Notification=require('../models/notification.model');
const Order=require('../models/order.model');
const Tour=require('../models/tour.model');
const cartController=require('../controllers/client/cart.controller');
const orderController=require('../controllers/client/order.controller');
const {createRequest,createResponse,restoreAll,stub}=require('./test-utils');

const restores=[];
test.afterEach(()=>restoreAll(restores));
const objectId=()=>new mongoose.Types.ObjectId().toString();

const makeCart=(items=[])=>{
  const cart=[...items];
  cart.id=id=>cart.find(item=>String(item._id)===String(id));
  cart.pull=(...ids)=>{
    ids.map(String).forEach(id=>{
      const index=cart.findIndex(item=>String(item._id)===id);
      if(index>=0){
        cart.splice(index,1);
      }
    });
  };
  return cart;
};

const makeUser=(items=[])=>({
  id:'user',
  fullName:'Nguyen Van A',
  phone:'0901234567',
  cart:makeCart(items),
  saved:false,
  async save(){this.saved=true;}
});

const tourRecord=(id,location,overrides)=>({
  _id:id,
  id,
  locations:[location],
  status:'active',
  deleted:false,
  stockAdult:10,
  stockChildren:10,
  stockBaby:10,
  priceNewAdult:100000,
  priceNewChildren:50000,
  priceNewBaby:0,
  departureDate:new Date('2026-08-01'),
  avatar:'tour.jpg',
  name:'Tour A',
  slug:'tour-a',
  ...overrides
});

test('cart add rejects invalid tour and city ids',async()=>{
  const req=createRequest({
    body:{tourId:'bad',locationFrom:'bad',quantityAdult:1,quantityChildren:0,quantityBaby:0},
    user:makeUser()
  });
  const res=createResponse();
  await cartController.addPost(req,res);
  assert.equal(res.statusCode,400);
});

test('cart add rejects negative and fractional quantities',async()=>{
  const id=objectId();
  const req=createRequest({
    body:{tourId:id,locationFrom:id,quantityAdult:-1,quantityChildren:0.5,quantityBaby:0},
    user:makeUser()
  });
  const res=createResponse();
  await cartController.addPost(req,res);
  assert.equal(res.statusCode,400);
});

test('cart add requires at least one passenger',async()=>{
  const tourId=objectId();
  const cityId=objectId();
  const req=createRequest({
    body:{tourId,locationFrom:cityId,quantityAdult:0,quantityChildren:0,quantityBaby:0},
    user:makeUser()
  });
  const res=createResponse();
  await cartController.addPost(req,res);
  assert.equal(res.statusCode,400);
});

test('cart add rejects a departure city not supported by the tour',async()=>{
  const tourId=objectId();
  const cityId=objectId();
  stub(Tour,'findOne',async()=>tourRecord(tourId,objectId()),restores);
  stub(City,'exists',async()=>true,restores);
  const req=createRequest({
    body:{tourId,locationFrom:cityId,quantityAdult:1,quantityChildren:0,quantityBaby:0},
    user:makeUser()
  });
  const res=createResponse();
  await cartController.addPost(req,res);
  assert.equal(res.statusCode,404);
});

test('cart add prevents aggregate quantities from exceeding tour stock',async()=>{
  const tourId=objectId();
  const cityId=objectId();
  stub(Tour,'findOne',async()=>tourRecord(tourId,cityId,{stockAdult:2}),restores);
  stub(City,'exists',async()=>true,restores);
  const user=makeUser([{
    _id:objectId(),tourId,locationFrom:cityId,
    quantityAdult:2,quantityChildren:0,quantityBaby:0,checked:true
  }]);
  const req=createRequest({
    body:{tourId,locationFrom:cityId,quantityAdult:1,quantityChildren:0,quantityBaby:0},user
  });
  const res=createResponse();
  await cartController.addPost(req,res);
  assert.equal(res.statusCode,409);
});

test('cart add merges matching tour and departure entries',async()=>{
  const tourId=objectId();
  const cityId=objectId();
  const item={
    _id:objectId(),tourId,locationFrom:cityId,
    quantityAdult:1,quantityChildren:0,quantityBaby:0,checked:false
  };
  const user=makeUser([item]);
  stub(Tour,'findOne',async()=>tourRecord(tourId,cityId),restores);
  stub(City,'exists',async()=>true,restores);
  const req=createRequest({
    body:{tourId,locationFrom:cityId,quantityAdult:2,quantityChildren:1,quantityBaby:0},user
  });
  const res=createResponse();
  await cartController.addPost(req,res);
  assert.equal(item.quantityAdult,3);
  assert.equal(item.quantityChildren,1);
  assert.equal(item.checked,true);
  assert.equal(user.saved,true);
});

test('cart update rejects a non-boolean checked field',async()=>{
  const itemId=objectId();
  const user=makeUser([{_id:itemId}]);
  const req=createRequest({params:{itemId},body:{checked:'true'},user});
  const res=createResponse();
  await cartController.updatePatch(req,res);
  assert.equal(res.statusCode,400);
});

test('cart update prevents all passenger quantities becoming zero',async()=>{
  const itemId=objectId();
  const user=makeUser([{
    _id:itemId,tourId:objectId(),locationFrom:objectId(),
    quantityAdult:1,quantityChildren:0,quantityBaby:0
  }]);
  const req=createRequest({
    params:{itemId},body:{quantityAdult:0,quantityChildren:0,quantityBaby:0},user
  });
  const res=createResponse();
  await cartController.updatePatch(req,res);
  assert.equal(res.statusCode,400);
});

test('cart update checks stock across all entries for the same tour',async()=>{
  const tourId=objectId();
  const cityId=objectId();
  const itemId=objectId();
  const user=makeUser([
    {_id:itemId,tourId,locationFrom:cityId,quantityAdult:1,quantityChildren:0,quantityBaby:0},
    {_id:objectId(),tourId,locationFrom:objectId(),quantityAdult:2,quantityChildren:0,quantityBaby:0}
  ]);
  stub(Tour,'findOne',async()=>tourRecord(tourId,cityId,{stockAdult:3}),restores);
  const req=createRequest({params:{itemId},body:{quantityAdult:2},user});
  const res=createResponse();
  await cartController.updatePatch(req,res);
  assert.equal(res.statusCode,409);
});

test('order creation rejects mutable customer fields and uses account profile data',async()=>{
  const tourId=objectId();
  const cityId=objectId();
  const itemId=objectId();
  const user=makeUser([{
    _id:itemId,tourId,locationFrom:cityId,
    quantityAdult:1,quantityChildren:1,quantityBaby:0,checked:true
  }]);
  let orderPayload=null;
  stub(Tour,'find',async()=>[tourRecord(tourId,cityId)],restores);
  stub(Tour,'findOneAndUpdate',async()=>({id:tourId}),restores);
  stub(Order,'create',async payload=>{
    orderPayload=payload;
    return {_id:payload._id,id:String(payload._id),orderCode:payload.orderCode};
  },restores);
  stub(Notification,'create',async()=>({}),restores);
  const req=createRequest({
    body:{
      fullName:'Attacker Name',phone:'0000000000',note:'Window seat',paymentMethod:'money'
    },
    user
  });
  const res=createResponse();
  await orderController.createPost(req,res);
  assert.equal(orderPayload.fullName,'Nguyen Van A');
  assert.equal(orderPayload.phone,'0901234567');
  assert.equal(orderPayload.subTotal,150000);
  assert.equal(user.cart.length,0);
  assert.equal(res.statusCode,201);
});

test('order creation rejects invalid payment methods before reserving stock',async()=>{
  const user=makeUser();
  const req=createRequest({body:{paymentMethod:'crypto'},user});
  const res=createResponse();
  await orderController.createPost(req,res);
  assert.equal(res.statusCode,400);
});

test('order creation rejects oversized notes',async()=>{
  const user=makeUser();
  const req=createRequest({body:{paymentMethod:'money',note:'x'.repeat(1001)},user});
  const res=createResponse();
  await orderController.createPost(req,res);
  assert.equal(res.statusCode,400);
});

test('order creation requires at least one checked cart item',async()=>{
  const user=makeUser([{
    _id:objectId(),tourId:objectId(),locationFrom:objectId(),
    quantityAdult:1,quantityChildren:0,quantityBaby:0,checked:false
  }]);
  const req=createRequest({body:{paymentMethod:'money'},user});
  const res=createResponse();
  await orderController.createPost(req,res);
  assert.equal(res.statusCode,400);
});

test('order creation rejects a tour removed after it was added to cart',async()=>{
  const user=makeUser([{
    _id:objectId(),tourId:objectId(),locationFrom:objectId(),
    quantityAdult:1,quantityChildren:0,quantityBaby:0,checked:true
  }]);
  stub(Tour,'find',async()=>[],restores);
  const req=createRequest({body:{paymentMethod:'money'},user});
  const res=createResponse();
  await orderController.createPost(req,res);
  assert.equal(res.statusCode,409);
});

test('order creation reports a stock race without creating an order',async()=>{
  const tourId=objectId();
  const cityId=objectId();
  const user=makeUser([{
    _id:objectId(),tourId,locationFrom:cityId,
    quantityAdult:1,quantityChildren:0,quantityBaby:0,checked:true
  }]);
  let created=false;
  stub(Tour,'find',async()=>[tourRecord(tourId,cityId)],restores);
  stub(Tour,'findOneAndUpdate',async()=>null,restores);
  stub(Order,'create',async()=>{created=true;},restores);
  const req=createRequest({body:{paymentMethod:'money'},user});
  const res=createResponse();
  await orderController.createPost(req,res);
  assert.equal(res.statusCode,409);
  assert.equal(created,false);
});

test('order creation restores reserved stock if persistence fails',async()=>{
  const tourId=objectId();
  const cityId=objectId();
  const user=makeUser([{
    _id:objectId(),tourId,locationFrom:cityId,
    quantityAdult:2,quantityChildren:1,quantityBaby:0,checked:true
  }]);
  let rollback=null;
  stub(Tour,'find',async()=>[tourRecord(tourId,cityId)],restores);
  stub(Tour,'findOneAndUpdate',async()=>({id:tourId}),restores);
  stub(Order,'create',async()=>{throw new Error('database failure');},restores);
  stub(Tour,'updateOne',async(filter,payload)=>{rollback={filter,payload};},restores);
  const req=createRequest({body:{paymentMethod:'money'},user});
  const res=createResponse();
  await orderController.createPost(req,res);
  assert.deepEqual(rollback.payload.$inc,{stockAdult:2,stockChildren:1,stockBaby:0});
  assert.equal(res.statusCode,500);
});

test('order creation succeeds even if its notification fails',async()=>{
  stub(console,'error',()=>{},restores);
  const tourId=objectId();
  const cityId=objectId();
  const user=makeUser([{
    _id:objectId(),tourId,locationFrom:cityId,
    quantityAdult:1,quantityChildren:0,quantityBaby:0,checked:true
  }]);
  stub(Tour,'find',async()=>[tourRecord(tourId,cityId)],restores);
  stub(Tour,'findOneAndUpdate',async()=>({id:tourId}),restores);
  stub(Order,'create',async payload=>({_id:payload._id,id:String(payload._id),orderCode:payload.orderCode}),restores);
  stub(Notification,'create',async()=>{throw new Error('notification down');},restores);
  const req=createRequest({body:{paymentMethod:'money'},user});
  const res=createResponse();
  await orderController.createPost(req,res);
  assert.equal(res.statusCode,201);
  assert.equal(res.body.code,'success');
});
