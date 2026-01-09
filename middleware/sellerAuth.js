const jwt = require("jsonwebtoken");
const Seller = require("../models/Seller");

/**
 * Verify seller JWT token and check if seller is approved
 */
const requireApprovedSeller = async (req, res, next) => {
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

    if (!seller.isApproved || seller.status !== "approved") {
      return res.status(403).json({
        message: "Seller account not approved. Please wait for admin approval.",
        status: seller.status,
      });
    }

    req.seller = seller;
    req.sellerId = seller._id;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token", error: error.message });
  }
};

/**
 * Verify seller owns a specific product
 */
const requireProductOwnership = async (req, res, next) => {
  try {
    const Product = require("../models/Product");
    const productId = req.params.id;

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (product.sellerId.toString() !== req.sellerId.toString()) {
      return res.status(403).json({
        message: "You do not have permission to modify this product",
      });
    }

    req.product = product;
    next();
  } catch (error) {
    return res.status(500).json({
      message: "Error verifying product ownership",
      error: error.message,
    });
  }
};

/**
 * Verify seller owns a specific order
 */
const requireOrderOwnership = async (req, res, next) => {
  try {
    const Order = require("../models/Order");
    const orderId = req.params.id;

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.sellerId.toString() !== req.sellerId.toString()) {
      return res.status(403).json({
        message: "You do not have permission to view this order",
      });
    }

    req.order = order;
    next();
  } catch (error) {
    return res.status(500).json({
      message: "Error verifying order ownership",
      error: error.message,
    });
  }
};

module.exports = {
  requireApprovedSeller,
  requireProductOwnership,
  requireOrderOwnership,
};
