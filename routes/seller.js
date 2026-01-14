const express = require("express");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const Seller = require("../models/Seller");
const Product = require("../models/Product");
const Order = require("../models/Order");
const { requireApprovedSeller } = require("../middleware/sellerAuth");
const { generateOTPWithExpiry, validateOTP, sendOTPToEmail } = require("../utils/otpService");

const router = express.Router();

// Multer configuration for image upload
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  },
});

/**
 * Seller Signup
 * POST /api/seller/signup
 */
router.post("/signup", async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      password,
      aadhaarNumber,
      aadhaarDocument,
      bankName,
      accountHolder,
      accountNumber,
      ifscCode,
    } = req.body;

    // Validation
    if (
      !name ||
      !email ||
      !phone ||
      !password ||
      !aadhaarNumber ||
      !aadhaarDocument ||
      !bankName ||
      !accountHolder ||
      !accountNumber ||
      !ifscCode
    ) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Check if email already exists
    const existingEmail = await Seller.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // Check if Aadhaar already exists
    const existingAadhaar = await Seller.findOne({ aadhaarNumber });
    if (existingAadhaar) {
      return res.status(400).json({ message: "Aadhaar number already registered" });
    }

    // Create new seller
    const seller = new Seller({
      name,
      email,
      phone,
      password,
      aadhaarNumber,
      aadhaarDocument,
      bankDetails: {
        bankName,
        accountHolder,
        accountNumber,
        ifscCode,
      },
      isEmailVerified: false, // Email not verified yet
    });

    await seller.save();

    // Generate and send OTP
    try {
      const otpData = generateOTPWithExpiry(10); // OTP valid for 10 minutes
      seller.emailVerificationOTP = otpData;
      await seller.save();

      // Send OTP email
      await sendOTPToEmail(seller.email, otpData.code, seller.name);

      console.log(`[SELLER-SIGNUP] OTP sent to ${email}`);
    } catch (otpError) {
      console.error("[SELLER-SIGNUP] Failed to send OTP:", otpError.message);
      // Continue without OTP sent, user can request resend
    }

    // Generate token (for email verification step)
    const token = jwt.sign(
      { sellerId: seller._id },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "Seller registered successfully. Please verify your email with the OTP sent to your email address.",
      seller: {
        _id: seller._id,
        name: seller.name,
        email: seller.email,
        status: seller.status,
        isEmailVerified: seller.isEmailVerified,
      },
      token,
    });
  } catch (error) {
    console.error("[SELLER-SIGNUP] Error:", error);
    res.status(500).json({
      message: "Error registering seller",
      error: error.message,
    });
  }
});

/**
 * Send or Resend OTP
 * POST /api/seller/send-otp
 */
router.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const seller = await Seller.findOne({ email });
    if (!seller) {
      return res.status(404).json({ message: "Seller not found" });
    }

    if (seller.isEmailVerified) {
      return res.status(400).json({ message: "Email is already verified" });
    }

    // Generate OTP
    const otpData = generateOTPWithExpiry(10);
    seller.emailVerificationOTP = otpData;
    await seller.save();

    // Send OTP email
    await sendOTPToEmail(seller.email, otpData.code, seller.name);

    console.log(`[SEND-OTP] OTP resent to ${email}`);

    res.json({
      message: "OTP sent successfully to your email",
      email: seller.email,
    });
  } catch (error) {
    console.error("[SEND-OTP] Error:", error);
    res.status(500).json({
      message: "Error sending OTP",
      error: error.message,
    });
  }
});

/**
 * Verify Email with OTP
 * POST /api/seller/verify-email
 */
