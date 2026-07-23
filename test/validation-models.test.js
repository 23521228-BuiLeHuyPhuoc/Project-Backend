const test=require('node:test');
const assert=require('node:assert/strict');
const mongoose=require('mongoose');

const adminAccountValidate=require('../validates/admin/account.validate');
const accountValidate=require('../validates/client/account.validate');
const authValidate=require('../validates/client/auth.validate');
const AccountAdmin=require('../models/account-admin.model');
const ForgotPassword=require('../models/forgot-password.model');
const Review=require('../models/review.model');
const User=require('../models/user.model');
const Voucher=require('../models/voucher.model');
const {createRequest,createResponse}=require('./test-utils');

const runValidation=(middleware,body)=>{
  const req=createRequest({body});
  const res=createResponse();
  let nextCalled=false;
  middleware(req,res,()=>{nextCalled=true;});
  return {req,res,nextCalled};
};

const validRegistration=overrides=>({
  fullName:'Nguyen Van A',
  email:'USER@EXAMPLE.COM ',
  phone:'0901234567',
  password:'Strong@123',
  confirmPassword:'Strong@123',
  tourTypes:['beach'],
  budgetRange:'2-5',
  locations:['da-nang'],
  agree:true,
  ...overrides
});

test('client registration normalizes email and keeps whitelisted preferences',()=>{
  const result=runValidation(authValidate.registerPost,validRegistration());
  assert.equal(result.nextCalled,true);
  assert.equal(result.req.body.email,'user@example.com');
  assert.deepEqual(result.req.body.tourTypes,['beach']);
});

test('client registration normalizes formatted phone numbers',()=>{
  const result=runValidation(authValidate.registerPost,validRegistration({phone:'090-123.4567'}));
  assert.equal(result.nextCalled,true);
  assert.equal(result.req.body.phone,'0901234567');
});

test('client registration rejects a short name',()=>{
  const {res,nextCalled}=runValidation(authValidate.registerPost,validRegistration({fullName:'A'}));
  assert.equal(nextCalled,false);
  assert.equal(res.statusCode,400);
});

test('client registration rejects malformed email',()=>{
  const {res}=runValidation(authValidate.registerPost,validRegistration({email:'not-email'}));
  assert.equal(res.statusCode,400);
});

test('client registration rejects malformed phone',()=>{
  const {res}=runValidation(authValidate.registerPost,validRegistration({phone:'123'}));
  assert.equal(res.statusCode,400);
});

test('client registration rejects weak passwords missing uppercase',()=>{
  const {res}=runValidation(authValidate.registerPost,validRegistration({
    password:'weak@123',confirmPassword:'weak@123'
  }));
  assert.equal(res.statusCode,400);
});

test('client registration rejects mismatched confirmation',()=>{
  const {res}=runValidation(authValidate.registerPost,validRegistration({confirmPassword:'Other@123'}));
  assert.equal(res.statusCode,400);
});

test('client registration requires terms agreement',()=>{
  const {res}=runValidation(authValidate.registerPost,validRegistration({agree:false}));
  assert.equal(res.statusCode,400);
});

test('client registration rejects unknown preference values',()=>{
  const {res}=runValidation(authValidate.registerPost,validRegistration({tourTypes:['space']}));
  assert.equal(res.statusCode,400);
});

test('client login accepts and normalizes a valid payload',()=>{
  const result=runValidation(authValidate.loginPost,{
    email:' USER@example.com ',password:'anything',rememberPassword:true,returnTo:'/cart'
  });
  assert.equal(result.nextCalled,true);
  assert.equal(result.req.body.email,'user@example.com');
});

test('client login rejects an external-looking return field over max length',()=>{
  const {res}=runValidation(authValidate.loginPost,{
    email:'user@example.com',password:'x',returnTo:'x'.repeat(501)
  });
  assert.equal(res.statusCode,400);
});

test('client OTP requires exactly six digits',()=>{
  const {res}=runValidation(authValidate.otpPasswordPost,{email:'user@example.com',otp:'12345a'});
  assert.equal(res.statusCode,400);
});

test('client profile validation normalizes fields and defaults arrays',()=>{
  const result=runValidation(accountValidate.profile,{
    fullName:' Nguyen Van B ',email:'B@EXAMPLE.COM',phone:'090-222.3333',budgetRange:''
  });
  assert.equal(result.nextCalled,true);
  assert.equal(result.req.body.fullName,'Nguyen Van B');
  assert.equal(result.req.body.phone,'0902223333');
  assert.deepEqual(result.req.body.locations,[]);
});

test('client profile rejects mass-assignment fields',()=>{
  const {res}=runValidation(accountValidate.profile,{
    fullName:'Nguyen Van B',email:'b@example.com',phone:'',budgetRange:'',status:'inactive'
  });
  assert.equal(res.statusCode,400);
});

