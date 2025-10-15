const express = require("express");
const authRoutes = require("./auth");
const adminRoutes = require("./admin");
const photographerRoutes = require("./photographer");
const clientRoutes = require("./client");
const guestRoutes = require("./guest");
const photoRoutes = require("./photos");
const collectionRoutes = require("./collections");
const { authenticateToken } = require("../middleware/auth");
const eventEmitter = require("../services/eventEmitterService");

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

// Server-Sent Events endpoint for real-time updates
router.get("/events", authenticateToken, (req, res) => {
  // Set headers for SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering

  const { role, userId } = req.user;

  // Add client to event emitter
  eventEmitter.addClient(res, role, userId);

  console.log(`📡 SSE connection established for ${role}: ${userId}`);
});

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
    sseConnections: eventEmitter.getStats(),
  });
});

module.exports = router;
