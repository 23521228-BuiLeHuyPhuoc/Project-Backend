const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('crypto');
const mongoose=require('mongoose');
const qs=require('qs');
const CryptoJS=require('crypto-js');

global.pathAdmin='admin';
process.env.JWT_SECRET='test-secret';
process.env.ZALOPAY_KEY2='zalopay-key-2';
process.env.VNPAY_SECRETKEY='vnpay-secret';

const axios=require('axios');
const bcrypt=require('bcrypt');
const jwt=require('jsonwebtoken');
const sendMail=require('../helpers/mail.helper');
const sortHelper=require('../helpers/sort.helper');
const AccountAdmin=require('../models/account-admin.model');
const City=require('../models/city.model');
const ForgotPassword=require('../models/forgot-password.model');
const Notification=require('../models/notification.model');
const Order=require('../models/order.model');
const Tour=require('../models/tour.model');
const UserVoucher=require('../models/user-voucher.model');
const adminAccountController=require('../controllers/admin/account.controller');
const adminOrderController=require('../controllers/admin/order.controller');
const adminProfileController=require('../controllers/admin/profile.controller');
const orderController=require('../controllers/client/order.controller');
const {createRequest,createResponse,restoreAll,stub}=require('./test-utils');

const restores=[];
test.afterEach(()=>restoreAll(restores));
const objectId=()=>new mongoose.Types.ObjectId().toString();

const zaloCallback=(data,mac)=>({
  body:{
    data:JSON.stringify(data),
    mac:mac || CryptoJS.HmacSHA256(JSON.stringify(data),process.env.ZALOPAY_KEY2).toString()
  }
});

const signedVnPayQuery=overrides=>{
  const params={
    vnp_TxnRef:`${objectId()}-123`,
    vnp_Amount:'10000000',
    vnp_ResponseCode:'00',
    vnp_TransactionStatus:'00',
    ...overrides
  };
  const sorted=sortHelper.sortObject(params);
  const signData=qs.stringify(sorted,{encode:false});
  const signature=crypto.createHmac('sha512',process.env.VNPAY_SECRETKEY)
    .update(Buffer.from(signData,'utf8'))
    .digest('hex');
  return {...params,vnp_SecureHash:signature};
};

test('ZaloPay callback rejects an invalid MAC without touching orders',async()=>{
  let queried=false;
  stub(Order,'findOne',async()=>{queried=true;},restores);
  const req=createRequest(zaloCallback({app_user:`0901234567-${objectId()}`,amount:100000},'bad-mac'));
  const res=createResponse();
  await orderController.paymentZaloPayResultPost(req,res);
  assert.equal(res.body.return_code,-1);
  assert.equal(queried,false);
});

test('ZaloPay callback rejects malformed app_user data',async()=>{
  const req=createRequest(zaloCallback({app_user:'malformed',amount:100000}));
  const res=createResponse();
  await orderController.paymentZaloPayResultPost(req,res);
  assert.equal(res.body.return_code,0);
});

test('ZaloPay callback rejects a callback that does not match an order',async()=>{
  stub(Order,'findOne',async()=>null,restores);
  const req=createRequest(zaloCallback({app_user:`0901234567-${objectId()}`,amount:100000}));
  const res=createResponse();
  await orderController.paymentZaloPayResultPost(req,res);
  assert.equal(res.body.return_code,0);
});

test('repeated ZaloPay callbacks do not regress completed paid orders',async()=>{
  let updates=0;
  stub(Order,'findOne',async()=>({paymentStatus:'paid',status:'completed'}),restores);
  stub(Order,'updateOne',async()=>{updates+=1;},restores);
  const req=createRequest(zaloCallback({app_user:`0901234567-${objectId()}`,amount:100000}));
  const res=createResponse();
  await orderController.paymentZaloPayResultPost(req,res);
  assert.equal(res.body.return_code,1);
  assert.equal(updates,0);
});

