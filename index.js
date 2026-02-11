const express = require('express')
const path=require('path');
const mongoose=require('mongoose');
mongoose.connect('mongodb+srv://admin:123@cluster0.o3r6tac.mongodb.net/tour-management')
.then(() => console.log("✅ CONNECTED MONGODB"))
.catch(err => console.log("❌ CONNECT ERROR:", err));

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

// mongodb+srv://admin:123@cluster0.o3r6tac.mongodb.net/?appName=tour-management