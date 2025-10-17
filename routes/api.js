const express = require("express");
const authRoutes = require("./auth");
const adminRoutes = require("./admin");
const photographerRoutes = require("./photographer");
const clientRoutes = require("./client");
// const guestRoutes = require("./guest"); // REMOVED - Guest functionality disabled
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

// Guest routes (temporary photo access) - DISABLED
// router.use("/guest", guestRoutes);

// Photo routes
router.use("/photos", photoRoutes);

// Collection routes (photographer and client)
router.use("/", collectionRoutes);

// Rate limiting map for SSE connections (prevent rapid reconnections)
const sseConnectionAttempts = new Map();
const SSE_RATE_LIMIT = 10; // Max 10 connection attempts (increased for development)
const SSE_RATE_WINDOW = 60000; // Per 60 seconds (1 minute)

// Server-Sent Events endpoint for real-time updates
router.get("/events", authenticateToken, (req, res) => {
  const { role, userId } = req.user;
  const clientKey = `${role}-${userId}`;

  // Check rate limiting
  const now = Date.now();
  const attempts = sseConnectionAttempts.get(clientKey) || [];
  const recentAttempts = attempts.filter(
    (time) => now - time < SSE_RATE_WINDOW
  );

  if (recentAttempts.length >= SSE_RATE_LIMIT) {
    console.warn(`⚠️ SSE rate limit exceeded for ${clientKey}`);
    res.status(429).json({
      success: false,
      message: "Too many connection attempts. Please wait before reconnecting.",
    });
    return;
  }

  // Record this connection attempt
  recentAttempts.push(now);
  sseConnectionAttempts.set(clientKey, recentAttempts);

  // Clean up old entries periodically
  if (Math.random() < 0.1) {
    // 10% chance to cleanup
    for (const [key, times] of sseConnectionAttempts.entries()) {
      const recent = times.filter((time) => now - time < SSE_RATE_WINDOW);
      if (recent.length === 0) {
        sseConnectionAttempts.delete(key);
      } else {
        sseConnectionAttempts.set(key, recent);
      }
    }
  }

  // Set headers for SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering

  // CRITICAL: Disable compression for SSE (prevents buffering)
  res.setHeader("Content-Encoding", "none");
  res.setHeader("Transfer-Encoding", "chunked");

  // Set status and flush headers immediately to establish connection
  res.status(200);
  res.flushHeaders(); // Forces headers to be sent, establishing the SSE connection

  // Add client to event emitter
  eventEmitter.addClient(res, role, userId);

  console.log(`📡 SSE connection established for ${role}: ${userId}`);

  // CRITICAL: Don't call res.end() - keep connection open!
  // The connection will close when client disconnects or server shuts down
  // The 'close' event handler in eventEmitterService will clean up

  // Keep the request alive by preventing timeout
  req.on("close", () => {
    console.log(`📡 SSE request closed for ${role}: ${userId}`);
  });

  // Prevent Express from timing out this connection
  req.setTimeout(0);
  res.setTimeout(0);
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
