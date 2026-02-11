const express = require('express')
const path=require('path');
const mongoose=require('mongoose');

// Nối cơ sở dữ liệu MongoDB (dùng direct connection thay SRV)
mongoose.connect('mongodb://admin:123@ac-r3mct8m-shard-00-00.o3r6tac.mongodb.net:27017,ac-r3mct8m-shard-00-01.o3r6tac.mongodb.net:27017,ac-r3mct8m-shard-00-02.o3r6tac.mongodb.net:27017/tour-management?ssl=true&replicaSet=atlas-7hog99-shard-0&authSource=admin&retryWrites=true&w=majority');
const app = express()

const port = 3000

const Tour=mongoose.model('Tour',{
  name: String,
  vehicle : String
});

app.get('/', (req, res) => {
  res.render('client/pages/home',{
    pageTitle:"Trang chủ"
  })
})
app.get('/tours', async(req,res)=>{
  const tourList=await Tour.find({});
  console.log(tourList);
  res.render("client/pages/tour-list",{
    pageTitle:"Danh sách tour",
    tourList: tourList
  })
})

app.set('views', path.join(__dirname, "views"));

app.set('view engine','pug');


app.use(express.static(path.join(__dirname,'public')));


app.listen(port, () => {
  console.log(`Website đang chạy trên cổng ${port}`)
})