test('ZaloPay callback atomically confirms an unpaid initial order',async()=>{
  let filter=null;
  let update=null;
  stub(Order,'findOne',async()=>({paymentStatus:'unpaid',status:'initial'}),restores);
  stub(Order,'updateOne',async(value,payload)=>{filter=value; update=payload; return {matchedCount:1};},restores);
  const req=createRequest(zaloCallback({app_user:`0901234567-${objectId()}`,amount:100000}));
  const res=createResponse();
  await orderController.paymentZaloPayResultPost(req,res);
  assert.equal(filter.paymentStatus,'unpaid');
  assert.deepEqual(filter.status,{$in:['initial','pending']});
  assert.deepEqual(update.$set,{paymentStatus:'paid',status:'confirmed'});
  assert.equal(res.body.return_code,1);
});

test('ZaloPay callback rejects cancelled orders',async()=>{
  stub(Order,'findOne',async()=>({paymentStatus:'unpaid',status:'cancelled'}),restores);
  const req=createRequest(zaloCallback({app_user:`0901234567-${objectId()}`,amount:100000}));
  const res=createResponse();
  await orderController.paymentZaloPayResultPost(req,res);
  assert.equal(res.body.return_code,0);
});

test('ZaloPay callback handles a concurrent successful callback idempotently',async()=>{
  let finds=0;
  stub(Order,'findOne',async()=>{
    finds+=1;
    return finds===1
      ? {paymentStatus:'unpaid',status:'initial'}
      : {paymentStatus:'paid',status:'confirmed'};
  },restores);
  stub(Order,'updateOne',async()=>({matchedCount:0}),restores);
  const req=createRequest(zaloCallback({app_user:`0901234567-${objectId()}`,amount:100000}));
  const res=createResponse();
  await orderController.paymentZaloPayResultPost(req,res);
  assert.equal(res.body.return_code,1);
});

test('ZaloPay initiation rejects invalid order ids',async()=>{
  const req=createRequest({params:{orderId:'invalid'},user:{id:'user'}});
  const res=createResponse();
  await orderController.paymentZaloPay(req,res);
  assert.equal(res.redirectUrl,'/cart');
});

test('ZaloPay initiation cancels reservations when the gateway explicitly rejects creation',async()=>{
  const id=objectId();
  let calls=0;
  const order={id,_id:id,userId:'user',phone:'0901234567',total:100000,orderCode:'OD1',items:[]};
  stub(Order,'findOne',async()=>order,restores);
  stub(axios,'post',async()=>({data:{return_code:0}}),restores);
  stub(Order,'findOneAndUpdate',async()=>{calls+=1; return order;},restores);
  stub(UserVoucher,'findOneAndUpdate',async()=>null,restores);
  const req=createRequest({params:{orderId:id},user:{id:'user'}});
  const res=createResponse();
  await orderController.paymentZaloPay(req,res);
  assert.equal(calls,1);
  assert.equal(res.redirectUrl,`/account/orders/${id}`);
});

test('VNPay rejects an invalid signature without querying orders',async()=>{
  let queried=false;
  stub(Order,'findOne',async()=>{queried=true;},restores);
  const req=createRequest({query:{vnp_SecureHash:'bad',vnp_TxnRef:`${objectId()}-1`}});
  const res=createResponse();
  await orderController.paymentVnPayResult(req,res);
  assert.equal(res.redirectUrl,'/account/orders');
  assert.equal(queried,false);
});

test('repeated VNPay returns do not regress completed paid orders',async()=>{
  const id=objectId();
  let updates=0;
  stub(Order,'findOne',async()=>({paymentStatus:'paid',status:'completed',total:100000}),restores);
  stub(Order,'updateOne',async()=>{updates+=1;},restores);
  const req=createRequest({query:signedVnPayQuery({vnp_TxnRef:`${id}-1`})});
  const res=createResponse();
  await orderController.paymentVnPayResult(req,res);
  assert.equal(updates,0);
  assert.equal(res.redirectUrl,`/order/success?orderId=${id}`);
});