test('review creation accepts valid object ids and content',()=>{
  const id=new mongoose.Types.ObjectId().toString();
  const result=runValidation(accountValidate.reviewCreate,{
    orderId:id,tourId:id,rating:5,comment:'Mot chuyen di rat tuyet voi'
  });
  assert.equal(result.nextCalled,true);
});

test('review creation rejects invalid ids',()=>{
  const {res}=runValidation(accountValidate.reviewCreate,{
    orderId:'bad',tourId:'bad',rating:5,comment:'Mot chuyen di rat tuyet voi'
  });
  assert.equal(res.statusCode,400);
});

test('review validation enforces rating boundaries',()=>{
  const {res}=runValidation(accountValidate.reviewUpdate,{rating:6,comment:'Noi dung danh gia hop le'});
  assert.equal(res.statusCode,400);
});

test('review validation enforces minimum comment length',()=>{
  const {res}=runValidation(accountValidate.reviewUpdate,{rating:4,comment:'short'});
  assert.equal(res.statusCode,400);
});

test('admin login accepts legacy passwords without enforcing new-password strength',()=>{
  const result=runValidation(adminAccountValidate.loginPost,{
    email:'ADMIN@EXAMPLE.COM',password:'legacy',rememberPassword:false
  });
  assert.equal(result.nextCalled,true);
  assert.equal(result.req.body.email,'admin@example.com');
});

test('admin login rejects malformed email',()=>{
  const {res}=runValidation(adminAccountValidate.loginPost,{email:'bad',password:'secret'});
  assert.equal(res.statusCode,400);
});

test('admin forgot-password validation only accepts an email',()=>{
  const {res}=runValidation(adminAccountValidate.forgotPasswordPost,{email:'admin@example.com',extra:true});
  assert.equal(res.statusCode,400);
});

test('admin OTP requires six numeric digits',()=>{
  const {res}=runValidation(adminAccountValidate.otpPasswordPost,{email:'admin@example.com',otp:'123'});
  assert.equal(res.statusCode,400);
});

test('admin password reset enforces strong passwords',()=>{
  const weak=runValidation(adminAccountValidate.resetPasswordPost,{password:'weak'});
  const strong=runValidation(adminAccountValidate.resetPasswordPost,{password:'Strong@123'});
  assert.equal(weak.res.statusCode,400);
  assert.equal(strong.nextCalled,true);
});

test('User model requires name, email and password',async()=>{
  const error=new User({}).validateSync();
  assert.ok(error.errors.fullName);
  assert.ok(error.errors.email);
  assert.ok(error.errors.password);
});

test('User model lowercases and trims email',()=>{
  const user=new User({fullName:'A B',email:' USER@EXAMPLE.COM ',password:'hash'});
  assert.equal(user.email,'user@example.com');
});

test('User cart rejects negative quantities',()=>{
  const user=new User({
    fullName:'A B',email:'user@example.com',password:'hash',
    cart:[{
      tourId:new mongoose.Types.ObjectId(),
      locationFrom:new mongoose.Types.ObjectId(),
      quantityAdult:-1
    }]
  });
  const error=user.validateSync();
  assert.ok(error);
});

test('Voucher model rejects invalid discount type',()=>{
  const voucher=new Voucher({
    code:'X',title:'X',discountType:'other',discountValue:1,
    startAt:new Date(),endAt:new Date(Date.now()+1000)
  });
  assert.ok(voucher.validateSync().errors.discountType);
});

test('Voucher model rejects negative discount values',()=>{
  const voucher=new Voucher({
    code:'X',title:'X',discountType:'fixed',discountValue:-1,
    startAt:new Date(),endAt:new Date(Date.now()+1000)
  });
  assert.ok(voucher.validateSync().errors.discountValue);
});

test('Review model rejects out-of-range ratings',()=>{
  const review=new Review({
    userId:new mongoose.Types.ObjectId(),tourId:new mongoose.Types.ObjectId(),
    orderId:new mongoose.Types.ObjectId(),rating:0,comment:'Valid comment'
  });
  assert.ok(review.validateSync().errors.rating);
});

test('Review model rejects comments over 1000 characters',()=>{
  const review=new Review({
    userId:new mongoose.Types.ObjectId(),tourId:new mongoose.Types.ObjectId(),
    orderId:new mongoose.Types.ObjectId(),rating:5,comment:'x'.repeat(1001)
  });
  assert.ok(review.validateSync().errors.comment);
});

test('admin password hashes are excluded from queries by default',()=>{
  assert.equal(AccountAdmin.schema.path('password').options.select,false);
});

test('AccountAdmin model requires a password',()=>{
  const error=new AccountAdmin({fullName:'Admin'}).validateSync();
  assert.ok(error.errors.password);
});

test('admin reset requests require a hash and account ownership',()=>{
  const error=new ForgotPassword({email:'admin@example.com',expireAt:new Date()}).validateSync();
  assert.ok(error.errors.userId);
  assert.ok(error.errors.otpHash);
});

test('admin OTP hashes are excluded from queries by default',()=>{
  assert.equal(ForgotPassword.schema.path('otpHash').options.select,false);
});
