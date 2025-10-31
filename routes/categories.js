const express = require("express")
const Category = require("../models/Category")
const Product = require("../models/Product")
const router = express.Router()

// Get all categories
router.get("/", async (req, res) => {
  try {
    const categories = await Category.find()
    res.json(categories)
  } catch (error) {
    res.status(500).json({ message: "Error fetching categories", error: error.message })
  }
})

// getProducts

router.get("/:category", async (req, res) => {
   try {
      const { category } = req.params;
	  const obj = await Category.findOne({ path: category });
	  const products = await Product.find({ category: obj.name });
	  res.json(products);
   }
   catch(error) {
	  res.status(500).json({ message: "Error fetching products", error: error.message })
   }
});
// Create category
router.post("/", async (req, res) => {
  try {
    const { name, description, path, image } = req.body
    const category = new Category({ name, description, path, image })
    await category.save()
    res.status(201).json(category)
  } catch (error) {
    res.status(500).json({ message: "Error creating category", error: error.message })
  }
})

// Update category
router.put("/:id", async (req, res) => {
  try {
    const category = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true })
    res.json(category)
  } catch (error) {
    res.status(500).json({ message: "Error updating category", error: error.message })
  }
})

// Delete category
router.delete("/:id", async (req, res) => {
  try {
    await Category.findByIdAndDelete(req.params.id)
    res.json({ message: "Category deleted" })
  } catch (error) {
    res.status(500).json({ message: "Error deleting category", error: error.message })
  }
})

module.exports = router
