const express = require("express");
const PhotographerService = require("../services/photographerService");
const EnhancedPhotoService = require("../services/enhancedPhotoService");
const { authenticateToken } = require("../middleware/auth");
const archiver = require("archiver");

const router = express.Router();
const photographerService = new PhotographerService();
const photoService = new EnhancedPhotoService();

// All photographer routes require authentication
router.use(authenticateToken);

// Middleware to check if user is photographer
const requirePhotographer = (req, res, next) => {
  if (req.user.role !== "photographer" && req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Photographer privileges required.",
    });
  }
  next();
};

router.use(requirePhotographer);

// Get all clients for this photographer
router.get("/clients", (req, res) => photographerService.getClients(req, res));

// Create a new client
router.post(
  "/create-client",
  PhotographerService.getClientValidation(),
  (req, res) => photographerService.createClient(req, res)
);

// Get all photos for this photographer
router.get("/photos", (req, res) =>
  photoService.getPhotographerPhotos(req, res)
);

// Get a single photo by ID (full size with base64)
router.get("/photos/:photoId", (req, res) =>
  photoService.getPhotoById(req, res)
);

// Delete a photo
router.delete("/photos/:photoId", (req, res) =>
  photoService.deletePhoto(req, res)
);

// Upload photos (plural to match frontend)
const upload = photoService.getMulterConfig();
router.post("/upload-photos", upload.array("photos", 20), (req, res) =>
  photoService.uploadPhoto(req, res)
);

// Share photos with client
router.post("/share-photos", (req, res) =>
  photographerService.sharePhotosWithClient(req, res)
);

// Get photo groups
router.get("/photo-groups", (req, res) =>
  photographerService.getPhotoGroups(req, res)
);

// Create photo group
router.post("/create-group", (req, res) =>
  photographerService.createPhotoGroup(req, res)
);

// Download single photo
router.get("/photos/:shareToken/download", async (req, res) => {
  try {
    const { shareToken } = req.params;
    const photographerId = req.user.photographerId || req.user.userId;

    const Database = require("../Database/databaseClass");
    const dbInstance = new Database(
      process.env.DB_HOST,
      process.env.DB_PORT,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );

    const db = dbInstance.useDatabase(
      process.env.DB_NAME,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );

    // Get photo owned by this photographer
    const photos = await db.query(
      `SELECT originalName, photoDataB64 FROM Photo 
       WHERE shareToken = :shareToken 
       AND photographerId = :photographerId
       AND scheduledDeletionDate IS NULL`,
      {
        params: { shareToken, photographerId },
      }
    );

    dbInstance.closeConnection();

    if (!photos || photos.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Photo not found",
      });
    }

    const photo = photos[0];

    // Convert base64 to buffer
    const photoBuffer = Buffer.from(photo.photoDataB64, "base64");

    // Set headers for download
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${photo.originalName || "photo.jpg"}"`
    );
    res.setHeader("Content-Length", photoBuffer.length);

    res.send(photoBuffer);
  } catch (error) {
    console.error("Error downloading photo:", error);
    res.status(500).json({
      success: false,
      message: "Error downloading photo",
      error: error.message,
    });
  }
});

// Download multiple photos as ZIP
router.post("/photos/download-zip", async (req, res) => {
  try {
    const { shareTokens } = req.body;
    const photographerId = req.user.photographerId || req.user.userId;

    if (
      !shareTokens ||
      !Array.isArray(shareTokens) ||
      shareTokens.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide an array of shareTokens",
      });
    }

    const Database = require("../Database/databaseClass");
    const dbInstance = new Database(
      process.env.DB_HOST,
      process.env.DB_PORT,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );

    const db = dbInstance.useDatabase(
      process.env.DB_NAME,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );

    // Get all photos owned by this photographer
    const photos = await db.query(
      `SELECT originalName, photoDataB64 FROM Photo 
       WHERE shareToken IN :shareTokens 
       AND photographerId = :photographerId
       AND scheduledDeletionDate IS NULL`,
      {
        params: { shareTokens, photographerId },
      }
    );

    dbInstance.closeConnection();

    if (!photos || photos.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No photos found",
      });
    }

    // Create ZIP archive
    const archive = archiver("zip", {
      zlib: { level: 9 }, // Maximum compression
    });

    // Set headers
    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="photos_${Date.now()}.zip"`
    );

    // Pipe archive to response
    archive.pipe(res);

    // Add each photo to the archive
    for (const photo of photos) {
      const photoBuffer = Buffer.from(photo.photoDataB64, "base64");
      archive.append(photoBuffer, { name: photo.originalName || "photo.jpg" });
    }

    // Finalize the archive
    await archive.finalize();

    archive.on("error", (err) => {
      console.error("Archive error:", err);
      res.status(500).json({
        success: false,
        message: "Error creating archive",
        error: err.message,
      });
    });
  } catch (error) {
    console.error("Error downloading photos as ZIP:", error);
    res.status(500).json({
      success: false,
      message: "Error downloading photos",
      error: error.message,
    });
  }
});

module.exports = router;