router.post("/verify-email", async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const seller = await Seller.findOne({ email });
    if (!seller) {
      return res.status(404).json({ message: "Seller not found" });
    }

    if (seller.isEmailVerified) {
      return res.status(400).json({ message: "Email is already verified" });
    }

    // Validate OTP
    const otpValidation = validateOTP(seller.emailVerificationOTP, otp);
    if (!otpValidation.valid) {
      // Increment attempts
      if (!seller.emailVerificationOTP.attempts) {
        seller.emailVerificationOTP.attempts = 0;
      }
      seller.emailVerificationOTP.attempts += 1;

      // Lock after 5 failed attempts
      if (seller.emailVerificationOTP.attempts >= 5) {
        console.log(`[VERIFY-EMAIL] Too many attempts for ${email}`);
        await seller.save();
        return res.status(429).json({
          message: "Too many failed attempts. Please request a new OTP.",
        });
      }

      await seller.save();
      return res.status(400).json({
        message: otpValidation.message,
        attempts: seller.emailVerificationOTP.attempts,
      });
    }

    // OTP is valid, mark email as verified
    seller.isEmailVerified = true;
    seller.emailVerificationOTP = {
      code: null,
      expiresAt: null,
      attempts: 0,
    };
    await seller.save();

    console.log(`[VERIFY-EMAIL] Email verified for seller: ${seller._id}`);

    res.json({
      message: "Email verified successfully! Please wait for admin approval.",
      seller: {
        _id: seller._id,
        name: seller.name,
        email: seller.email,
        isEmailVerified: seller.isEmailVerified,
        status: seller.status,
      },
    });
  } catch (error) {
    console.error("[VERIFY-EMAIL] Error:", error);
    res.status(500).json({
      message: "Error verifying email",
      error: error.message,
    });
  }
});

/**
 * Seller Login
 * POST /api/seller/login
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    // Find seller by email
    const seller = await Seller.findOne({ email });
    if (!seller) {
      return res.status(400).json({ message: "Seller not found" });
    }

    // Check password
    const isPasswordValid = await seller.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: "Invalid password" });
    }

    // Generate token
    const token = jwt.sign(
      { sellerId: seller._id },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful",
      seller: {
        _id: seller._id,
        name: seller.name,
        email: seller.email,
        status: seller.status,
        isApproved: seller.isApproved,
      },
      token,
    });
  } catch (error) {
    console.error("[SELLER-LOGIN] Error:", error);
    res.status(500).json({
      message: "Error logging in",
      error: error.message,
    });
  }
});

/**
 * Get Seller Profile
 * GET /api/seller/profile
 */
router.get("/profile", requireApprovedSeller, async (req, res) => {
  try {
    res.json({
      seller: {
        _id: req.seller._id,
        name: req.seller.name,
        email: req.seller.email,
        phone: req.seller.phone,
        status: req.seller.status,
        isApproved: req.seller.isApproved,
        bankDetails: req.seller.bankDetails,
        totalEarnings: req.seller.totalEarnings,
        totalOrders: req.seller.totalOrders,
        totalProducts: req.seller.totalProducts,
        rating: req.seller.rating,
        createdAt: req.seller.createdAt,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching profile",
      error: error.message,
    });
  }
});

/**
 * Change Seller Password
 * POST /api/seller/change-password
 */
router.post("/change-password", requireApprovedSeller, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    // Validate input
    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        message: "Old password and new password are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message: "New password must be at least 6 characters",
      });
    }

    // Check old password
    const isPasswordValid = await req.seller.comparePassword(oldPassword);
    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Current password is incorrect",
      });
    }

    // Update password
    req.seller.password = newPassword;
    await req.seller.save();

    res.json({
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("[CHANGE-PASSWORD] Error:", error);
    res.status(500).json({
      message: "Error changing password",
      error: error.message,
    });
  }
});

/**
 * Update Seller Profile
 * PUT /api/seller/profile
 */
router.put("/profile", requireApprovedSeller, async (req, res) => {
  try {
    const { name, phone, bankName, accountHolder, accountNumber, ifscCode } =
      req.body;

    // Update allowed fields
    if (name) req.seller.name = name;
    if (phone) req.seller.phone = phone;

    if (bankName || accountHolder || accountNumber || ifscCode) {
      req.seller.bankDetails = {
        bankName: bankName || req.seller.bankDetails.bankName,
        accountHolder: accountHolder || req.seller.bankDetails.accountHolder,
        accountNumber: accountNumber || req.seller.bankDetails.accountNumber,
        ifscCode: ifscCode || req.seller.bankDetails.ifscCode,
      };
    }

    await req.seller.save();

    res.json({
      message: "Profile updated successfully",
      seller: {
        _id: req.seller._id,
        name: req.seller.name,
        email: req.seller.email,
        phone: req.seller.phone,
        bankDetails: req.seller.bankDetails,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Error updating profile",
      error: error.message,
    });
  }
});

/**
 * Get Seller Status (for non-approved sellers to check approval status)
 * GET /api/seller/status
 */
router.get("/status", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "your-secret-key"
    );
    const seller = await Seller.findById(decoded.sellerId);

    if (!seller) {
      return res.status(404).json({ message: "Seller not found" });
    }

    console.log("[SELLER-STATUS] Returning status for seller:", {
      _id: seller._id,
      status: seller.status,
      isApproved: seller.isApproved,
      createdAt: seller.createdAt,
    });

    res.json({
      status: seller.status,
      isApproved: seller.isApproved,
      rejectionReason: seller.rejectionReason || null,
      createdAt: seller.createdAt,
    });
  } catch (error) {
    console.error("[SELLER-STATUS] Error:", error.message);
    res.status(401).json({ message: "Invalid token" });
  }
});

