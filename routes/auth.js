const express = require("express")
const jwt = require("jsonwebtoken")
const User = require("../models/User")

const router = express.Router()

// ===== NORMAL EMAIL-PASSWORD AUTH =====

// Signup
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body

    // Check if user exists
    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" })
    }
 
    // Create new user with email-password auth
    const user = new User({ name, email, password, authMethod: "email-password" })
    await user.save()

    // Generate token 
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || "your-secret-key", { expiresIn: "7d" })

    res.status(201).json({
      message: "User created successfully",
      user: { _id: user._id, name: user.name, email: user.email, authMethod: "email-password" },
      token,
    })
  } catch (error) {
    res.status(500).json({ message: "Error creating user", error: error.message })
  }
})

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body

    // Find user
    const user = await User.findOne({ email })
    if (!user) {
      return res.status(400).json({ message: "User not found" })
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password)
    if (!isPasswordValid) {
      return res.status(400).json({ message: "Invalid password" })
    }

    // Generate token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || "your-secret-key", { expiresIn: "7d" })

    res.json({
      message: "Login successful",
      user: { _id: user._id, name: user.name, email: user.email, authMethod: "email-password" },
      token,
    })
  } catch (error) {
    res.status(500).json({ message: "Error logging in", error: error.message })
  }
})

module.exports = router
