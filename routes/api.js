const express = require("express");
const authRoutes = require("./auth");
const adminRoutes = require("./admin");
const photographerRoutes = require("./photographer");
const clientRoutes = require("./client");
const guestRoutes = require("./guest");
const photoRoutes = require("./photos");
const collectionRoutes = require("./collections");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// Auth routes (admin/system authentication)
router.use("/auth", authRoutes);

// Admin routes (photographer management)
router.use("/admin", adminRoutes);

// Photographer routes (client and photo management)
router.use("/photographer", photographerRoutes);

// Client routes (photo sharing clients)
router.use("/client", clientRoutes);

// Guest routes (temporary photo access)
router.use("/guest", guestRoutes);

// Photo routes
router.use("/photos", photoRoutes);

// Collection routes (photographer and client)
router.use("/", collectionRoutes);

// Protected API routes
router.get("/protected", authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: "This is a protected route",
    user: req.user,
  });
});

// Health check
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "API is working",
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