test('VNPay confirms an unpaid order only from initial or pending',async()=>{
  const id=objectId();
  let filter=null;
  stub(Order,'findOne',async()=>({paymentStatus:'unpaid',status:'pending',total:100000}),restores);
  stub(Order,'updateOne',async value=>{filter=value; return {matchedCount:1};},restores);
  const req=createRequest({query:signedVnPayQuery({vnp_TxnRef:`${id}-1`})});
  const res=createResponse();
  await orderController.paymentVnPayResult(req,res);
  assert.equal(filter.paymentStatus,'unpaid');
  assert.deepEqual(filter.status,{$in:['initial','pending']});
  assert.equal(res.redirectUrl,`/order/success?orderId=${id}`);
});

test('VNPay amount mismatch cancels an unpaid reservation and releases it',async()=>{
  const id=objectId();
  const order={_id:id,userId:'user',paymentStatus:'unpaid',status:'initial',total:200000,items:[]};
  stub(Order,'findOne',async()=>order,restores);
  stub(Order,'findOneAndUpdate',async()=>order,restores);
  stub(UserVoucher,'findOneAndUpdate',async()=>null,restores);
  const req=createRequest({query:signedVnPayQuery({vnp_TxnRef:`${id}-1`,vnp_Amount:'10000000'})});
  const res=createResponse();
  await orderController.paymentVnPayResult(req,res);
  assert.equal(res.redirectUrl,`/account/orders/${id}`);
});

test('admin order edit blocks paid-to-unpaid rollback',async()=>{
  stub(Order,'findOne',async()=>({
    id:'order',status:'confirmed',paymentStatus:'paid',paymentMethod:'bank'
  }),restores);
  const req=createRequest({
    params:{id:objectId()},body:{status:'confirmed',paymentStatus:'unpaid'},account:{id:'admin'}
  });
  const res=createResponse();
  await adminOrderController.editPatch(req,res);
  assert.equal(res.statusCode,400);
});

test('admin order edit cannot manually mark online payments paid',async()=>{
  stub(Order,'findOne',async()=>({
    id:'order',status:'initial',paymentStatus:'unpaid',paymentMethod:'vnpay'
  }),restores);
  const req=createRequest({
    params:{id:objectId()},body:{status:'confirmed',paymentStatus:'paid'},account:{id:'admin'}
  });
  const res=createResponse();
  await adminOrderController.editPatch(req,res);
  assert.equal(res.statusCode,400);
});

test('admin order edit requires cash confirmation to use the dedicated action',async()=>{
  stub(Order,'findOne',async()=>({
    id:'order',status:'initial',paymentStatus:'unpaid',paymentMethod:'money'
  }),restores);
  const req=createRequest({
    params:{id:objectId()},body:{status:'confirmed',paymentStatus:'unpaid'},account:{id:'admin'}
  });
  const res=createResponse();
  await adminOrderController.editPatch(req,res);
  assert.equal(res.statusCode,400);
});

test('admin may mark an already confirmed online order completed',async()=>{
  let updated=null;
  stub(Order,'findOne',async()=>({
    id:'order',status:'confirmed',paymentStatus:'paid',paymentMethod:'zalopay'
  }),restores);
  stub(Order,'updateOne',async(filter,payload)=>{updated=payload;},restores);
  const req=createRequest({
    params:{id:objectId()},body:{status:'completed',paymentStatus:'paid'},account:{id:'admin'},flash(){}
  });
  const res=createResponse();
  await adminOrderController.editPatch(req,res);
  assert.equal(updated.status,'completed');
  assert.equal(res.body.code,'success');
});

