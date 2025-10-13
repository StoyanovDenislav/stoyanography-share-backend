const jwt = require("jsonwebtoken");

const authenticateToken = (req, res, next) => {
  // Try to get token from cookie first, then fall back to Authorization header
  let token = req.cookies?.token;

  if (!token) {
    const authHeader = req.headers["authorization"];
    token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access token required",
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: "Invalid or expired token",
      });
    }
    req.user = user;
    next();
  });
};

const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "15m", // Shorter expiry for access tokens
  });
};

const setTokenCookie = (res, token) => {
  const isProduction = process.env.NODE_ENV === "production";

  res.cookie("token", token, {
    httpOnly: true, // Prevent XSS attacks
    secure: isProduction, // Use HTTPS in production
    sameSite: isProduction ? "strict" : "lax", // CSRF protection
    maxAge: 15 * 60 * 1000, // 15 minutes in milliseconds
    path: "/",
  });
};

const setSessionIdCookie = (res, sessionId) => {
  const isProduction = process.env.NODE_ENV === "production";

  // Session ID cookie - references the refresh token in database
  res.cookie("sessionId", sessionId, {
    httpOnly: true, // Prevent XSS attacks
    secure: isProduction, // Use HTTPS in production
    sameSite: isProduction ? "strict" : "lax", // CSRF protection
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    path: "/",
  });
};

const clearTokenCookie = (res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    path: "/",
  });
};

const clearSessionIdCookie = (res) => {
  res.clearCookie("sessionId", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    path: "/",
  });
};

module.exports = {
  authenticateToken,
  generateToken,
  setTokenCookie,
  setSessionIdCookie,
  clearTokenCookie,
  clearSessionIdCookie,
};
