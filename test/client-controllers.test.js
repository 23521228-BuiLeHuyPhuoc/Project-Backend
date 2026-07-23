const test=require('node:test');
const assert=require('node:assert/strict');
const mongoose=require('mongoose');

process.env.JWT_SECRET=process.env.JWT_SECRET || 'test-secret';

const bcrypt=require('bcrypt');
const Favorite=require('../models/favorite.model');
const Notification=require('../models/notification.model');
const Order=require('../models/order.model');
const Review=require('../models/review.model');
const Tour=require('../models/tour.model');
const User=require('../models/user.model');
const UserVoucher=require('../models/user-voucher.model');
const Voucher=require('../models/voucher.model');
const accountController=require('../controllers/client/account.controller');
const authController=require('../controllers/client/auth.controller');
const favoriteController=require('../controllers/client/favorite.controller');
const notificationController=require('../controllers/client/notification.controller');
const reviewController=require('../controllers/client/review.controller');
const voucherController=require('../controllers/client/voucher.controller');
const {createRequest,createResponse,restoreAll,stub}=require('./test-utils');

const restores=[];
test.afterEach(()=>restoreAll(restores));

const objectId=()=>new mongoose.Types.ObjectId().toString();
const silenceNotificationErrors=()=>stub(console,'error',()=>{},restores);

test('favorite toggle rejects invalid tour ids before querying',async()=>{
  const req=createRequest({params:{tourId:'bad-id'},user:{id:'user'}});
  const res=createResponse();
  await favoriteController.toggle(req,res);
  assert.equal(res.statusCode,400);
});

test('favorite toggle returns 404 for unavailable tours',async()=>{
  stub(Tour,'findOne',async()=>null,restores);
  const req=createRequest({params:{tourId:objectId()},user:{id:'user'}});
  const res=createResponse();
  await favoriteController.toggle(req,res);
  assert.equal(res.statusCode,404);
});

test('favorite toggle removes an existing favorite owned by the user',async()=>{
  let deleted=false;
  stub(Tour,'findOne',async()=>({id:'tour'}),restores);
  stub(Favorite,'findOne',async()=>({deleteOne:async()=>{deleted=true;}}),restores);
  const req=createRequest({params:{tourId:objectId()},user:{id:'user'}});
  const res=createResponse();
  await favoriteController.toggle(req,res);
  assert.equal(deleted,true);
  assert.equal(res.body.favorited,false);
});

test('favorite toggle creates a missing favorite',async()=>{
  let payload=null;
  stub(Tour,'findOne',async()=>({id:'tour'}),restores);
  stub(Favorite,'findOne',async()=>null,restores);
  stub(Favorite,'create',async value=>{payload=value;},restores);
  const req=createRequest({params:{tourId:objectId()},user:{id:'user'}});
  const res=createResponse();
  await favoriteController.toggle(req,res);
  assert.deepEqual(payload,{userId:'user',tourId:'tour'});
  assert.equal(res.body.favorited,true);
});

test('favorite toggle treats a concurrent duplicate insert as favorited',async()=>{
  stub(Tour,'findOne',async()=>({id:'tour'}),restores);
  stub(Favorite,'findOne',async()=>null,restores);
  stub(Favorite,'create',async()=>{const error=new Error('duplicate'); error.code=11000; throw error;},restores);
  const req=createRequest({params:{tourId:objectId()},user:{id:'user'}});
  const res=createResponse();
  await favoriteController.toggle(req,res);
  assert.equal(res.statusCode,200);
  assert.equal(res.body.favorited,true);
});

test('voucher claim rejects invalid ids',async()=>{
  const req=createRequest({params:{id:'invalid'},user:{id:'user'}});
  const res=createResponse();
  await voucherController.claim(req,res);
  assert.equal(res.statusCode,400);
});

test('voucher claim rejects expired or exhausted vouchers',async()=>{
  stub(Voucher,'findOne',async()=>null,restores);
  const req=createRequest({params:{id:objectId()},user:{id:'user'}});
  const res=createResponse();
  await voucherController.claim(req,res);
  assert.equal(res.statusCode,400);
});

