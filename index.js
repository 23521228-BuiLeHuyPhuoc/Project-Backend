require('dotenv').config();
const express = require('express')
const path=require('path');
const connect=require('./config/database');

const clientRoutes=require('./routes/client/index.route');
const adminRoutes=require('./routes/admin/index.route');
const app = express()

const port = 3000
connect.connect();

app.set('views', path.join(__dirname, "views"));

app.set('view engine','pug');

app.use(express.static(path.join(__dirname,'public')));

app.use('/',clientRoutes);
app.use('/admin', adminRoutes);

app.listen(port, () => {
  console.log(`Website đang chạy trên cổng ${port}`)
})
