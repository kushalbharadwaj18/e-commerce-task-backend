const express = require("express")
const Cart = require("../models/Cart")
const Product = require("../models/Product")

const router = express.Router()

// Get user cart
router.get("/:userId", async (req, res) => {
  try {
    let cart = await Cart.findOne({ userId: req.params.userId }).populate("items.productId")
    if (!cart) {
      cart = new Cart({ userId: req.params.userId, items: [] })
      await cart.save()
    }
    res.json(cart)
  } catch (error) {
    res.status(500).json({ message: "Error fetching cart", error: error.message })
  }
})

// Add to cart
router.post("/:userId/add", async (req, res) => {
  try {
    const { productId, quantity } = req.body
    const product = await Product.findById(productId)

    let cart = await Cart.findOne({ userId: req.params.userId })
    if (!cart) {
      cart = new Cart({ userId: req.params.userId, items: [] })
    }

    const existingItem = cart.items.find((item) => item.productId.toString() === productId)
    if (existingItem) {
      existingItem.quantity += quantity
    } else {
      cart.items.push({ productId, quantity, price: product.price })
    }

    cart.totalPrice = cart.items.reduce((total, item) => total + item.price * item.quantity, 0)
    await cart.save()
    res.json(cart)
  } catch (error) {
    res.status(500).json({ message: "Error adding to cart", error: error.message })
  }
})

// Remove from cart
router.post("/:userId/remove", async (req, res) => {
  try {
    const { productId } = req.body
    const cart = await Cart.findOne({ userId: req.params.userId })

    cart.items = cart.items.filter((item) => item.productId.toString() !== productId)
    cart.totalPrice = cart.items.reduce((total, item) => total + item.price * item.quantity, 0)
    await cart.save()
    res.json(cart)
  } catch (error) {
    res.status(500).json({ message: "Error removing from cart", error: error.message })
  }
})

// Update cart item quantity
router.post("/:userId/update", async (req, res) => {
  try {
    const { productId, quantity } = req.body
    const cart = await Cart.findOne({ userId: req.params.userId })

    const item = cart.items.find((item) => item.productId.toString() === productId)
    if (item) {
      item.quantity = quantity
    }

    cart.totalPrice = cart.items.reduce((total, item) => total + item.price * item.quantity, 0)
    await cart.save()
    res.json(cart)
  } catch (error) {
    res.status(500).json({ message: "Error updating cart", error: error.message })
  }
})

// Clear cart
router.post("/:userId/clear", async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.params.userId })
    cart.items = []
    cart.totalPrice = 0
    await cart.save()
    res.json(cart)
  } catch (error) {
    res.status(500).json({ message: "Error clearing cart", error: error.message })
  }
})

module.exports = router
