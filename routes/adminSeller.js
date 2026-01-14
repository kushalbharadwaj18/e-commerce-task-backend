const express = require("express");
const Seller = require("../models/Seller");
const Product = require("../models/Product");
const Order = require("../models/Order");
const { requireAdminAuth } = require("../middleware/adminAuth");
const { sendApprovalEmail, sendRejectionEmail } = require("../utils/emailService");

const router = express.Router();

/**
 * Get All Sellers with filters
 * GET /api/admin/sellers
 */
router.get("/", requireAdminAuth, async (req, res) => {
  try {
    const { status, search, page = 1, limit = 10 } = req.query;

    let filter = {};

    if (status) {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;

    const sellers = await Seller.find(filter)
      .select("-password -aadhaarNumber")
      .skip(skip)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    const total = await Seller.countDocuments(filter);

    res.json({
      sellers,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching sellers",
      error: error.message,
    });
  }
});

/**
 * Get Pending Seller Approvals
 * GET /api/admin/sellers/pending
 */
router.get("/pending-approvals", requireAdminAuth, async (req, res) => {
  try {
    const sellers = await Seller.find({ status: "pending" })
      .select("-password -aadhaarNumber")
      .sort({ createdAt: 1 });

    res.json({
      count: sellers.length,
      sellers,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching pending sellers",
      error: error.message,
    });
  }
});

/**
 * Get Seller Details
 * GET /api/admin/sellers/:id
 */
router.get("/:id", requireAdminAuth, async (req, res) => {
  try {
    const seller = await Seller.findById(req.params.id).select("-password");

    if (!seller) {
      return res.status(404).json({ message: "Seller not found" });
    }

    // Get seller's products count
    const productCount = await Product.countDocuments({
      sellerId: seller._id,
    });

    // Get seller's orders count
    const orderCount = await Order.countDocuments({
      sellerId: seller._id,
    });

    res.json({
      seller,
      stats: {
        productCount,
        orderCount,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching seller details",
      error: error.message,
    });
  }
});

/**
 * Approve Seller
 * POST /api/admin/sellers/:id/approve
 */
router.post("/:id/approve", requireAdminAuth, async (req, res) => {
  try {
    const seller = await Seller.findById(req.params.id);

    if (!seller) {
      return res.status(404).json({ message: "Seller not found" });
    }

    // Update seller status
    seller.status = "approved";
    seller.isApproved = true;
    seller.approvedAt = new Date();
    seller.rejectionReason = null;

    await seller.save();

    // Send approval email notification
    try {
      await sendApprovalEmail(seller.email, seller.name);
      console.log(`Approval email sent to ${seller.email}`);
    } catch (emailError) {
      console.error(`Failed to send approval email to ${seller.email}:`, emailError);
      // Don't fail the approval if email fails
    }

    res.json({
      message: "Seller approved successfully",
      seller: {
        _id: seller._id,
        name: seller.name,
        email: seller.email,
        status: seller.status,
        isApproved: seller.isApproved,
      },
    });
  } catch (error) {
    console.error("[SELLER-APPROVE] Error:", error);
    res.status(500).json({
      message: "Error approving seller",
      error: error.message,
    });
  }
});

/**
 * Reject Seller
 * POST /api/admin/sellers/:id/reject
 */
router.post("/:id/reject", requireAdminAuth, async (req, res) => {
  try {
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ message: "Rejection reason required" });
    }

    const seller = await Seller.findById(req.params.id);

    if (!seller) {
      return res.status(404).json({ message: "Seller not found" });
    }

    // Update seller status
    seller.status = "rejected";
    seller.isApproved = false;
    seller.rejectionReason = reason;

    await seller.save();

    // Send rejection email notification
    try {
      await sendRejectionEmail(seller.email, seller.name, reason);
      console.log(`Rejection email sent to ${seller.email}`);
    } catch (emailError) {
      console.error(`Failed to send rejection email to ${seller.email}:`, emailError);
      // Don't fail the rejection if email fails
    }

    res.json({
      message: "Seller rejected",
      seller: {
        _id: seller._id,
        name: seller.name,
        email: seller.email,
        status: seller.status,
        rejectionReason: seller.rejectionReason,
      },
    });
  } catch (error) {
    console.error("[SELLER-REJECT] Error:", error);
    res.status(500).json({
      message: "Error rejecting seller",
      error: error.message,
    });
  }
});

/**
 * Activate/Deactivate Seller
 * PUT /api/admin/sellers/:id/status
 */
router.put("/:id/status", requireAdminAuth, async (req, res) => {
  try {
    const { newStatus } = req.body;

    if (!["active", "inactive", "suspended"].includes(newStatus)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const seller = await Seller.findById(req.params.id);

    if (!seller) {
      return res.status(404).json({ message: "Seller not found" });
    }

    // Map to correct status field
    const statusMap = {
      active: "approved",
      inactive: "inactive",
      suspended: "suspended",
    };

    seller.status = statusMap[newStatus];
    seller.isApproved = newStatus === "active";

    await seller.save();

    res.json({
      message: `Seller ${newStatus} successfully`,
      seller: {
        _id: seller._id,
        name: seller.name,
        status: seller.status,
        isApproved: seller.isApproved,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Error updating seller status",
      error: error.message,
    });
  }
});

/**
 * Get Seller's Products
 * GET /api/admin/sellers/:id/products
 */
router.get("/:id/products", requireAdminAuth, async (req, res) => {
  try {
    const seller = await Seller.findById(req.params.id);

    if (!seller) {
      return res.status(404).json({ message: "Seller not found" });
    }

    const products = await Product.find({ sellerId: seller._id })
      .select("_id title price category stock status createdAt")
      .sort({ createdAt: -1 });

    res.json({
      seller: {
        _id: seller._id,
        name: seller.name,
      },
      products,
      productCount: products.length,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching seller products",
      error: error.message,
    });
  }
});

/**
 * Get Seller's Orders
 * GET /api/admin/sellers/:id/orders
 */
router.get("/:id/orders", requireAdminAuth, async (req, res) => {
  try {
    const seller = await Seller.findById(req.params.id);

    if (!seller) {
      return res.status(404).json({ message: "Seller not found" });
    }

    const orders = await Order.find({ sellerId: seller._id })
      .select("_id userId totalAmount status createdAt")
      .sort({ createdAt: -1 });

    res.json({
      seller: {
        _id: seller._id,
        name: seller.name,
      },
      orders,
      orderCount: orders.length,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching seller orders",
      error: error.message,
    });
  }
});

/**
 * Get Seller Analytics
 * GET /api/admin/sellers/:id/analytics
 */
router.get("/:id/analytics", requireAdminAuth, async (req, res) => {
  try {
    const seller = await Seller.findById(req.params.id);

    if (!seller) {
      return res.status(404).json({ message: "Seller not found" });
    }

    const productCount = await Product.countDocuments({
      sellerId: seller._id,
    });

    const orders = await Order.find({ sellerId: seller._id });
    const orderCount = orders.length;
    const totalRevenue = orders.reduce(
      (sum, order) => sum + order.totalAmount,
      0
    );

    res.json({
      seller: {
        _id: seller._id,
        name: seller.name,
        email: seller.email,
        status: seller.status,
      },
      analytics: {
        productCount,
        orderCount,
        totalRevenue,
        totalEarnings: seller.totalEarnings,
        rating: seller.rating,
        reviewCount: seller.reviewCount,
        joinedDate: seller.createdAt,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching seller analytics",
      error: error.message,
    });
  }
});

module.exports = router;
