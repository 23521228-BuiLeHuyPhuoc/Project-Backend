const AccountAdmin=require('../../models/account-admin.model');
const Order=require('../../models/order.model');
module.exports.dashboard=async(req,res)=>{
    const total=await AccountAdmin.countDocuments({
        deleted:false
    });
    const totalOrder=await Order.countDocuments({
        deleted:false
    })
    let totalSum=0;
       const sumRecord=await Order.find({
            deleted: false,
            paymentStatus: "paid"
        })
        for(let i of sumRecord)
            {
                totalSum+=i.total;
            }
    res.render("admin/pages/dashboard",{
        pageTitle:"Dashboard",
        total:total,
        totalOrder:totalOrder,
        totalSum:totalSum
    })
}
module.exports.revenueChart=async(req,res)=>{
    const{currentMonth,currentYear,previousMonth,previousYear,arrayDay}=req.body;
    const ordersCurrentMonth=await Order.find({
        deleted:false,
        createdAt:{
            $gte:new Date(currentYear, currentMonth-1, 1),
            $lt:new Date(currentYear, currentMonth)
        }
    })
     const ordersPreviousMonth = await Order.find({
    deleted: false,
    createdAt: {
      $gte: new Date(previousYear, previousMonth - 1, 1),
      $lt: new Date(previousYear, previousMonth, 1)
    }
  })
    const dataMonthCurrent = [];
  const dataMonthPrevious = [];

  for (const day of arrayDay) {
    // Tính tổng doanh thu theo từng ngày của tháng này
    let totalCurrent = 0;
    for (const order of ordersCurrentMonth) {
      const orderDate = new Date(order.createdAt).getDate();
      if(day == orderDate) {
        totalCurrent += order.total;
      }
    }
    dataMonthCurrent.push(totalCurrent);

    // Tính tổng doanh thu theo từng ngày của tháng trước
    let totalPrevious = 0;
    for (const order of ordersPreviousMonth) {
      const orderDate = new Date(order.createdAt).getDate();
      if(day == orderDate) {
        totalPrevious += order.total;
      }
    }
    dataMonthPrevious.push(totalPrevious);
  }

    
    
    
    
   res.json({
    code: "success",
    dataMonthCurrent: dataMonthCurrent,
    dataMonthPrevious: dataMonthPrevious
  });

}