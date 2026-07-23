const test=require('node:test');
const assert=require('node:assert/strict');

global.pathAdmin='admin';

const jwt=require('jsonwebtoken');
const AccountAdmin=require('../models/account-admin.model');
const Notification=require('../models/notification.model');
const Permission=require('../models/permission.model');
const Role=require('../models/roles.model');
const User=require('../models/user.model');
const adminAuth=require('../middlewares/admin/auth.middlewares');
const permissionMiddleware=require('../middlewares/admin/permission.middleware');
const clientAuth=require('../middlewares/client/auth.middleware');
const {createRequest,createResponse,restoreAll,stub}=require('./test-utils');

const restores=[];
test.afterEach(()=>restoreAll(restores));

const selectable=data=>({
  select(){return this;},
  lean:async()=>data
});

test('client requireAuth passes authenticated requests',()=>{
  const req=createRequest({user:{id:'user'}});
  const res=createResponse();
  let called=false;
  clientAuth.requireAuth(req,res,()=>{called=true;});
  assert.equal(called,true);
});

test('client requireAuth redirects GET requests and preserves return path',()=>{
  const req=createRequest({method:'GET',originalUrl:'/account/orders?status=paid'});
  const res=createResponse();
  clientAuth.requireAuth(req,res,()=>{});
  assert.equal(res.redirectUrl,'/auth/login?returnTo=%2Faccount%2Forders%3Fstatus%3Dpaid');
});

test('client requireAuth returns JSON 401 for mutations',()=>{
  const req=createRequest({
    method:'POST',
    headers:{referer:'https://example.com/cart?step=2'}
  });
  const res=createResponse();
  clientAuth.requireAuth(req,res,()=>{});
  assert.equal(res.statusCode,401);
  assert.match(res.body.redirect,/returnTo=%2Fcart%3Fstep%3D2/);
});

test('client requireAuth falls back to home for an invalid referer',()=>{
  const req=createRequest({method:'DELETE',headers:{referer:'not a url'}});
  const res=createResponse();
  clientAuth.requireAuth(req,res,()=>{});
  assert.match(res.body.redirect,/returnTo=%2F$/);
});

test('optionalAuth initializes anonymous locals without a token',async()=>{
  const req=createRequest();
  const res=createResponse();
  let called=false;
  await clientAuth.optionalAuth(req,res,()=>{called=true;});
  assert.equal(called,true);
  assert.equal(res.locals.user,null);
  assert.equal(res.locals.cartCount,0);
});

test('optionalAuth loads an active user and unread notification count',async()=>{
  const user={id:'u1',cart:[{},{}]};
  stub(jwt,'verify',()=>({id:'u1',email:'u@example.com'}),restores);
  stub(User,'findOne',async()=>user,restores);
  stub(Notification,'countDocuments',async()=>3,restores);
  const req=createRequest({cookies:{tokenUser:'valid'}});
  const res=createResponse();
  let called=false;
  await clientAuth.optionalAuth(req,res,()=>{called=true;});
  assert.equal(called,true);
  assert.equal(req.user,user);
  assert.equal(res.locals.cartCount,2);
  assert.equal(res.locals.notificationUnreadCount,3);
});

test('optionalAuth clears invalid tokens and continues anonymously',async()=>{
  stub(jwt,'verify',()=>{throw new Error('bad token');},restores);
  const req=createRequest({cookies:{tokenUser:'invalid'}});
  const res=createResponse();
  let called=false;
  await clientAuth.optionalAuth(req,res,()=>{called=true;});
  assert.equal(called,true);
  assert.deepEqual(res.clearedCookies,['tokenUser']);
  assert.equal(req.user,undefined);
});

test('admin auth redirects when no session token exists',async()=>{
  const req=createRequest({cookies:{}});
  const res=createResponse();
  await adminAuth.verifyToken(req,res,()=>{});
  assert.equal(res.redirectUrl,'/admin/account/login');
});

test('admin auth rejects password-reset tokens as login sessions',async()=>{
  stub(jwt,'verify',()=>({purpose:'reset-admin-password'}),restores);
  const req=createRequest({cookies:{token:'reset-token'}});
  const res=createResponse();
  await adminAuth.verifyToken(req,res,()=>{});
  assert.deepEqual(res.clearedCookies,['token']);
  assert.equal(res.redirectUrl,'/admin/account/login');
});

