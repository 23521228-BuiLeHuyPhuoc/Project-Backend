require('dotenv').config();
const express = require('express')
const path=require('path');
const mongoose=require('mongoose');

mongoose.connect(process.env.DATABASE)
const app = express()

const port = 3000
const tourController=require('./controllers/client/tour.controller');
const homeController=require('./controllers/client/home.controller');
app.set('views', path.join(__dirname, "views"));

app.set('view engine','pug');


app.get('/', homeController.home );
app.get('/tours', tourController.list );

app.use(express.static(path.join(__dirname,'public')));


app.listen(port, () => {
  console.log(`Website đang chạy trên cổng ${port}`)
})
