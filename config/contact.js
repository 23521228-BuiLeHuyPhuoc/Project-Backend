const topics=[
  {value:"tour-consulting",label:"Tư vấn chọn tour"},
  {value:"booking-support",label:"Hỗ trợ đặt tour"},
  {value:"payment-support",label:"Thanh toán và hóa đơn"},
  {value:"partnership",label:"Hợp tác"},
  {value:"other",label:"Nội dung khác"}
];

const topicLabels=Object.fromEntries(topics.map(item=>[item.value,item.label]));

module.exports={topics,topicLabels};
