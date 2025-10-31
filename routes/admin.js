const express = require("express")
const jwt = require("jsonwebtoken")
const adminAuth = require("../middleware/adminAuth")

const router = express.Router()

// Admin login
router.post("/login", adminAuth, (req, res) => {
  try {
    const token = jwt.sign({ isAdmin: true }, process.env.JWT_SECRET || "your-secret-key", { expiresIn: "7d" })
    res.json({
      message: "Admin login successful",
      token,
      admin: { email: process.env.ADMIN_EMAIL },
    })
  } catch (error) {
    res.status(500).json({ message: "Error logging in", error: error.message })
  }
})

module.exports = router