/**
 * Get Seller's Products
 * GET /api/seller/products
 */
router.get("/products/list", requireApprovedSeller, async (req, res) => {
  try {
    const products = await Product.find({ sellerId: req.seller._id }).sort({
      createdAt: -1,
    });

    res.json({
      message: "Products fetched successfully",
      products,
      count: products.length,
    });
  } catch (error) {
    console.error("[SELLER-PRODUCTS] Error:", error);
    res.status(500).json({
      message: "Error fetching products",
      error: error.message,
    });
  }
});

/**
 * Create Seller Product
 * POST /api/seller/products
 */
router.post("/products", requireApprovedSeller, upload.single("image"), async (req, res) => {
  try {
    const { name, description, price, category, stock, instaVideo } = req.body;
    let imageUrl = "";

    if (!name || !price || !category) {
      return res.status(400).json({
        message: "Name, price, and category are required",
      });
    }

    // Handle file upload if present
    if (req.file) {
      // Convert file to base64
      const fileBuffer = req.file.buffer;
      const base64String = fileBuffer.toString("base64");
      const mimeType = req.file.mimetype;
      imageUrl = `data:${mimeType};base64,${base64String}`;
    } else if (req.body.image) {
      // Fallback to URL if provided in body
      imageUrl = req.body.image;
    }

    const product = new Product({
      name,
      description,
      price,
      category,
      stock: stock || 100,
      image: imageUrl,
      instaVideo,
      sellerId: req.seller._id,
      status: "active",
    });

    await product.save();

    // Update seller's total products count
    req.seller.totalProducts = (req.seller.totalProducts || 0) + 1;
    await req.seller.save();

    res.status(201).json({
      message: "Product created successfully",
      product,
    });
  } catch (error) {
    console.error("[SELLER-CREATE-PRODUCT] Error:", error);
    res.status(500).json({
      message: "Error creating product",
      error: error.message,
    });
  }
});

/**
 * Update Seller Product
 * PUT /api/seller/products/:productId
 */