test('voucher claim rejects vouchers already in the wallet',async()=>{
  stub(Voucher,'findOne',async()=>({id:'voucher',usageLimit:0,usedCount:0}),restores);
  stub(UserVoucher,'findOne',async()=>({id:'wallet'}),restores);
  const req=createRequest({params:{id:objectId()},user:{id:'user'}});
  const res=createResponse();
  await voucherController.claim(req,res);
  assert.equal(res.statusCode,409);
});

test('voucher claim succeeds even when its notification cannot be created',async()=>{
  silenceNotificationErrors();
  stub(Voucher,'findOne',async()=>({id:'voucher',code:'SAVE',usageLimit:0,usedCount:0}),restores);
  stub(UserVoucher,'findOne',async()=>null,restores);
  stub(UserVoucher,'create',async()=>({id:'wallet'}),restores);
  stub(Notification,'create',async()=>{throw new Error('notification down');},restores);
  const req=createRequest({params:{id:objectId()},user:{id:'user'}});
  const res=createResponse();
  await voucherController.claim(req,res);
  assert.equal(res.statusCode,200);
  assert.equal(res.body.code,'success');
});

test('voucher removal is restricted to available vouchers owned by the user',async()=>{
  let filter=null;
  stub(UserVoucher,'deleteOne',async value=>{filter=value; return {deletedCount:1};},restores);
  const req=createRequest({params:{id:objectId()},user:{id:'user'}});
  const res=createResponse();
  await voucherController.remove(req,res);
  assert.equal(filter.userId,'user');
  assert.equal(filter.status,'available');
  assert.equal(res.body.code,'success');
});

test('notification read rejects invalid ids',async()=>{
  const req=createRequest({params:{id:'invalid'},user:{id:'user'}});
  const res=createResponse();
  await notificationController.read(req,res);
  assert.equal(res.statusCode,400);
});

test('notification read enforces user ownership',async()=>{
  let filter=null;
  stub(Notification,'findOneAndUpdate',async value=>{filter=value; return null;},restores);
  const req=createRequest({params:{id:objectId()},user:{id:'user'}});
  const res=createResponse();
  await notificationController.read(req,res);
  assert.equal(filter.userId,'user');
  assert.equal(res.statusCode,404);
});

test('notification removal soft-deletes only an owned record',async()=>{
  let filter=null;
  stub(Notification,'updateOne',async value=>{filter=value; return {matchedCount:1};},restores);
  const req=createRequest({params:{id:objectId()},user:{id:'user'}});
  const res=createResponse();
  await notificationController.remove(req,res);
  assert.equal(filter.userId,'user');
  assert.equal(res.body.code,'success');
});

const completedOrder=()=>({id:'order',_id:'order',orderCode:'OD1'});

test('review creation rejects orders not completed and paid by the user',async()=>{
  stub(Order,'findOne',async()=>null,restores);
  const req=createRequest({
    body:{orderId:objectId(),tourId:objectId(),rating:5,comment:'Excellent trip'},
    user:{id:'user'}
  });
  const res=createResponse();
  await reviewController.create(req,res);
  assert.equal(res.statusCode,403);
});

test('review creation rejects an existing active review',async()=>{
  stub(Order,'findOne',async()=>completedOrder(),restores);
  stub(Review,'findOne',async()=>({deleted:false}),restores);
  const req=createRequest({
    body:{orderId:objectId(),tourId:objectId(),rating:5,comment:'Excellent trip'},
    user:{id:'user'}
  });
  const res=createResponse();
  await reviewController.create(req,res);
  assert.equal(res.statusCode,409);
});

test('review creation revives a previously soft-deleted review',async()=>{
  silenceNotificationErrors();
  const existing={
    id:'review',deleted:true,status:'hidden',deletedAt:new Date(),
    save:async function(){return this;}
  };
  stub(Order,'findOne',async()=>completedOrder(),restores);
  stub(Review,'findOne',async()=>existing,restores);
  stub(Notification,'create',async()=>{throw new Error('notification down');},restores);
  const req=createRequest({
    body:{orderId:objectId(),tourId:objectId(),rating:4,comment:'Updated review content'},
    user:{id:'user'}
  });
  const res=createResponse();
  await reviewController.create(req,res);
  assert.equal(existing.deleted,false);
  assert.equal(existing.deletedAt,null);
  assert.equal(existing.status,'published');
  assert.equal(existing.rating,4);
  assert.equal(res.statusCode,201);
});

