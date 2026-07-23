require('dotenv').config();
const express = require('express')
const path=require('path');
const connect=require('./config/database');

const clientRoutes=require('./routes/client/index.route');
const adminRoutes=require('./routes/admin/index.route');
const flash=require('express-flash');
const session=require('express-session');
const app = express()
const variableconfig=require('./config/variable');
const port = 3000
const cookieParser=require('cookie-parser');
const sessionSecret=process.env.SESSION_SECRET || process.env.JWT_SECRET;
if(!sessionSecret){
  throw new Error('SESSION_SECRET or JWT_SECRET must be configured');
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

app.use(express.static(path.join(__dirname,'public')));

app.locals.pathAdmin=variableconfig.pathAdmin;

global.pathAdmin=variableconfig.pathAdmin;
//Cho phép gửi data lên dạng json
app.use(express.json());


app.use('/',clientRoutes);
app.use(`/${variableconfig.pathAdmin}`, adminRoutes);

const start=async()=>{
  await connect.connect();
  app.listen(port, () => {
    console.log(`Website đang chạy trên cổng ${port}`)
  });
};

start().catch(error=>{
  console.error("Không thể khởi động ứng dụng:",error);
  process.exitCode=1;
});
