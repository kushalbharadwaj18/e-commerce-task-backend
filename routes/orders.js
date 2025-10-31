const express = require("express")
const Order = require("../models/Order")
const authMiddleware = require("../middleware/auth")

const router = express.Router()

// Get user orders
router.get("/", authMiddleware, async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.userId })
    res.json(orders)
  } catch (error) {
    res.status(500).json({ message: "Error fetching orders", error: error.message })
  }
})

// Create order
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { items, total, shippingAddress } = req.body
    const orderNumber = `AMZ-${Date.now()}`

    const order = new Order({
      userId: req.userId,
      orderNumber,
      items,
      total,
      shippingAddress,
    })

    await order.save()
    res.status(201).json(order)
  } catch (error) {
    res.status(500).json({ message: "Error creating order", error: error.message })
  }
})

module.exports = router
