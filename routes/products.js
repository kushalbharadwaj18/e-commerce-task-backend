const express = require("express")
const Product = require("../models/Product")

const router = express.Router()

// Get all products
router.get("/", async (req, res) => {
  try {
    const { category, search, minPrice, maxPrice } = req.query
    const query = {}

    if (category) query.category = category
    if (search) query.name = { $regex: search, $options: "i" }
    if (minPrice || maxPrice) {
      query.price = {}
      if (minPrice) query.price.$gte = Number.parseFloat(minPrice)
      if (maxPrice) query.price.$lte = Number.parseFloat(maxPrice)
    }

    const products = await Product.find(query)
    res.json(products)
  } catch (error) {
    res.status(500).json({ message: "Error fetching products", error: error.message })
  }
})

// Get single product
router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
    if (!product) {
      return res.status(404).json({ message: "Product not found" })
    }
    res.json(product)
  } catch (error) {
    res.status(500).json({ message: "Error fetching product", error: error.message })
  }
})

// Create product (admin only)
router.post("/", async (req, res) => {
  try {
    const product = new Product(req.body)
    await product.save()
    res.status(201).json(product)
  } catch (error) {
    res.status(500).json({ message: "Error creating product", error: error.message })
  }
})

router.put("/:id", async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true })
    res.json(product)
  } catch (error) {
    res.status(500).json({ message: "Error updating product", error: error.message })
  }
})

router.delete("/:id", async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id)
    res.json({ message: "Product deleted" })
  } catch (error) {
    res.status(500).json({ message: "Error deleting product", error: error.message })
  }
})

module.exports = router
