const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const sellerSchema = new mongoose.Schema({
  // Personal Details
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  phone: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },

  // Aadhaar Details
  aadhaarNumber: {
    type: String,
    required: true,
    unique: true,
  },
  aadhaarDocument: {
    type: String, // File path or URL to stored document
    required: true,
  },

  // Bank Details
  bankDetails: {
    bankName: {
      type: String,
      required: true,
    },
    accountHolder: {
      type: String,
      required: true,
    },
    accountNumber: {
      type: String,
      required: true,
    },
    ifscCode: {
      type: String,
      required: true,
    },
  },

  // Status & Approval
  status: {
    type: String,
    enum: ["pending", "approved", "rejected", "inactive", "suspended"],
    default: "pending",
  },
  isApproved: {
    type: Boolean,
    default: false,
  },
  rejectionReason: String,
  approvedAt: Date,

  // Analytics
  totalEarnings: {
    type: Number,
    default: 0,
  },
  totalOrders: {
    type: Number,
    default: 0,
  },
  totalProducts: {
    type: Number,
    default: 0,
  },
  rating: {
    type: Number,
    default: 0,
  },
  reviewCount: {
    type: Number,
    default: 0,
  },

  // Withdrawals
  withdrawals: [
    {
      amount: Number,
      requestDate: {
        type: Date,
        default: Date.now,
      },
      status: {
        type: String,
        enum: ["pending", "approved", "rejected", "completed"],
        default: "pending",
      },
      bankDetails: {
        bankName: String,
        accountHolder: String,
        accountNumber: String,
        ifscCode: String,
      },
      completedDate: Date,
      notes: String,
    },
  ],

  // Metadata
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Hash password before saving
sellerSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
sellerSchema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

// Update updatedAt on save
sellerSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("Seller", sellerSchema);
