const jwt = require("jsonwebtoken");

const adminAuth = (req, res, next) => {
  const { email, password } = req.body

  if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
    next()
  } else {
    res.status(401).json({ message: "Invalid admin credentials" })
  }
}

// JWT-based admin authentication middleware for protected routes
const requireAdminAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key");
    if (!decoded.isAdmin) {
      return res.status(403).json({ message: "Not authorized as admin" });
    }
    req.isAdmin = true;
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

module.exports = adminAuth;
module.exports.requireAdminAuth = requireAdminAuth;
