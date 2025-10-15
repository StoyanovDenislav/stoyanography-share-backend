require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");

const api = require("./routes/api");
const Database = require("./Database/databaseClass");
const CleanupService = require("./services/cleanupService");
const { startCleanupCron } = require("./cleanupCron");

const app = express();
const PORT = process.env.PORT || 6002;

// Security middleware
app.use(helmet());

app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.url}`);
  next();
});
// CORS configuration
app.use((req, res, next) => {
  const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://localhost:3001",
    "https://share.stoyanography.com",
    "https://api.share.stoyanography.com",
    "https://*.stoyanography.com",
  ];
  const origin = req.get("Origin");

  console.log("🌐 CORS Origin:", origin);

  const isAllowed = allowedOrigins.some((allowed) => {
    const regex = new RegExp(
      `^${allowed.replace(/\*/g, ".*").replace(/\//g, "\\/")}\\/?$`
    );
    const result = regex.test(origin);
    console.log(`   Testing ${origin} against ${allowed}: ${result}`);
    return result;
  });

  if (origin && isAllowed) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, HEAD, OPTIONS, POST, PUT, DELETE, PATCH"
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Access-Control-Allow-Headers, Origin, Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers, Authorization"
    );
  }

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    console.log("   ✅ Preflight request handled");
    return res.status(204).end();
  }

  next();
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later.",
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 auth requests per windowMs
  message: {
    success: false,
    message: "Too many authentication attempts, please try again later.",
  },
});

app.use(limiter);
app.use("/api/auth", authLimiter);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// API routes
app.use("/api", api);

// Global error handler
app.use((error, req, res, next) => {
  console.error("Global error handler:", error);
  res.status(500).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : error.message,
    ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

// HTTPS configuration
let server;
const USE_HTTPS = process.env.USE_HTTPS === "true";

if (USE_HTTPS) {
  try {
    // In production, use proper SSL certificates
    // In development, use self-signed certificates
    const certPath =
      process.env.NODE_ENV === "production"
        ? {
            key: process.env.SSL_KEY_PATH || "/etc/ssl/private/key.pem",
            cert: process.env.SSL_CERT_PATH || "/etc/ssl/certs/cert.pem",
          }
        : {
            key: path.join(__dirname, "ssl", "key.pem"),
            cert: path.join(__dirname, "ssl", "cert.pem"),
          };

    const httpsOptions = {
      key: fs.readFileSync(certPath.key),
      cert: fs.readFileSync(certPath.cert),
      maxHeaderSize: 16384, // 16KB (default is 8KB)
    };

    server = https.createServer(httpsOptions, app);
    console.log("🔒 HTTPS enabled");
  } catch (error) {
    console.error(
      "❌ SSL certificate error:",
      error.message,
      "\nFalling back to HTTP. Run 'npm run generate-cert' to create self-signed certificates for development."
    );
    server = http.createServer({ maxHeaderSize: 16384 }, app);
  }
} else {
  // Create HTTP server with increased header size limit
  server = http.createServer({ maxHeaderSize: 16384 }, app);
  console.log("ℹ️  HTTP mode (set USE_HTTPS=true in .env to enable HTTPS)");
}

server.listen(PORT, async (error) => {
  if (!error) {
    const protocol = USE_HTTPS ? "https" : "http";
    console.log(`Server is running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
    console.log(`Server accessible at: ${protocol}://localhost:${PORT}`);

    // Test database connection
    try {
      const dbInstance = new Database(
        process.env.DB_HOST,
        process.env.DB_PORT,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD
      );

      // Test connection
      const server = dbInstance.getConnection();
      console.log("Database connection established successfully");

      // Test database access
      const db = dbInstance.useDatabase(
        process.env.DB_NAME,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD
      );

      // Create User class if it doesn't exist
      try {
        await db.query("CREATE CLASS User EXTENDS V");
        console.log("User class created successfully");

        // Create properties
        const properties = [
          "CREATE PROPERTY User.username STRING",
          "CREATE PROPERTY User.email STRING",
          "CREATE PROPERTY User.password STRING",
          "CREATE PROPERTY User.createdAt DATETIME",
          "CREATE PROPERTY User.lastLogin DATETIME",
        ];

        for (const property of properties) {
          await db.query(property);
        }

        // Create indexes for better performance
        await db.query("CREATE INDEX User.username UNIQUE");
        await db.query("CREATE INDEX User.email UNIQUE");

        console.log("User class and indexes created/verified successfully");
      } catch (classError) {
        if (classError.message.includes("already exists")) {
          console.log("User class and indexes already exist");
        } else {
          console.log("Error creating User class:", classError.message);
        }
      }

      dbInstance.closeConnection();
    } catch (err) {
      console.error("Database connection error:", err);
    }

    // Start cleanup job - runs every 10 seconds (for testing)
    console.log(
      "🧹 Starting cleanup service (runs every 10 seconds for testing)..."
    );
    const cleanupService = new CleanupService();

    // Run immediately on startup
    cleanupService
      .runAll()
      .catch((err) => console.error("Initial cleanup error:", err));

    // Then run every 10 seconds (for testing)
    setInterval(async () => {
      try {
        await cleanupService.runAll();
      } catch (err) {
        console.error("Scheduled cleanup error:", err);
      }
    }, 10 * 1000); // 10 seconds (for testing - change to 60 * 60 * 1000 for production)

    // Start soft delete cleanup cron (runs daily at 3:00 AM)
    startCleanupCron();
  } else {
    console.log("Error occurred, server can't start", error);
  }
});
