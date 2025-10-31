const express = require("express");
const Order = require("../models/Order.js");
const Product = require("../models/Product.js");
const authMiddleware = require("../middleware/auth.js");

const router = express.Router();

/**
 * @route   POST /api/checkout
 * @desc    Validate cart, verify prices, create order, process payment
 * @access  Private
 */
router.post("/", authMiddleware, async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      address,
      city,
      state,
      zipCode,
      cardNumber,
      expiryDate,
      cvv,
      items,
      sum,
    } = req.body;

    // const userId = req.user.id;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    // ✅ Fetch products from DB to validate
    const productIds = items.map((item) => item._id);
    const dbProducts = await Product.find({ _id: { $in: productIds } });

    if (dbProducts.length !== items.length) {
      return res.status(400).json({ message: "Some products no longer exist." });
    }

    // ✅ Validate each product (price, stock)
    let total = 0;
    const verifiedItems = [];

    for (const item of items) {
      const product = dbProducts.find((p) => p._id.toString() === item._id);

      if (!product) {
        return res.status(400).json({ message: `Product not found: ${item._id}` });
      }

      if (item.quantity <= 0 || item.quantity > product.stock) {
        return res.status(400).json({ message: `Invalid quantity for ${product.name}` });
      }

      if (item.price !== product.price) {
        return res.status(400).json({
          message: `Price mismatch detected for ${product.name}. Please refresh your cart.`,
        });
      }

    //   const subtotal = product.price * item.quantity;
    //   total += subtotal;

    //   verifiedItems.push({
    //     product: product._id,
    //     name: product.name,
    //     price: product.price,
    //     quantity: item.quantity,
    //     subtotal,
    //   });
    }

    // ✅ Compute verified totals
    // const tax = total * 0.1;
    // const finalAmount = parseFloat((total + tax).toFixed(2));

    // // ✅ Check if client-side total (sum) matches server total
    // if (Math.abs(finalAmount - sum) > 1) {
    //   return res.status(400).json({
    //     message: "Order total mismatch. Possible tampering detected.",
    //     serverTotal: finalAmount,
    //     clientTotal: sum,
    //   });
    // }

    // // ✅ Simulate payment gateway verification
    // const paymentStatus = "Success";
    // const paymentId = `PMT-${Date.now()}`;

    // // ✅ Create and save order
    // const order = new Order({
    //   user: userId,
    //   items: verifiedItems,
    //   shippingInfo: {
    //     firstName,
    //     lastName,
    //     email,
    //     address,
    //     city,
    //     state,
    //     zipCode,
    //   },
    //   totalAmount: finalAmount,
    //   taxAmount: tax,
    //   paymentStatus,
    //   paymentId,
    //   cardLast4: cardNumber?.slice(-4),
    // });

    // await order.save();

    // // ✅ Deduct stock atomically
    // const bulkOps = verifiedItems.map((item) => ({
    //   updateOne: {
    //     filter: { _id: item.product },
    //     update: { $inc: { stock: -item.quantity } },
    //   },
    // }));
    // await Product.bulkWrite(bulkOps);

    // return res.status(200).json({
    //   message: "Order placed successfully",
    //   orderId: order._id,
    //   verifiedTotal: finalAmount,
    //   paymentStatus,
    // });
	return res.status(200).json({ message: "Checkout endpoint reached successfully." });
  } catch (error) {
    console.error("Checkout error:", error);
    res.status(500).json({ message: "Server error during checkout" });
  }
});

module.exports = router;
