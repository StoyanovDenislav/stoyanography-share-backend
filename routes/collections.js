const express = require("express");
const PhotoCollectionService = require("../services/photoCollectionService");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();
const collectionService = new PhotoCollectionService();

// Photographer routes
router.post(
  "/photographer/collections",
  authenticateToken,
  PhotoCollectionService.getCreateCollectionValidation(),
  (req, res) => collectionService.createCollection(req, res)
);

router.get("/photographer/collections", authenticateToken, (req, res) =>
  collectionService.getCollections(req, res)
);

router.get(
  "/photographer/collections/:collectionId",
  authenticateToken,
  (req, res) => collectionService.getCollectionById(req, res)
);

router.delete(
  "/photographer/collections/:collectionId",
  authenticateToken,
  (req, res) => collectionService.deleteCollection(req, res)
);

router.post(
  "/photographer/collections/:collectionId/photos",
  authenticateToken,
  (req, res) => collectionService.addPhotosToCollection(req, res)
);

router.get(
  "/photographer/collections/:collectionId/photos",
  authenticateToken,
  (req, res) => collectionService.getCollectionPhotos(req, res)
);

router.post(
  "/photographer/collections/:collectionId/share",
  authenticateToken,
  PhotoCollectionService.getShareCollectionValidation(),
  (req, res) => collectionService.shareCollection(req, res)
);

// Client routes
router.get("/client/collections", authenticateToken, (req, res) =>
  collectionService.getClientCollections(req, res)
);

router.get(
  "/client/collections/:collectionId/photos",
  authenticateToken,
  (req, res) => collectionService.getClientCollectionPhotos(req, res)
);

module.exports = router;