test('review creation succeeds when notification creation fails',async()=>{
  silenceNotificationErrors();
  stub(Order,'findOne',async()=>completedOrder(),restores);
  stub(Review,'findOne',async()=>null,restores);
  stub(Review,'create',async()=>({id:'review'}),restores);
  stub(Notification,'create',async()=>{throw new Error('notification down');},restores);
  const req=createRequest({
    body:{orderId:objectId(),tourId:objectId(),rating:5,comment:'Excellent trip'},
    user:{id:'user'}
  });
  const res=createResponse();
  await reviewController.create(req,res);
  assert.equal(res.statusCode,201);
  assert.equal(res.body.reviewId,'review');
});

test('review update rejects invalid ids before querying',async()=>{
  const req=createRequest({params:{id:'invalid'},body:{rating:4,comment:'Updated review'},user:{id:'user'}});
  const res=createResponse();
  await reviewController.update(req,res);
  assert.equal(res.statusCode,400);
});

test('review update enforces ownership',async()=>{
  let filter=null;
  stub(Review,'findOneAndUpdate',async value=>{filter=value; return null;},restores);
  const req=createRequest({params:{id:objectId()},body:{rating:4,comment:'Updated review'},user:{id:'user'}});
  const res=createResponse();
  await reviewController.update(req,res);
  assert.equal(filter.userId,'user');
  assert.equal(res.statusCode,404);
});

test('account order detail redirects invalid ids without querying',async()=>{
  const req=createRequest({params:{id:'invalid'},user:{id:'user'}});
  const res=createResponse();
  await accountController.orderDetail(req,res);
  assert.equal(res.redirectUrl,'/account/orders');
});

test('account cancellation rejects invalid ids',async()=>{
  const req=createRequest({params:{id:'invalid'},user:{id:'user'}});
  const res=createResponse();
  await accountController.cancelOrder(req,res);
  assert.equal(res.statusCode,400);
});

test('account cancellation returns success even if notification creation fails',async()=>{
  silenceNotificationErrors();
  const order={_id:'order',id:'order',userId:'user',orderCode:'OD1',items:[]};
  stub(Order,'findOneAndUpdate',async()=>order,restores);
  stub(UserVoucher,'findOneAndUpdate',async()=>null,restores);
  stub(Notification,'create',async()=>{throw new Error('notification down');},restores);
  const req=createRequest({params:{id:objectId()},user:{id:'user'}});
  const res=createResponse();
  await accountController.cancelOrder(req,res);
  assert.equal(res.statusCode,200);
  assert.equal(res.body.code,'success');
});

test('registration succeeds even if welcome notification fails',async()=>{
  silenceNotificationErrors();
  stub(User,'findOne',async()=>null,restores);
  stub(bcrypt,'genSalt',async()=> 'salt',restores);
  stub(bcrypt,'hash',async()=> 'password-hash',restores);
  stub(User,'create',async()=>({id:'user'}),restores);
  stub(Notification,'create',async()=>{throw new Error('notification down');},restores);
  const req=createRequest({
    body:{
      fullName:'Nguyen Van A',email:'user@example.com',phone:'0901234567',
      password:'Strong@123',tourTypes:[],budgetRange:'',locations:[]
    },
    flash(){}
  });
  const res=createResponse();
  await authController.registerPost(req,res);
  assert.equal(res.statusCode,201);
  assert.equal(res.body.code,'success');
});

test('profile update persists normalized validated fields only',async()=>{
  const user={id:'user',save:async()=>{}};
  stub(User,'findOne',async()=>null,restores);
  stub(User,'findById',async()=>user,restores);
  stub(Notification,'create',async()=>({}),restores);
  const req=createRequest({
    user:{id:'user'},
    body:{
      fullName:'Nguyen Van B',email:'b@example.com',phone:'0901234567',
      tourTypes:['beach'],budgetRange:'2-5',locations:['da-nang']
    }
  });
  const res=createResponse();
  await accountController.updateProfile(req,res);
  assert.equal(user.email,'b@example.com');
  assert.deepEqual(user.preferences.budgetRange,{min:2000000,max:5000000});
  assert.equal(res.body.code,'success');
});