test('cash confirmation only matches unpaid cash orders',async()=>{
  let filter=null;
  stub(Order,'findOneAndUpdate',async value=>{
    filter=value;
    return {_id:'order',id:'order',userId:'user',orderCode:'OD1'};
  },restores);
  stub(Notification,'create',async()=>({}),restores);
  const req=createRequest({
    params:{id:objectId(),decision:'confirmed'},
    permissions:['order-edit'],account:{id:'admin'},flash(){}
  });
  const res=createResponse();
  await adminOrderController.confirmCashOrder(req,res);
  assert.equal(filter.paymentMethod,'money');
  assert.equal(filter.paymentStatus,'unpaid');
  assert.equal(res.redirectUrl,'/admin/order/list');
});

test('admin order list applies filters, escaped search and pagination',async()=>{
  let findFilter=null;
  let skipped=null;
  stub(Order,'countDocuments',async()=>25,restores);
  stub(Order,'find',filter=>{
    findFilter=filter;
    return {
      sort(){return this;},
      skip(value){skipped=value; return this;},
      limit:async()=>[]
    };
  },restores);
  stub(Tour,'find',()=>({select(){return this;},lean:async()=>[]}),restores);
  const req=createRequest({query:{
    status:'confirmed',paymentMethod:'vnpay',paymentStatus:'paid',
    fromDate:'2026-01-01',toDate:'2026-01-31',search:'OD[1]',page:'2'
  }});
  const res=createResponse();
  await adminOrderController.list(req,res);
  assert.equal(findFilter.status,'confirmed');
  assert.equal(findFilter.paymentMethod,'vnpay');
  assert.equal(findFilter.$or[0].orderCode.test('OD[1]'),true);
  assert.equal(findFilter.$or[0].orderCode.test('OD11'),false);
  assert.equal(skipped,10);
  assert.equal(res.rendered.data.pagination.currentPage,2);
});

test('admin login creates a purpose-limited session token',async()=>{
  const account={id:'admin',email:'admin@example.com',password:'hash',status:'active'};
  let tokenPayload=null;
  stub(AccountAdmin,'findOne',()=>({select:async()=>account}),restores);
  stub(bcrypt,'compare',async()=>true,restores);
  stub(jwt,'sign',payload=>{tokenPayload=payload; return 'token';},restores);
  const req=createRequest({body:{email:'admin@example.com',password:'secret',rememberPassword:false}});
  const res=createResponse();
  await adminAccountController.loginPost(req,res);
  assert.equal(tokenPayload.purpose,'admin-session');
  assert.equal(res.cookies[0].name,'token');
  assert.equal(res.cookies[0].options.httpOnly,true);
});

test('admin forgot-password stores only an OTP hash',async()=>{
  const account={id:'admin',email:'admin@example.com'};
  let payload=null;
  stub(AccountAdmin,'findOne',async()=>account,restores);
  stub(ForgotPassword,'findOne',async()=>null,restores);
  stub(bcrypt,'hash',async()=> 'otp-hash',restores);
  stub(ForgotPassword,'create',async value=>{
    payload=value;
    return {deleteOne:async()=>{}};
  },restores);
  stub(sendMail,'sendMail',async()=>({success:true}),restores);
  const req=createRequest({body:{email:'admin@example.com'}});
  const res=createResponse();
  await adminAccountController.forgotPasswordPost(req,res);
  assert.equal(payload.otpHash,'otp-hash');
  assert.equal(Object.hasOwn(payload,'otp'),false);
  assert.equal(res.body.code,'success');
});

test('admin OTP verification issues a reset cookie, not an admin login cookie',async()=>{
  const request={
    id:'request',userId:'admin',email:'admin@example.com',otpHash:'hash',attempts:0,
    save:async()=>{}
  };
  stub(ForgotPassword,'findOne',()=>({select:async()=>request}),restores);
  stub(bcrypt,'compare',async()=>true,restores);
  stub(jwt,'sign',()=> 'reset-token',restores);
  const req=createRequest({body:{email:'admin@example.com',otp:'123456'}});
  const res=createResponse();
  await adminAccountController.otpPasswordPost(req,res);
  assert.equal(res.cookies[0].name,'tokenResetAdmin');
  assert.equal(res.cookies.some(item=>item.name==='token'),false);
});

