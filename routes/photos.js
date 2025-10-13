const express = require("express");
const PhotoService = require("../services/photoService");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();
const photoService = new PhotoService();

// Configure multer for photo uploads
const upload = photoService.getMulterConfig();

// Upload photo (protected route)
router.post("/upload", authenticateToken, upload.single("photo"), (req, res) =>
  photoService.uploadPhoto(req, res)
);

// Get client's photos (protected route)
router.get("/my-photos", authenticateToken, (req, res) =>
  photoService.getClientPhotos(req, res)
);

// Share photo via token (public route)
router.get("/share/:shareToken", (req, res) =>
  photoService.sharePhoto(req, res)
);

// Delete photo (protected route)
router.delete("/:photoId", authenticateToken, (req, res) =>
  photoService.deletePhoto(req, res)
);

module.exports = router;
