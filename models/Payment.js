const mongoose = require("mongoose")

const paymentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order",
    required: true,
  },
  transactionId: String,
  amount: Number,
  method: {
    type: String,
    enum: ["Credit Card", "Debit Card", "PayPal", "Other"],
  },
  status: {
    type: String,
    enum: ["Completed", "Pending", "Failed"],
    default: "Pending",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
})

module.exports = mongoose.model("Payment", paymentSchema)