test('admin OTP verification deletes a request after five failed attempts',async()=>{
  let deleted=false;
  const request={
    otpHash:'hash',attempts:4,
    deleteOne:async()=>{deleted=true;},save:async()=>{}
  };
  stub(ForgotPassword,'findOne',()=>({select:async()=>request}),restores);
  stub(bcrypt,'compare',async()=>false,restores);
  const req=createRequest({body:{email:'admin@example.com',otp:'000000'}});
  const res=createResponse();
  await adminAccountController.otpPasswordPost(req,res);
  assert.equal(deleted,true);
  assert.equal(res.statusCode,429);
});

test('admin reset endpoint refuses a normal login cookie without reset cookie',async()=>{
  const req=createRequest({cookies:{token:'admin-session'},body:{password:'Strong@123'}});
  const res=createResponse();
  await adminAccountController.resetPasswordPost(req,res);
  assert.equal(res.statusCode,401);
});

test('admin password reset consumes the reset request and clears all related cookies',async()=>{
  let requestDeleted=false;
  let accountSaved=false;
  const resetRequest={
    userId:'admin',email:'admin@example.com',
    deleteOne:async()=>{requestDeleted=true;}
  };
  const account={
    password:'old-hash',
    save:async()=>{accountSaved=true;}
  };
  stub(jwt,'verify',()=>({
    purpose:'reset-admin-password',requestId:'request',id:'admin',email:'admin@example.com'
  }),restores);
  stub(ForgotPassword,'findOne',async()=>resetRequest,restores);
  stub(AccountAdmin,'findOne',()=>({select:async()=>account}),restores);
  stub(bcrypt,'compare',async()=>false,restores);
  stub(bcrypt,'hash',async()=> 'new-hash',restores);
  const req=createRequest({cookies:{tokenResetAdmin:'reset'},body:{password:'Strong@123'}});
  const res=createResponse();
  await adminAccountController.resetPasswordPost(req,res);
  assert.equal(account.password,'new-hash');
  assert.equal(accountSaved,true);
  assert.equal(requestDeleted,true);
  assert.deepEqual(res.clearedCookies,['tokenResetAdmin','token']);
});

test('admin profile rejects an email used by another account',async()=>{
  stub(AccountAdmin,'exists',async()=>true,restores);
  const req=createRequest({
    account:{id:'admin'},
    body:{fullName:'Admin User',email:'used@example.com',phone:'0901234567'}
  });
  const res=createResponse();
  await adminProfileController.editPatch(req,res);
  assert.equal(res.statusCode,409);
});

test('admin profile normalizes data and renews the session after email changes',async()=>{
  let update=null;
  let tokenPayload=null;
  stub(AccountAdmin,'exists',async()=>false,restores);
  stub(AccountAdmin,'findOne',async()=>({id:'admin',_id:'admin'}),restores);
  stub(AccountAdmin,'updateOne',async(filter,payload)=>{update=payload;},restores);
  stub(jwt,'sign',payload=>{tokenPayload=payload; return 'new-token';},restores);
  const req=createRequest({
    account:{id:'admin'},flash(){},
    body:{fullName:' Admin User ',email:'NEW@EXAMPLE.COM ',phone:'090-123.4567'}
  });
  const res=createResponse();
  await adminProfileController.editPatch(req,res);
  assert.equal(update.email,'new@example.com');
  assert.equal(update.phone,'0901234567');
  assert.equal(tokenPayload.purpose,'admin-session');
  assert.equal(res.cookies[0].name,'token');
  assert.equal(res.body.code,'success');
});