router.put("/products/:productId", requireApprovedSeller, async (req, res) => {
  try {
    const product = await Product.findById(req.params.productId);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Verify seller owns this product
    if (product.sellerId.toString() !== req.seller._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Update allowed fields
    const { name, description, price, stock, status, image, instaVideo } =
      req.body;

    if (name) product.name = name;
    if (description) product.description = description;
    if (price) product.price = price;
    if (stock !== undefined) product.stock = stock;
    if (status) product.status = status;
    if (image) product.image = image;
    if (instaVideo) product.instaVideo = instaVideo;

    await product.save();

    res.json({
      message: "Product updated successfully",
      product,
    });
  } catch (error) {
    console.error("[SELLER-UPDATE-PRODUCT] Error:", error);
    res.status(500).json({
      message: "Error updating product",
      error: error.message,
    });
  }
});

/**
 * Delete Seller Product
 * DELETE /api/seller/products/:productId
 */
router.delete("/products/:productId", requireApprovedSeller, async (req, res) => {
  try {
    const product = await Product.findById(req.params.productId);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Verify seller owns this product
    if (product.sellerId.toString() !== req.seller._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    await Product.findByIdAndDelete(req.params.productId);

    // Update seller's total products count
    req.seller.totalProducts = Math.max(0, (req.seller.totalProducts || 1) - 1);
    await req.seller.save();

    res.json({
      message: "Product deleted successfully",
    });
  } catch (error) {
    console.error("[SELLER-DELETE-PRODUCT] Error:", error);
    res.status(500).json({
      message: "Error deleting product",
      error: error.message,
    });
  }
});

/**
 * Get Seller's Orders
 * GET /api/seller/orders
 */
router.get("/orders/list", requireApprovedSeller, async (req, res) => {
  try {
    // Get all products by this seller
    const sellerProducts = await Product.find({ sellerId: req.seller._id }).select(
      "_id"
    );
    const productIds = sellerProducts.map((p) => p._id);

    // Find orders containing any of these products
    const orders = await Order.find({
      "items.productId": { $in: productIds },
    })
      .populate("userId", "name email phone")
      .sort({ createdAt: -1 });

    // Filter items to only show seller's products
    const sellerOrders = orders.map((order) => ({
      ...order.toObject(),
      items: order.items.filter((item) =>
        productIds.some((id) => id.equals(item.productId))
      ),
    }));

    res.json({
      message: "Orders fetched successfully",
      orders: sellerOrders,
      count: sellerOrders.length,
    });
  } catch (error) {
    console.error("[SELLER-ORDERS] Error:", error);
    res.status(500).json({
      message: "Error fetching orders",
      error: error.message,
    });
  }
});

/**
 * Update Order Status (seller can only update their own orders)
 * PUT /api/seller/orders/:orderId
 */
router.put("/orders/:orderId", requireApprovedSeller, async (req, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }

    const order = await Order.findById(req.params.orderId);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Get seller's products
    const sellerProducts = await Product.find({ sellerId: req.seller._id }).select(
      "_id"
    );
    const productIds = sellerProducts.map((p) => p._id.toString());

    // Verify seller has products in this order
    const hasSellerProducts = order.items.some((item) =>
      productIds.includes(item.productId.toString())
    );

    if (!hasSellerProducts) {
      return res.status(403).json({
        message: "Not authorized to update this order",
      });
    }

    order.status = status;
    await order.save();

    res.json({
      message: "Order status updated successfully",
      order,
    });
  } catch (error) {
    console.error("[SELLER-UPDATE-ORDER] Error:", error);
    res.status(500).json({
      message: "Error updating order",
      error: error.message,
    });
  }
});

/**
 * Get Withdrawal History
 * GET /api/seller/withdrawals
 */
router.get("/withdrawals/history", requireApprovedSeller, async (req, res) => {
  try {
    // Get seller's withdrawal history (from seller document)
    const withdrawals = req.seller.withdrawals || [];

    res.json({
      message: "Withdrawal history fetched successfully",
      withdrawals,
      totalWithdrawn: withdrawals.reduce((sum, w) => sum + w.amount, 0),
      pendingBalance: req.seller.totalEarnings - (withdrawals.reduce((sum, w) => sum + w.amount, 0) || 0),
    });
  } catch (error) {
    console.error("[SELLER-WITHDRAWALS] Error:", error);
    res.status(500).json({
      message: "Error fetching withdrawals",
      error: error.message,
    });
  }
});

/**
 * Request Withdrawal
 * POST /api/seller/withdrawals
 */
router.post("/withdrawals", requireApprovedSeller, async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Valid amount is required" });
    }

    // Calculate available balance
    const totalWithdrawn = (req.seller.withdrawals || []).reduce(
      (sum, w) => sum + w.amount,
      0
    );
    const availableBalance = req.seller.totalEarnings - totalWithdrawn;

    if (amount > availableBalance) {
      return res.status(400).json({
        message: "Insufficient balance",
        availableBalance,
      });
    }

    // Create withdrawal request
    const withdrawal = {
      amount,
      requestDate: new Date(),
      status: "pending", // pending, approved, rejected, completed
      bankDetails: {
        bankName: req.seller.bankDetails.bankName,
        accountHolder: req.seller.bankDetails.accountHolder,
        accountNumber: req.seller.bankDetails.accountNumber,
        ifscCode: req.seller.bankDetails.ifscCode,
      },
    };

    if (!req.seller.withdrawals) {
      req.seller.withdrawals = [];
    }

    req.seller.withdrawals.push(withdrawal);
    await req.seller.save();

    res.status(201).json({
      message: "Withdrawal request created successfully",
      withdrawal,
      remainingBalance: availableBalance - amount,
    });
  } catch (error) {
    console.error("[SELLER-CREATE-WITHDRAWAL] Error:", error);
    res.status(500).json({
      message: "Error creating withdrawal request",
      error: error.message,
    });
  }
});

module.exports = router;
