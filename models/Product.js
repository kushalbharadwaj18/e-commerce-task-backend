const mongoose = require("mongoose")

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: String,
  price: {
    type: Number,
    required: true,
  },
  category: {
    type: String,
    required: true,
  },
  image: String,
  stock: {
    type: Number,
    default: 100,
  },
  rating: {
    type: Number,
    default: 0,
  },
  reviews: {
    type: Number,
    default: 0,
  },
  instaVideo: {
     type: String,
     default: "",
  },
  // Seller information
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Seller",
    default: null, // null for admin products, set for seller products
  },
  status: {
    type: String,
    enum: ["active", "inactive", "out_of_stock"],
    default: "active",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
})

module.exports = mongoose.model("Product", productSchema)
