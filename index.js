require('dotenv').config();
const express = require('express')
const path=require('path');
const mongoose=require('mongoose');

mongoose.connect(process.env.DATABASE)

const clientRoutes=require('./routes/client/index.route');

const app = express()

const port = 3000

app.set('views', path.join(__dirname, "views"));

app.set('view engine','pug');

app.use('/',clientRoutes);


app.use(express.static(path.join(__dirname,'public')));


app.listen(port, () => {
  console.log(`Website đang chạy trên cổng ${port}`)
})
