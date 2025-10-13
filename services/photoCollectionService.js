const { v4: uuidv4 } = require("uuid");
const { body, validationResult } = require("express-validator");
const Database = require("../Database/databaseClass");
const SoftDeleteService = require("./softDeleteService");
const { toOrientDBDateTime } = require("../utils/dateFormatter");
const EncryptionService = require("./encryptionService");
const EmailService = require("./emailService");

class PhotoCollectionService {
  constructor() {
    this.dbInstance = new Database(
      process.env.DB_HOST,
      process.env.DB_PORT,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );
    this.softDeleteService = new SoftDeleteService();
    this.encryption = new EncryptionService();
    this.emailService = new EmailService();
  }

  static getCreateCollectionValidation() {
    return [
      body("name")
        .notEmpty()
        .withMessage("Collection name is required")
        .isLength({ min: 1, max: 100 })
        .withMessage("Collection name must be between 1 and 100 characters"),
      body("description")
        .optional()
        .isLength({ max: 500 })
        .withMessage("Description cannot exceed 500 characters"),
    ];
  }

  static getShareCollectionValidation() {
    return [
      body("clientUsername")
        .notEmpty()
        .withMessage("Client username is required")
        .isString()
        .withMessage("Client username must be a string"),
    ];
  }

  /**
   * Create a new photo collection
   */
  async createCollection(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { name, description } = req.body;
    const photographerId = req.user.photographerId || req.user.userId; // From JWT token

    const db = this.dbInstance.useDatabase(
      process.env.DB_NAME,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );

    try {
      const collectionId = uuidv4();

      // Don't set autoDeleteAt yet - it will be set when the last photo is uploaded
      const result = await db.query(
        `CREATE VERTEX PhotoCollection SET 
         collectionId = :collectionId,
         name = :name,
         description = :description,
         photographerId = :photographerId,
         isActive = true,
         createdAt = sysdate(),
         updatedAt = sysdate(),
         autoDeleteAt = null`,
        {
          params: {
            collectionId,
            name,
            description: description || "",
            photographerId,
          },
        }
      );

      res.json({
        success: true,
        message: "Collection created successfully",
        collection: {
          collectionId,
          name,
          description: description || "",
          photographerId,
          isActive: true,
        },
      });
    } catch (error) {
      console.error("Create collection error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create collection",
        error: error.message,
      });
    } finally {
      this.dbInstance.closeConnection();
    }
  }

  /**
   * Get all collections for a photographer
   */
  async getCollections(req, res) {
    const photographerId = req.user.photographerId || req.user.userId; // From JWT token

    const db = this.dbInstance.useDatabase(
      process.env.DB_NAME,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );

    try {
      const collections = await db.query(
        `SELECT collectionId, name, description, photographerId, coverPhotoId, 
                isActive, createdAt, updatedAt, autoDeleteAt
         FROM PhotoCollection 
         WHERE photographerId = :photographerId AND isActive = true
         AND scheduledDeletionDate IS NULL
         ORDER BY createdAt DESC`,
        {
          params: { photographerId },
        }
      );

      // Get photo count for each collection using collectionId (UUID) not RID
      const collectionsWithCount = await Promise.all(
        collections.map(async (c) => {
          // Use collectionId to count photos via subquery - NO RIDS!
          const photoCount = await db.query(
            `SELECT COUNT(*) as count 
             FROM CollectionPhoto 
             WHERE out IN (SELECT FROM PhotoCollection WHERE collectionId = :collectionId)`,
            {
              params: { collectionId: c.collectionId },
            }
          );

          // Get first photo's thumbnail for collection preview
          const firstPhoto = await db.query(
            `SELECT thumbnailDataB64 
             FROM Photo 
             WHERE @rid IN (
               SELECT in FROM CollectionPhoto 
               WHERE out IN (SELECT FROM PhotoCollection WHERE collectionId = :collectionId)
             )
             AND isActive = true
             ORDER BY uploadedAt ASC
             LIMIT 1`,
            {
              params: { collectionId: c.collectionId },
            }
          );

          // Calculate days remaining until auto-deletion
          let daysRemaining = null;
          if (c.autoDeleteAt) {
            const now = new Date();
            const deleteDate = new Date(c.autoDeleteAt);
            const diffTime = deleteDate - now;
            daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            // Ensure it's not negative
            if (daysRemaining < 0) daysRemaining = 0;
          }

          return {
            collectionId: c.collectionId,
            name: c.name,
            description: c.description,
            photographerId: c.photographerId,
            coverPhotoId: c.coverPhotoId,
            isActive: c.isActive,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
            autoDeleteAt: c.autoDeleteAt,
            daysRemaining,
            photoCount: photoCount[0]?.count || 0,
            thumbnailDataB64: firstPhoto[0]?.thumbnailDataB64 || null,
          };
        })
      );

      res.json({
        success: true,
        collections: collectionsWithCount,
      });
    } catch (error) {
      console.error("Get collections error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch collections",
        error: error.message,
      });
    } finally {
      this.dbInstance.closeConnection();
    }
  }

  /**
   * Get a single collection by ID
   */
  async getCollectionById(req, res) {
    const { collectionId } = req.params;
    const photographerId = req.user.photographerId || req.user.userId;

    const db = this.dbInstance.useDatabase(
      process.env.DB_NAME,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );

    try {
      const collections = await db.query(
        `SELECT collectionId, name, description, photographerId, coverPhotoId, 
                isActive, createdAt, updatedAt
         FROM PhotoCollection 
         WHERE collectionId = :collectionId AND photographerId = :photographerId AND isActive = true
         AND scheduledDeletionDate IS NULL`,
        {
          params: { collectionId, photographerId },
        }
      );

      if (collections.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Collection not found",
        });
      }

      res.json({
        success: true,
        collection: collections[0],
      });
    } catch (error) {
      console.error("Get collection error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch collection",
        error: error.message,
      });
    } finally {
      this.dbInstance.closeConnection();
    }
  }

  /**
   * Delete a collection (soft delete)
   */
  async deleteCollection(req, res) {
    const { collectionId } = req.params;
    const photographerId = req.user.photographerId || req.user.userId;

    const db = this.dbInstance.useDatabase(
      process.env.DB_NAME,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );

    try {
      // Verify ownership - just check if exists with UUID
      const collections = await db.query(
        `SELECT collectionId FROM PhotoCollection 
         WHERE collectionId = :collectionId AND photographerId = :photographerId`,
        {
          params: { collectionId, photographerId },
        }
      );

      if (collections.length === 0) {
        return res.status(404).json({
          success: false,
          message:
            "Collection not found or you don't have permission to delete it",
        });
      }

      // Get all photos in this collection - get their UUIDs
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
        `🗑️  Soft-deleting ${photosInCollection.length} photos from collection ${collectionId}`
      );

      // Soft delete each photo in the collection using UUIDs
      for (const photo of photosInCollection) {
        await this.softDeleteService.markForDeletion(
          "Photo",
          photo.photoId,
          `Deleted with collection: ${collectionId}`,
          "photoId"
        );
      }

      // Use soft delete service for the collection with UUID
      const result = await this.softDeleteService.markForDeletion(
        "PhotoCollection",
        collectionId,
        "Deleted by photographer",
        "collectionId"
      );

      res.json({
        success: true,
        message: `Collection and ${photosInCollection.length} photo(s) marked for deletion. They will be permanently deleted in 7 days.`,
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
    } finally {
      this.dbInstance.closeConnection();
    }
  }

  /**
   * Add photos to a collection
   */
  async addPhotosToCollection(req, res) {
    const { collectionId } = req.params;
    const { photoIds } = req.body; // Array of photo IDs (RIDs)
    const photographerId = req.user.photographerId || req.user.userId;

    const db = this.dbInstance.useDatabase(
      process.env.DB_NAME,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );

    try {
      // Verify collection ownership
      const collections = await db.query(
        `SELECT @rid FROM PhotoCollection 
         WHERE collectionId = :collectionId AND photographerId = :photographerId AND isActive = true`,
        {
          params: { collectionId, photographerId },
        }
      );

      if (collections.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Collection not found",
        });
      }

      const collectionRid = collections[0]["@rid"];

      // Add each photo to the collection
      for (let i = 0; i < photoIds.length; i++) {
        const photoId = photoIds[i];

        // Check if edge already exists
        const existing = await db.query(
          `SELECT FROM CollectionPhoto WHERE out = ${collectionRid} AND in = ${photoId}`
        );

        if (existing.length === 0) {
          await db.query(
            `CREATE EDGE CollectionPhoto FROM ${collectionRid} TO ${photoId} SET addedAt = sysdate(), orderIndex = ${i}`
          );
        }
      }

      res.json({
        success: true,
        message: `${photoIds.length} photo(s) added to collection`,
      });
    } catch (error) {
      console.error("Add photos to collection error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to add photos to collection",
        error: error.message,
      });
    } finally {
      this.dbInstance.closeConnection();
    }
  }

  /**
   * Get photos in a collection
   */
  async getCollectionPhotos(req, res) {
    const { collectionId } = req.params;
    const photographerId = req.user.photographerId || req.user.userId;

    const db = this.dbInstance.useDatabase(
      process.env.DB_NAME,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );

    try {
      // Verify collection ownership - just check it exists, don't use RID
      const collections = await db.query(
        `SELECT collectionId FROM PhotoCollection 
         WHERE collectionId = :collectionId AND photographerId = :photographerId AND isActive = true
         AND scheduledDeletionDate IS NULL`,
        {
          params: { collectionId, photographerId },
        }
      );

      if (collections.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Collection not found",
        });
      }

      // Get photos via CollectionPhoto edge using subquery - NO RIDS!
      const photos = await db.query(
        `SELECT expand(in) 
         FROM CollectionPhoto 
         WHERE out IN (SELECT FROM PhotoCollection WHERE collectionId = :collectionId)
         AND in.scheduledDeletionDate IS NULL
         ORDER BY orderIndex`,
        {
          params: { collectionId },
        }
      );

      res.json({
        success: true,
        photos: photos.map((p) => ({
          id: p.photoId || p["@rid"].toString(), // Use photoId (UUID), fallback to RID
          photoId: p.photoId, // Include photoId explicitly
          fileName: p.fileName,
          originalName: p.originalName,
          shareToken: p.shareToken,
          uploadedAt: p.uploadedAt,
          tags: p.tags,
          thumbnailDataB64: p.thumbnailDataB64,
          size: p.size,
        })),
      });
    } catch (error) {
      console.error("Get collection photos error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch collection photos",
        error: error.message,
      });
    } finally {
      this.dbInstance.closeConnection();
    }
  }

  /**
   * Share collection with a client
   */
  async shareCollection(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { collectionId } = req.params;
    const { clientUsername } = req.body; // Client username instead of RID
    const photographerId = req.user.photographerId || req.user.userId;

    console.log("=== Share Collection Debug ===");
    console.log("Collection ID:", collectionId);
    console.log("Client Username received:", clientUsername);
    console.log("Photographer ID:", photographerId);

    const db = this.dbInstance.useDatabase(
      process.env.DB_NAME,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );

    try {
      // Verify collection exists and belongs to photographer
      const collections = await db.query(
        `SELECT collectionId FROM PhotoCollection 
         WHERE collectionId = :collectionId AND photographerId = :photographerId AND isActive = true
         AND scheduledDeletionDate IS NULL`,
        {
          params: { collectionId, photographerId },
        }
      );

      if (collections.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Collection not found",
        });
      }

      // Verify client exists and belongs to this photographer
      const clients = await db.query(
        `SELECT username FROM Client WHERE username = :username AND photographerId = :photographerId AND isActive = true`,
        {
          params: { username: clientUsername, photographerId },
        }
      );

      if (clients.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Client not found or does not belong to you",
        });
      }

      // Check if already shared - using subqueries to avoid RIDs
      const existing = await db.query(
        `SELECT FROM CollectionAccess 
         WHERE out IN (SELECT FROM PhotoCollection WHERE collectionId = :collectionId)
         AND in IN (SELECT FROM Client WHERE username = :username)`,
        {
          params: { collectionId, username: clientUsername },
        }
      );

      if (existing.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Collection is already shared with this client",
        });
      }

      // Create CollectionAccess edge using subqueries - NO RIDS!
      await db.query(
        `CREATE EDGE CollectionAccess 
         FROM (SELECT FROM PhotoCollection WHERE collectionId = :collectionId LIMIT 1)
         TO (SELECT FROM Client WHERE username = :username LIMIT 1)
         SET accessType = 'view', grantedAt = sysdate()`,
        {
          params: { collectionId, username: clientUsername },
        }
      );

      // Get collection details for email notification
      const collectionDetails = await db.query(
        `SELECT name, description, autoDeleteAt FROM PhotoCollection WHERE collectionId = :collectionId`,
        { params: { collectionId } }
      );

      // Get photo count
      const photoCount = await db.query(
        `SELECT COUNT(*) as count FROM CollectionPhoto 
         WHERE out IN (SELECT FROM PhotoCollection WHERE collectionId = :collectionId)`,
        { params: { collectionId } }
      );

      // Get client email (encrypted) and decrypt it
      const clientData = await db.query(
        `SELECT encryptedEmail, clientName FROM Client WHERE username = :username`,
        { params: { username: clientUsername } }
      );

      // Get photographer info
      const photographerData = await db.query(
        `SELECT businessName, username FROM Photographer WHERE photographerId = :photographerId`,
        { params: { photographerId } }
      );

      // Calculate days remaining
      let daysRemaining = 14;
      if (collectionDetails[0]?.autoDeleteAt) {
        const now = new Date();
        const deleteDate = new Date(collectionDetails[0].autoDeleteAt);
        const diffTime = deleteDate - now;
        daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (daysRemaining < 0) daysRemaining = 0;
      }

      // Send email notification if we have the client's email
      if (clientData[0]?.encryptedEmail) {
        try {
          const decryptedEmail = this.encryption.decryptSimple(
            clientData[0].encryptedEmail
          );

          await this.emailService.sendCollectionSharedNotification(
            decryptedEmail,
            {
              name: collectionDetails[0]?.name || "Untitled Collection",
              description: collectionDetails[0]?.description || "",
              photoCount: photoCount[0]?.count || 0,
              daysRemaining: daysRemaining,
            },
            {
              businessName: photographerData[0]?.businessName,
              username: photographerData[0]?.username,
            }
          );

          console.log(
            `✅ Collection shared notification sent to client ${clientUsername}`
          );
        } catch (emailError) {
          console.error(
            "Failed to send collection shared notification:",
            emailError
          );
          // Don't fail the share operation if email fails
        }
      }

      res.json({
        success: true,
        message: "Collection shared with client successfully",
        emailSent: !!clientData[0]?.encryptedEmail,
      });
    } catch (error) {
      console.error("Share collection error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to share collection",
        error: error.message,
      });
    } finally {
      this.dbInstance.closeConnection();
    }
  }

  /**
   * Get collections shared with a client
   */
  async getClientCollections(req, res) {
    const clientUsername = req.user.username; // Client username from JWT

    const db = this.dbInstance.useDatabase(
      process.env.DB_NAME,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );

    try {
      // Get collections via CollectionAccess edge - using username, not RID!
      const collections = await db.query(
        `SELECT expand(out) 
         FROM CollectionAccess 
         WHERE in IN (SELECT FROM Client WHERE username = :username)`,
        {
          params: { username: clientUsername },
        }
      );

      res.json({
        success: true,
        collections: collections
          .filter((c) => c.isActive && !c.scheduledDeletionDate)
          .map((c) => ({
            collectionId: c.collectionId,
            name: c.name,
            description: c.description,
            coverPhotoId: c.coverPhotoId,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
          })),
      });
    } catch (error) {
      console.error("Get client collections error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch collections",
        error: error.message,
      });
    } finally {
      this.dbInstance.closeConnection();
    }
  }

  /**
   * Get photos in a collection (client view)
   */
  async getClientCollectionPhotos(req, res) {
    const { collectionId } = req.params;
    const clientUsername = req.user.username; // Client username from JWT

    const db = this.dbInstance.useDatabase(
      process.env.DB_NAME,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );

    try {
      // Verify collection exists
      const collections = await db.query(
        `SELECT collectionId FROM PhotoCollection 
         WHERE collectionId = :collectionId AND isActive = true
         AND scheduledDeletionDate IS NULL`,
        {
          params: { collectionId },
        }
      );

      if (collections.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Collection not found",
        });
      }

      // Verify client has access to this collection - using username, not RID!
      const access = await db.query(
        `SELECT FROM CollectionAccess 
         WHERE out IN (SELECT FROM PhotoCollection WHERE collectionId = :collectionId)
         AND in IN (SELECT FROM Client WHERE username = :username)`,
        {
          params: { collectionId, username: clientUsername },
        }
      );

      if (access.length === 0) {
        return res.status(403).json({
          success: false,
          message: "You don't have access to this collection",
        });
      }

      // Get photos using subquery - NO RIDS!
      const photos = await db.query(
        `SELECT expand(in) 
         FROM CollectionPhoto 
         WHERE out IN (SELECT FROM PhotoCollection WHERE collectionId = :collectionId)
         AND in.scheduledDeletionDate IS NULL
         ORDER BY orderIndex`,
        {
          params: { collectionId },
        }
      );

      res.json({
        success: true,
        photos: photos.map((p) => ({
          id: p["@rid"].toString(),
          fileName: p.fileName,
          shareToken: p.shareToken,
          uploadedAt: p.uploadedAt,
          tags: p.tags,
          thumbnailDataB64: p.thumbnailDataB64,
        })),
      });
    } catch (error) {
      console.error("Get client collection photos error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch collection photos",
        error: error.message,
      });
    } finally {
      this.dbInstance.closeConnection();
    }
  }
}

module.exports = PhotoCollectionService;
