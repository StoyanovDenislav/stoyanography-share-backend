const express = require("express");
const ClientService = require("../services/clientService");
const { authenticateToken } = require("../middleware/auth");
const { body } = require("express-validator");
const archiver = require("archiver");

const router = express.Router();
const clientService = new ClientService();

// Generate credentials for new client (only email required)
router.post(
  "/generate-credentials",
  [
    body("email")
      .isEmail()
      .withMessage("Please provide a valid email address")
      .normalizeEmail(),
    body("clientName")
      .isLength({ min: 2, max: 100 })
      .withMessage("Client name must be between 2 and 100 characters"),
  ],
  (req, res) => clientService.generateCredentials(req, res)
);

// Client login with generated credentials
router.post(
  "/login",
  [
    body("username").notEmpty().withMessage("Username is required"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  (req, res) => clientService.login(req, res)
);

// Get client profile (protected route)
router.get("/profile", authenticateToken, (req, res) =>
  clientService.getProfile(req, res)
);

// Deactivate client account
router.post("/deactivate", authenticateToken, (req, res) =>
  clientService.deactivateClient(req, res)
);

// Verify client token
router.get("/verify", authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: "Token is valid",
    client: {
      clientId: req.user.clientId,
      username: req.user.username,
      email: req.user.email,
      type: req.user.type,
    },
  });
});

// Get client's accessible photos
router.get("/photos", authenticateToken, (req, res) =>
  clientService.getAccessiblePhotos(req, res)
);

// Get client's accessible collections
router.get("/collections", authenticateToken, (req, res) =>
  clientService.getCollections(req, res)
);

// Get photos in a specific collection
router.get("/collections/:collectionId/photos", authenticateToken, (req, res) =>
  clientService.getCollectionPhotos(req, res)
);

// Get single photo by shareToken (for viewing in modal)
router.get("/photos/:shareToken", authenticateToken, async (req, res) => {
  try {
    const { shareToken } = req.params;
    const clientId = req.user.userId || req.user.clientId;

    const db = clientService.dbInstance.useDatabase(
      process.env.DB_NAME,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );

    // Get photo - clients can access photos shared with them via CollectionAccess
    const photos = await db.query(
      `SELECT @rid as id, filename, originalName, size, width, height, 
              photoDataB64, photographerId, shareToken, uploadedAt, mimetype
       FROM Photo 
       WHERE shareToken = :shareToken 
       AND isActive = true`,
      {
        params: { shareToken },
      }
    );

    if (photos.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Photo not found",
      });
    }

    const photo = photos[0];

    // Verify client has access to this photo through CollectionAccess
    // Simpler query: Check if photo is in a collection that the client has access to
    const accessCheck = await db.query(
      `SELECT COUNT(*) as count
       FROM Photo
       WHERE shareToken = :shareToken
       AND @rid IN (
         SELECT in FROM CollectionPhoto
         WHERE out IN (
           SELECT out FROM CollectionAccess
           WHERE in IN (SELECT FROM Client WHERE username = :username)
         )
       )`,
      {
        params: {
          username: req.user.username,
          shareToken: shareToken,
        },
      }
    );

    console.log("📸 Photo access check for client:", {
      username: req.user.username,
      shareToken,
      accessCount: accessCheck[0]?.count,
    });

    if (accessCheck.length === 0 || accessCheck[0].count === 0) {
      return res.status(403).json({
        success: false,
        message: "Access denied to this photo",
      });
    }

    // Return photo with full-size image
    res.json({
      success: true,
      photo: {
        id: photo.id,
        shareToken: photo.shareToken,
        filename: photo.filename,
        originalName: photo.originalName,
        size: photo.size,
        width: photo.width,
        height: photo.height,
        photoData: photo.photoDataB64, // Base64 encoded photo data
        uploadedAt: photo.uploadedAt,
      },
    });
  } catch (error) {
    console.error("Get photo error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve photo",
      error: error.message,
    });
  }
});

// Get client's guests
router.get("/guests", authenticateToken, (req, res) =>
  clientService.getGuests(req, res)
);

// Toggle guest access (enable/disable)
router.patch("/guests/:guestId/toggle-access", authenticateToken, (req, res) =>
  clientService.toggleGuestAccess(req, res)
);

// Create guest account
router.post(
  "/create-guest",
  authenticateToken,
  ClientService.getGuestValidation(),
  (req, res) => clientService.createGuest(req, res)
);

// Download single photo
router.get(
  "/photos/:shareToken/download",
  authenticateToken,
  async (req, res) => {
    try {
      const { shareToken } = req.params;
      const clientId = req.user.userId || req.user.clientId;

      const db = clientService.dbInstance.useDatabase(
        process.env.DB_NAME,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD
      );

      // Get photo - clients can access photos shared with them
      const photos = await db.query(
        `SELECT photoDataB64, originalName, mimetype, shareToken
       FROM Photo 
       WHERE shareToken = :shareToken 
       AND isActive = true`,
        {
          params: { shareToken },
        }
      );

      if (photos.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Photo not found",
        });
      }

      const photo = photos[0];
      const photoBuffer = Buffer.from(photo.photoDataB64, "base64");

      // Set headers for download
      res.setHeader("Content-Type", photo.mimetype || "image/jpeg");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${photo.originalName || "photo.jpg"}"`
      );
      res.setHeader("Content-Length", photoBuffer.length);

      res.send(photoBuffer);
    } catch (error) {
      console.error("Photo download error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to download photo",
      });
    } finally {
      clientService.dbInstance.closeConnection();
    }
  }
);

// Download multiple photos as ZIP
router.post("/photos/download-zip", authenticateToken, async (req, res) => {
  try {
    const { shareTokens, photoTokens } = req.body;
    const tokens = shareTokens || photoTokens; // Accept both parameter names

    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "No photos selected. Please provide shareTokens or photoTokens array.",
      });
    }

    const db = clientService.dbInstance.useDatabase(
      process.env.DB_NAME,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );

    // Get all selected photos
    const photos = await db.query(
      `SELECT photoDataB64, originalName, mimetype, shareToken
       FROM Photo 
       WHERE shareToken IN :tokens 
       AND isActive = true`,
      {
        params: { tokens: tokens },
      }
    );

    if (photos.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No photos found",
      });
    }

    // Create ZIP archive
    const archive = archiver("zip", {
      zlib: { level: 9 },
    });

    const zipFilename = `photos-${Date.now()}.zip`;
    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${zipFilename}"`
    );

    archive.pipe(res);

    // Add photos to archive
    photos.forEach((photo, index) => {
      const photoBuffer = Buffer.from(photo.photoDataB64, "base64");
      const filename = photo.originalName || `photo-${index + 1}.jpg`;
      archive.append(photoBuffer, { name: filename });
    });

    await archive.finalize();
  } catch (error) {
    console.error("ZIP download error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create ZIP file",
    });
  } finally {
    clientService.dbInstance.closeConnection();
  }
});

module.exports = router;
