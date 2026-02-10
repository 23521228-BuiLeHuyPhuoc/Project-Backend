const express = require('express')
const app = express()
const port = 3000

app.get('/', (req, res) => {
  res.send('Trang chủ')
})

app.get('/tours', (req, res) => {
  res.send('Danh sách tour')
})

app.listen(port, () => {
  console.log(`Website đang chạy trên cổng ${port}`)
})
