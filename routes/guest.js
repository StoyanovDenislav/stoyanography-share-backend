const express = require("express");
const router = express.Router();
const GuestService = require("../services/guestService");
const { authenticateToken } = require("../middleware/auth");
const archiver = require("archiver");

const guestService = new GuestService();

// Guest login
router.post("/login", GuestService.getLoginValidation(), (req, res) => {
  guestService.login(req, res);
});

// Get accessible photos for guest
router.get("/photos", authenticateToken, (req, res) => {
  guestService.getAccessiblePhotos(req, res);
});

// Download single photo
router.get(
  "/photos/:shareToken/download",
  authenticateToken,
  async (req, res) => {
    try {
      const { shareToken } = req.params;
      const guestId = req.user.guestId || req.user.userId;

      const db = guestService.dbInstance.useDatabase(
        process.env.DB_NAME,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD
      );

      // Verify guest has access to this photo
      const photos = await db.query(
        `SELECT p.photoDataB64, p.originalName, p.mimetype
       FROM Photo p
       WHERE p.shareToken = :shareToken
       AND p.isActive = true
       AND @rid IN (
         SELECT in FROM PhotoAccess WHERE out = :guestId
       )`,
        {
          params: { shareToken, guestId },
        }
      );

      if (photos.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Photo not found or access denied",
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
      guestService.dbInstance.closeConnection();
    }
  }
);

// Download multiple photos as ZIP
router.post("/photos/download-zip", authenticateToken, async (req, res) => {
  try {
    const { photoTokens } = req.body; // Array of shareTokens
    const guestId = req.user.guestId || req.user.userId;

    if (!photoTokens || photoTokens.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No photos selected",
      });
    }

    const db = guestService.dbInstance.useDatabase(
      process.env.DB_NAME,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );

    // Get all accessible photos
    const photos = await db.query(
      `SELECT p.photoDataB64, p.originalName, p.mimetype, p.shareToken
       FROM Photo p
       WHERE p.shareToken IN :tokens
       AND p.isActive = true
       AND @rid IN (
         SELECT in FROM PhotoAccess WHERE out = :guestId
       )`,
      {
        params: { tokens: photoTokens, guestId },
      }
    );

    if (photos.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No accessible photos found",
      });
    }

    // Create ZIP archive
    const archive = archiver("zip", {
      zlib: { level: 9 }, // Maximum compression
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
    guestService.dbInstance.closeConnection();
  }
});

module.exports = router;
