require('dotenv').config();
const express = require('express')
const crypto=require('node:crypto');
const path=require('path');
const connect=require('./config/database');
const {
  getRecommendationScheduler
}=require('./services/recommendation/training-scheduler');

const clientRoutes=require('./routes/client/index.route');
const adminRoutes=require('./routes/admin/index.route');
const flash=require('express-flash');
const session=require('express-session');
const app = express()
const variableconfig=require('./config/variable');
const port = Number(process.env.PORT) || 3000
const cookieParser=require('cookie-parser');
const tfjsPackage=require('@tensorflow/tfjs/package.json');
const tfjsBrowserBundle=path.join(
  path.dirname(require.resolve('@tensorflow/tfjs')),
  'tf.min.js'
);
const recommendationScheduler=getRecommendationScheduler();
app.locals.recommendationScheduler=recommendationScheduler;
app.locals.recommendationCache=recommendationScheduler.getCacheManager();
app.locals.tfjsVersion=tfjsPackage.version;
const configuredSessionSecret=process.env.SESSION_SECRET || process.env.JWT_SECRET;
const sessionSecret=configuredSessionSecret
  || (process.env.VERCEL==='1' ? crypto.randomBytes(32).toString('hex') : '');
if(!sessionSecret){
  throw new Error('SESSION_SECRET or JWT_SECRET must be configured');
}
if(!configuredSessionSecret){
  console.warn(
    'SESSION_SECRET/JWT_SECRET is missing; serverless sessions will be ephemeral.'
  );
}
//sử dụng flash
app.use(cookieParser(process.env.COOKIE_SECRET || sessionSecret));
app.use(session({
  secret:sessionSecret,
  resave:false,
  saveUninitialized:false,
  cookie:{
    maxAge:60*60*1000,
    httpOnly:true,
    sameSite:'lax',
    secure:process.env.NODE_ENV==='production'
  }
}));
app.use(flash());

app.set('views', path.join(__dirname, "views"));

app.set('view engine','pug');

app.get(`/assets/vendor/tfjs/${tfjsPackage.version}/tf.min.js`,(_req,res)=>{
  res.set('Cache-Control','public, max-age=31536000, immutable');
  return res.sendFile(tfjsBrowserBundle);
});
app.use(express.static(path.join(__dirname,'public')));

app.locals.pathAdmin=variableconfig.pathAdmin;

global.pathAdmin=variableconfig.pathAdmin;
//Cho phép gửi data lên dạng json
app.use(express.json());

let initializationPromise=null;
const initializeApplication=()=>{
  if(!initializationPromise){
    initializationPromise=(async()=>{
      await connect.connect();
      if(process.env.VERCEL==='1'){
        const restored=await recommendationScheduler.restore();
        if(!restored){
          console.warn(
            'Recommendation artifact missing; training an in-memory model.'
          );
          await recommendationScheduler.getEngine().train();
        }
        return;
      }
      await recommendationScheduler.start();
    })().catch(error=>{
      initializationPromise=null;
      throw error;
    });
  }
  return initializationPromise;
};

app.use(async(_req,_res,next)=>{
  try{
    await initializeApplication();
    next();
  }catch(error){
    next(error);
  }
});

app.use('/',clientRoutes);
app.use(`/${variableconfig.pathAdmin}`, adminRoutes);

const start=async()=>{
  await initializeApplication();
  app.listen(port, () => {
    console.log(`Website đang chạy trên cổng ${port}`)
  });
};

if(require.main===module){
  start().catch(error=>{
    console.error("Không thể khởi động ứng dụng:",error);
    process.exitCode=1;
  });
}

module.exports=app;
module.exports.initializeApplication=initializeApplication;
