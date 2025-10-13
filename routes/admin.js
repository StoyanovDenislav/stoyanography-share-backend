const express = require("express");
const PhotographerService = require("../services/photographerService");
const AdminService = require("../services/adminService");
const SoftDeleteService = require("../services/softDeleteService");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();
const photographerService = new PhotographerService();
const adminService = new AdminService();
const softDeleteService = new SoftDeleteService();

// All admin routes require authentication
router.use(authenticateToken);

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin privileges required.",
    });
  }
  next();
};

router.use(requireAdmin);

// System statistics
router.get("/stats", (req, res) => adminService.getSystemStats(req, res));

// Get all photographers
router.get("/photographers", (req, res) =>
  adminService.getAllPhotographers(req, res)
);

// Get all clients
router.get("/clients", (req, res) => adminService.getAllClients(req, res));

// Get all guests
router.get("/guests", (req, res) => adminService.getAllGuests(req, res));

// Get all collections
router.get("/collections", (req, res) =>
  adminService.getAllCollections(req, res)
);

// Get all photos
router.get("/photos", (req, res) => adminService.getAllPhotos(req, res));

// Create a new photographer
router.post("/create-photographer", (req, res) =>
  photographerService.createPhotographer(req, res)
);

// Toggle photographer active status
router.put("/photographer/:photographerId/toggle", (req, res) =>
  photographerService.togglePhotographerStatus(req, res)
);

// Get photographer statistics
router.get("/photographer/:photographerId/stats", (req, res) =>
  photographerService.getPhotographerStats(req, res)
);

// Delete photographer (optional)
router.delete("/photographer/:photographerId", (req, res) =>
  photographerService.deletePhotographer(req, res)
);

// Delete client
router.delete("/client/:clientId", async (req, res) => {
  try {
    const { clientId } = req.params;
    const { reason = "Admin deletion" } = req.body;

    // Client ID is a UUID
    const result = await softDeleteService.markForDeletion(
      "Client",
      clientId,
      reason,
      "clientId" // Use clientId UUID as the identifier field
    );
    res.json({
      success: true,
      message:
        "Client marked for deletion. Will be permanently deleted in 7 days.",
      scheduledDeletionDate: result.scheduledDeletionDate,
    });
  } catch (error) {
    console.error("Delete client error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete client",
      error: error.message,
    });
  }
});

// Delete guest
router.delete("/guest/:guestId", async (req, res) => {
  try {
    const { guestId } = req.params;
    const { reason = "Admin deletion" } = req.body;

    // Guest ID is a UUID
    const result = await softDeleteService.markForDeletion(
      "Guest",
      guestId,
      reason,
      "guestId" // Use guestId UUID as the identifier field
    );
    res.json({
      success: true,
      message:
        "Guest marked for deletion. Will be permanently deleted in 7 days.",
      scheduledDeletionDate: result.scheduledDeletionDate,
    });
  } catch (error) {
    console.error("Delete guest error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete guest",
      error: error.message,
    });
  }
});

// Delete collection
router.delete("/collection/:collectionId", async (req, res) => {
  try {
    const { collectionId } = req.params;
    const { reason = "Admin deletion" } = req.body;

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

    // Get all photos in this collection
    const photosInCollection = await db.query(
      `SELECT photoId
       FROM Photo
       WHERE @rid IN (
         SELECT expand(in) 
         FROM CollectionPhoto 
         WHERE out IN (SELECT FROM PhotoCollection WHERE collectionId = :collectionId)
       )`,
      {
        params: { collectionId },
      }
    );

    console.log(
      `🗑️ Admin deleting collection ${collectionId} with ${photosInCollection.length} photos`
    );

    // Soft delete each photo in the collection
    for (const photo of photosInCollection) {
      await softDeleteService.markForDeletion(
        "Photo",
        photo.photoId,
        `Deleted with collection: ${collectionId}`,
        "photoId"
      );
    }

    // Soft delete the collection
    const result = await softDeleteService.markForDeletion(
      "PhotoCollection",
      collectionId,
      reason,
      "collectionId"
    );

    dbInstance.closeConnection();

    res.json({
      success: true,
      message: `Collection and ${photosInCollection.length} photo(s) marked for deletion. Will be permanently deleted in 7 days.`,
      scheduledDeletionDate: result.scheduledDeletionDate,
      photosDeleted: photosInCollection.length,
    });
  } catch (error) {
    console.error("Delete collection error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete collection",
      error: error.message,
    });
  }
});

