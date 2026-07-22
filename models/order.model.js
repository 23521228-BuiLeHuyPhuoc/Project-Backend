const mongoose = require("mongoose");

const schema = new mongoose.Schema(
  {
    userId:{
      type:mongoose.Schema.Types.ObjectId,
      ref:"User",
      index:true,
      default:null
    },
    orderCode:{
        type:String,
        unique:true
    },
    fullName: String,
    phone: String,
    note: String,
    items: Array,
    subTotal: Number,
    discount: {
      type: Number,
      default: 0 
    },
    voucherCode:{
      type:String,
      default:""
    },
    total: Number,
    paymentMethod: String,
    paymentStatus: String,
    status: String,
    cancelledAt:Date,
    isMock:{
      type:Boolean,
      default:false
    },
    updatedBy: String,
    deleted: {
      type: Boolean,
      default: false
    },
    deletedBy: String,
    deletedAt: Date
  },
  {
    timestamps: true, // Tự động sinh ra trường createdAt và updatedAt
  }
);

const Order = mongoose.model('Order', schema, "orders");

module.exports = Order;
