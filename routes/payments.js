const express = require("express")
const Payment = require("../models/Payment")
const authMiddleware = require("../middleware/auth")

const router = express.Router()

// Get user payments
router.get("/", authMiddleware, async (req, res) => {
  try {
    const payments = await Payment.find({ userId: req.userId })
    res.json(payments)
  } catch (error) {
    res.status(500).json({ message: "Error fetching payments", error: error.message })
  }
})

// Create payment
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { orderId, amount, method } = req.body
    const transactionId = `TXN-${Date.now()}`

    const payment = new Payment({
      userId: req.userId,
      orderId,
      transactionId,
      amount,
      method,
      status: "Completed",
    })

    await payment.save()
    res.status(201).json(payment)
  } catch (error) {
    res.status(500).json({ message: "Error creating payment", error: error.message })
  }
})

module.exports = router