// Delete photo
router.delete("/photo/:photoId", async (req, res) => {
  try {
    const { photoId } = req.params;
    const { reason = "Admin deletion" } = req.body;

    const result = await softDeleteService.markForDeletion(
      "Photo",
      photoId,
      reason
    );
    res.json({
      success: true,
      message:
        "Photo marked for deletion. Will be permanently deleted in 7 days.",
      scheduledDeletionDate: result.scheduledDeletionDate,
    });
  } catch (error) {
    console.error("Delete photo error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete photo",
      error: error.message,
    });
  }
});

// Get all scheduled deletions
router.get("/scheduled-deletions", async (req, res) => {
  try {
    const scheduled = await softDeleteService.getScheduledDeletions();
    res.json({ success: true, scheduled });
  } catch (error) {
    console.error("Error fetching scheduled deletions:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch scheduled deletions",
    });
  }
});

// Restore an entity from scheduled deletion
router.post("/restore", async (req, res) => {
  try {
    const { entityClass, entityId } = req.body;

    if (!entityClass || !entityId) {
      return res.status(400).json({
        success: false,
        message: "entityClass and entityId are required",
      });
    }

    // If restoring a PhotoCollection, also restore its photos
    if (entityClass === "PhotoCollection") {
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

      // Get all photos in this collection that are scheduled for deletion
      const photosInCollection = await db.query(
        `SELECT photoId
         FROM Photo
         WHERE scheduledDeletionDate IS NOT NULL
         AND @rid IN (
           SELECT expand(in) 
           FROM CollectionPhoto 
           WHERE out IN (SELECT FROM PhotoCollection WHERE collectionId = :collectionId)
         )`,
        {
          params: { collectionId: entityId },
        }
      );

      console.log(
        `📦 Restoring collection ${entityId} with ${photosInCollection.length} photos`
      );

      // Restore each photo in the collection
      for (const photo of photosInCollection) {
        await softDeleteService.restoreDeleted(
          "Photo",
          photo.photoId,
          "photoId"
        );
      }

      dbInstance.closeConnection();

      // Restore the collection itself
      const restored = await softDeleteService.restoreDeleted(
        entityClass,
        entityId,
        "collectionId"
      );

      res.json({
        success: true,
        message: `PhotoCollection and ${photosInCollection.length} photo(s) restored successfully`,
        entity: restored,
        photosRestored: photosInCollection.length,
      });
    } else {
      // For other entities, just restore normally
      const restored = await softDeleteService.restoreDeleted(
        entityClass,
        entityId
      );
      res.json({
        success: true,
        message: `${entityClass} restored successfully`,
        entity: restored,
      });
    }
  } catch (error) {
    console.error("Error restoring entity:", error);
    res.status(500).json({
      success: false,
      message: "Failed to restore entity",
    });
  }
});

// Manually run cleanup of scheduled deletions
router.post("/cleanup-deletions", async (req, res) => {
  try {
    const summary = await softDeleteService.cleanupScheduledDeletions();
    res.json({
      success: true,
      message: "Cleanup completed successfully",
      summary,
    });
  } catch (error) {
    console.error("Error during cleanup:", error);
    res.status(500).json({
      success: false,
      message: "Failed to run cleanup",
    });
  }
});

// NUCLEAR OPTION: Force delete ALL marked items (ignores 7-day grace period)
router.post("/nuke-all-deletions", async (req, res) => {
  try {
    const summary = await softDeleteService.nukeAllMarkedForDeletion();
    res.json({
      success: true,
      message:
        "Nuclear deletion completed - all marked items permanently deleted",
      summary,
    });
  } catch (error) {
    console.error("Error during nuclear deletion:", error);
    res.status(500).json({
      success: false,
      message: "Failed to nuke deletions",
    });
  }
});

module.exports = router;