test('admin auth loads role permissions for a valid session',async()=>{
  const account={id:'a1',role:'r1'};
  stub(jwt,'verify',()=>({id:'a1',email:'a@example.com',purpose:'admin-session'}),restores);
  stub(AccountAdmin,'findOne',async()=>account,restores);
  stub(Role,'findOne',async()=>({permissions:['order-view']}),restores);
  const req=createRequest({cookies:{token:'valid'}});
  const res=createResponse();
  let called=false;
  await adminAuth.verifyToken(req,res,()=>{called=true;});
  assert.equal(called,true);
  assert.deepEqual(req.permissions,['order-view']);
  assert.equal(res.locals.account,account);
});

test('admin auth loads header notifications only with permission',async()=>{
  const account={id:'a1',role:'r1'};
  stub(jwt,'verify',()=>({id:'a1',email:'a@example.com',purpose:'admin-session'}),restores);
  stub(AccountAdmin,'findOne',async()=>account,restores);
  stub(Role,'findOne',async()=>({permissions:['notification-view']}),restores);
  stub(Notification,'find',()=>({
    select(){return this;},populate(){return this;},sort(){return this;},limit(){return this;},
    lean:async()=>[{title:'New',createdAt:new Date()}]
  }),restores);
  stub(Notification,'countDocuments',async()=>4,restores);
  const req=createRequest({cookies:{token:'valid'}});
  const res=createResponse();
  await adminAuth.verifyToken(req,res,()=>{});
  assert.equal(res.locals.adminHeaderNotifications.length,1);
  assert.equal(res.locals.adminHeaderUnreadCount,4);
});

test('permission middleware allows routes without a configured permission',async()=>{
  stub(Permission,'find',()=>selectable([]),restores);
  const req=createRequest({originalUrl:'/admin/dashboard',method:'GET'});
  const res=createResponse();
  let called=false;
  await permissionMiddleware.authorizeByPath(req,res,()=>{called=true;});
  assert.equal(called,true);
});

test('permission middleware allows an exact active permission',async()=>{
  stub(Permission,'find',()=>selectable([
    {code:'order-edit',path:'/order/edit/:id',status:'active'}
  ]),restores);
  const req=createRequest({
    originalUrl:'/admin/order/edit/123',method:'PATCH',permissions:['order-edit']
  });
  const res=createResponse();
  let called=false;
  await permissionMiddleware.authorizeByPath(req,res,()=>{called=true;});
  assert.equal(called,true);
});

test('permission middleware denies JSON mutations without permission',async()=>{
  stub(Permission,'find',()=>selectable([
    {code:'order-edit',path:'/order/edit/:id',status:'active'}
  ]),restores);
  const req=createRequest({originalUrl:'/admin/order/edit/123',method:'PATCH',permissions:[]});
  const res=createResponse();
  await permissionMiddleware.authorizeByPath(req,res,()=>{});
  assert.equal(res.statusCode,403);
  assert.equal(res.body.code,'error');
});

test('permission middleware renders 403 for denied HTML GET requests',async()=>{
  stub(Permission,'find',()=>selectable([
    {code:'order-view',path:'/order/list',status:'active'}
  ]),restores);
  const req=createRequest({
    originalUrl:'/admin/order/list',method:'GET',permissions:[],accepts:()=> 'html'
  });
  const res=createResponse();
  await permissionMiddleware.authorizeByPath(req,res,()=>{});
  assert.equal(res.statusCode,403);
  assert.equal(res.rendered.view,'admin/pages/error-403');
});

test('a more specific inactive permission overrides a broad wildcard',async()=>{
  stub(Permission,'find',()=>selectable([
    {code:'all-orders',path:'/order/*',status:'active'},
    {code:'order-delete',path:'/order/delete/:id',status:'inactive'}
  ]),restores);
  const req=createRequest({
    originalUrl:'/admin/order/delete/1',method:'DELETE',permissions:['all-orders','order-delete']
  });
  const res=createResponse();
  await permissionMiddleware.authorizeByPath(req,res,()=>{});
  assert.equal(res.statusCode,403);
});

test('permission middleware forwards database errors',async()=>{
  const expected=new Error('database unavailable');
  stub(Permission,'find',()=>{throw expected;},restores);
  const req=createRequest({originalUrl:'/admin/order/list'});
  const res=createResponse();
  let received=null;
  await permissionMiddleware.authorizeByPath(req,res,error=>{received=error;});
  assert.equal(received,expected);
});
