const mongoose = require("mongoose")
const Product = require("../models/Product")
const dummyProducts = require("../data/dummyProducts")
require("dotenv").config()

async function seedDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/amazon-clone")
    console.log("Connected to MongoDB")

    await Product.deleteMany({})
    console.log("Cleared existing products")

    await Product.insertMany(dummyProducts)
    console.log(`Successfully seeded ${dummyProducts.length} products to database`)

    process.exit(0)
  } catch (error) {
    console.error("Error seeding database:", error)
    process.exit(1)
  }
}

seedDatabase()
