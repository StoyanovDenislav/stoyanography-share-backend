const multer = require("multer");
const sharp = require("sharp");
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");
const Database = require("../Database/databaseClass");
const EncryptionService = require("./encryptionService");
const SoftDeleteService = require("./softDeleteService");
const { now, toOrientDBDateTime } = require("../utils/dateFormatter");

class EnhancedPhotoService {
  constructor() {
    this.dbInstance = new Database(
      process.env.DB_HOST,
      process.env.DB_PORT,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );
    this.encryption = new EncryptionService();
    this.softDeleteService = new SoftDeleteService();
    this.maxPhotoSize = parseInt(process.env.MAX_PHOTO_SIZE) || 52428800; // 50MB
    this.compressionQuality =
      parseFloat(process.env.PHOTO_COMPRESSION_QUALITY) || 0.8;
  }

  // Configure multer for memory storage (we'll process and store in DB)
  getMulterConfig() {
    const storage = multer.memoryStorage();

    const fileFilter = (req, file, cb) => {
      if (file.mimetype.startsWith("image/")) {
        cb(null, true);
      } else {
        cb(new Error("Only image files are allowed"), false);
      }
    };

    return multer({
      storage: storage,
      fileFilter: fileFilter,
      limits: {
        fileSize: this.maxPhotoSize,
      },
    });
  }

  async processImage(buffer, mimetype) {
    try {
      // Get image metadata
      const metadata = await sharp(buffer).metadata();

      // Create optimized version
      let processedBuffer = buffer;
      let thumbnailBuffer;

      // Compress image if it's too large or wrong format
      if (
        metadata.size > this.maxPhotoSize * 0.5 ||
        mimetype !== "image/jpeg"
      ) {
        processedBuffer = await sharp(buffer)
          .jpeg({ quality: Math.round(this.compressionQuality * 100) })
          .toBuffer();
      }

      // Create thumbnail (300x300 max, maintain aspect ratio)
      thumbnailBuffer = await sharp(buffer)
        .resize(300, 300, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 70 })
        .toBuffer();

      return {
        processedBuffer,
        thumbnailBuffer,
        metadata: {
          width: metadata.width,
          height: metadata.height,
          format: metadata.format,
          size: processedBuffer.length,
          originalSize: buffer.length,
        },
      };
    } catch (error) {
      throw new Error(`Image processing failed: ${error.message}`);
    }
  }

  async uploadPhoto(req, res) {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No photos uploaded",
        });
      }

      // Check user permissions (must be photographer)
      if (req.user.role !== "photographer" && req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Only photographers can upload photos",
        });
      }

      const db = this.dbInstance.useDatabase(
        process.env.DB_NAME,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD
      );

      // Extract collectionId and clientIds
      const collectionId = req.body.collectionId;
      const clientIdsJson = req.body.clientIds;
      let clientIds = [];

      // Collection is required
      if (!collectionId) {
        return res.status(400).json({
          success: false,
          message: "Collection is required when uploading photos",
        });
      }

      if (clientIdsJson) {
        try {
          clientIds = JSON.parse(clientIdsJson);
          if (!Array.isArray(clientIds)) {
            clientIds = [];
          }
        } catch (e) {
          console.error("Error parsing clientIds:", e);
          clientIds = [];
        }
      }

      console.log("📸 Upload request - collectionId:", collectionId);
      console.log("📸 Upload request - clientIds:", clientIds);
      console.log("📸 Upload request - body:", req.body);
      console.log("📸 Upload request - files count:", req.files?.length);

      const uploadedPhotos = [];
      const errors = [];

      // Process each file
      for (const file of req.files) {
        try {
          // Process image
          const { processedBuffer, thumbnailBuffer, metadata } =
            await this.processImage(file.buffer, file.mimetype);

          // Convert to base64
          const photoDataB64 = processedBuffer.toString("base64");
          const thumbnailDataB64 = thumbnailBuffer.toString("base64");

          // Encrypt photo data
          const encryptedPhotoData =
            this.encryption.encryptSimple(photoDataB64);
          const encryptedOriginalName = this.encryption.encryptSimple(
            file.originalname
          );

          // Generate unique identifiers
          const shareToken = crypto.randomBytes(32).toString("hex");
          const filename = crypto.randomBytes(16).toString("hex") + ".jpg";
          const photoId = uuidv4();

          // Extract tags from filename or request
          const tags = req.body.tags
            ? req.body.tags.split(",").map((tag) => tag.trim())
            : [];

          // Store photo in database
          const result = await db.query(
            `
            INSERT INTO Photo SET 
            photoId = :photoId,
            photographerId = :photographerId,
            filename = :filename,
            originalName = :originalName,
            encryptedOriginalName = :encryptedOriginalName,
            mimetype = :mimetype,
            size = :size,
            width = :width,
            height = :height,
            photoDataB64 = :photoDataB64,
            thumbnailDataB64 = :thumbnailDataB64,
            encryptedPhotoData = :encryptedPhotoData,
            shareToken = :shareToken,
            uploadedAt = :uploadedAt,
            isActive = true,
            tags = :tags,
            metadata = :metadata
          `,
            {
              params: {
                photoId: photoId,
                photographerId: req.user.photographerId || req.user.userId,
                filename: filename,
                originalName: file.originalname,
                encryptedOriginalName: encryptedOriginalName,
                mimetype: "image/jpeg",
                size: metadata.size,
                width: metadata.width,
                height: metadata.height,
                photoDataB64: photoDataB64,
                thumbnailDataB64: thumbnailDataB64,
                encryptedPhotoData: encryptedPhotoData,
                shareToken: shareToken,
                uploadedAt: now(),
                tags: tags,
                metadata: {
                  originalSize: metadata.originalSize,
                  compressionRatio: metadata.originalSize / metadata.size,
                  format: metadata.format,
                },
              },
            }
          );

          // Query for the photoId (UUID) using the unique shareToken
          // INSERT returns invalid temporary RID, so we need to query for it
          const photoQuery = await db.query(
            `SELECT @rid, photoId FROM Photo WHERE shareToken = :shareToken`,
            {
              params: {
                shareToken: shareToken,
              },
            }
          );

          const photoRid =
            photoQuery && photoQuery.length > 0 ? photoQuery[0]["@rid"] : null;
          const photoIdResult =
            photoQuery && photoQuery.length > 0
              ? photoQuery[0].photoId
              : photoId;
          console.log(
            `📸 Photo created - photoId: ${photoIdResult}, shareToken: ${shareToken}`
          );

          // Link photo to collection (required)
          console.log(
            `🔗 Linking photo (token: ${shareToken}) to collection ${collectionId}`
          );
          try {
            // Create edge using subqueries to avoid RID issues
            // Use the unique shareToken and collectionId to find the actual records
            const edgeResult = await db.query(
              `CREATE EDGE CollectionPhoto 
               FROM (SELECT FROM PhotoCollection WHERE collectionId = :collectionId AND isActive = true LIMIT 1) 
               TO (SELECT FROM Photo WHERE shareToken = :shareToken AND isActive = true LIMIT 1) 
               SET createdAt = sysdate()`,
              {
                params: {
                  collectionId: collectionId,
                  shareToken: shareToken,
                },
              }
            );
            console.log(
              `✅ Successfully linked photo to collection`,
              edgeResult
            );
          } catch (linkError) {
            console.error(`❌ Error linking photo to collection:`, linkError);
            // This is a critical error since collection is required
            throw new Error(
              `Failed to add photo to collection: ${linkError.message}`
            );
          }

          uploadedPhotos.push({
            id: photoIdResult, // Use photoId (UUID) instead of RID
            photoId: photoIdResult,
            filename: filename,
            originalName: file.originalname,
            size: metadata.size,
            width: metadata.width,
            height: metadata.height,
            shareToken: shareToken,
            uploadedAt: now(),
            tags: tags,
          });
        } catch (error) {
          console.error(`Error processing file ${file.originalname}:`, error);
          errors.push({
            filename: file.originalname,
            error: error.message,
          });
        }
      }

      // Update collection's autoDeleteAt to start countdown with custom expiry
      if (collectionId && uploadedPhotos.length > 0) {
        try {
          // Get expiry duration from request (in minutes, default to 30 seconds for testing)
          const expiryMinutes = parseInt(req.body.expiryMinutes) || 0;

          const autoDeleteDate = new Date();

          if (expiryMinutes > 0) {
            // Custom expiry in minutes
            autoDeleteDate.setMinutes(
              autoDeleteDate.getMinutes() + expiryMinutes
            );
            console.log(
              `⏱️ Setting collection expiry to ${expiryMinutes} minutes`
            );
          } else {
            // Default: 30 seconds for testing
            autoDeleteDate.setSeconds(autoDeleteDate.getSeconds() + 30);
            console.log(`⏱️ Setting collection expiry to 30 seconds (default)`);
          }

          await db.query(
            `UPDATE PhotoCollection 
             SET autoDeleteAt = :autoDeleteAt, updatedAt = sysdate()
             WHERE collectionId = :collectionId`,
            {
              params: {
                collectionId: collectionId,
                autoDeleteAt: toOrientDBDateTime(autoDeleteDate),
              },
            }
          );
          console.log(
            `⏱️ Set collection autoDeleteAt to ${autoDeleteDate.toISOString()}`
          );
        } catch (error) {
          console.error("Error setting collection autoDeleteAt:", error);
          // Don't fail the upload if this fails
        }
      }

      res.status(201).json({
        success: true,
        message: `Successfully uploaded ${uploadedPhotos.length} photo(s)`,
        photos: uploadedPhotos,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error) {
      console.error("Photo upload error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to upload photos",
      });
    } finally {
      this.dbInstance.closeConnection();
    }
  }

  async getPhotoById(req, res) {
    try {
      const { photoId } = req.params;

      const db = this.dbInstance.useDatabase(
        process.env.DB_NAME,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD
      );

      // Get the photo using either photoId (UUID) or shareToken
      const photos = await db.query(
        `
        SELECT @rid as id, photoId, filename, originalName, size, width, height, 
               photoDataB64, photographerId, shareToken, createdAt
        FROM Photo 
        WHERE (photoId = :photoId OR shareToken = :photoId) 
        AND isActive = true
        AND scheduledDeletionDate IS NULL
      `,
        {
          params: {
            photoId: photoId,
          },
        }
      );

      if (photos.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Photo not found",
        });
      }

      const photo = photos[0];

      // Check if user has permission to view this photo
      const photographerId = req.user.photographerId || req.user.userId;

      if (photo.photographerId !== photographerId) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      // Return photo with full-size image
      res.json({
        success: true,
        photo: {
          id: photo.id,
          photoId: photo.photoId,
          filename: photo.filename,
          originalName: photo.originalName,
          size: photo.size,
          width: photo.width,
          height: photo.height,
          shareToken: photo.shareToken,
          createdAt: photo.createdAt,
          photoData: photo.photoDataB64, // Already base64
        },
      });
    } catch (error) {
      console.error("Get photo by ID error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve photo",
      });
    } finally {
      this.dbInstance.closeConnection();
    }
  }

  async getPhotographerPhotos(req, res) {
    try {
      const { page = 1, limit = 20, tags } = req.query;
      const offset = (page - 1) * limit;

      const db = this.dbInstance.useDatabase(
        process.env.DB_NAME,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD
      );

      let query = `
        SELECT @rid as id, photoId, filename, originalName, size, width, height, shareToken, 
               uploadedAt, tags, thumbnailDataB64
        FROM Photo 
        WHERE photographerId = :photographerId AND isActive = true
        AND scheduledDeletionDate IS NULL
      `;

      const params = {
        photographerId: req.user.photographerId || req.user.userId,
      };

      if (tags) {
        query += ` AND tags CONTAINSALL :tags`;
        params.tags = tags.split(",").map((tag) => tag.trim());
      }

      query += ` ORDER BY uploadedAt DESC SKIP :offset LIMIT :limit`;
      params.offset = offset;
      params.limit = parseInt(limit);

      const photos = await db.query(query, { params });

      // For each photo, check if it's in a collection - USE SHARETOKEN NOT RID!
      const photosWithCollections = await Promise.all(
        photos.map(async (photo) => {
          try {
            const collectionEdges = await db.query(
              `SELECT out.collectionId as collectionId 
               FROM CollectionPhoto 
               WHERE in IN (SELECT FROM Photo WHERE shareToken = :shareToken)`,
              {
                params: { shareToken: photo.shareToken },
              }
            );

            return {
              id: photo.photoId, // Use photoId (UUID) instead of RID
              photoId: photo.photoId,
              filename: photo.filename,
              originalName: photo.originalName,
              size: photo.size,
              width: photo.width,
              height: photo.height,
              shareToken: photo.shareToken,
              uploadedAt: photo.uploadedAt,
              tags: photo.tags || [],
              thumbnailDataB64: photo.thumbnailDataB64,
              collectionId:
                collectionEdges.length > 0
                  ? collectionEdges[0].collectionId
                  : null,
            };
          } catch (err) {
            console.error("Error checking collection for photo:", err);
            return {
              id: photo.photoId, // Use photoId (UUID)
              photoId: photo.photoId,
              filename: photo.filename,
              originalName: photo.originalName,
              size: photo.size,
              width: photo.width,
              height: photo.height,
              shareToken: photo.shareToken,
              uploadedAt: photo.uploadedAt,
              tags: photo.tags || [],
              thumbnailDataB64: photo.thumbnailDataB64,
              collectionId: null,
            };
          }
        })
      );

      res.json({
        success: true,
        photos: photosWithCollections,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: photosWithCollections.length,
        },
      });
    } catch (error) {
      console.error("Get photographer photos error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve photos",
      });
    } finally {
      this.dbInstance.closeConnection();
    }
  }

  async getClientPhotos(req, res) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      const db = this.dbInstance.useDatabase(
        process.env.DB_NAME,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD
      );

      // Get photos accessible to this client through PhotoAccess - use photoId (UUID)
      const accessiblePhotos = await db.query(
        `
        SELECT p.@rid as id, p.photoId, p.filename, p.originalName, p.size, p.width, p.height, 
               p.shareToken, p.uploadedAt, p.tags, p.thumbnailDataB64
        FROM Photo p, PhotoAccess pa
        WHERE p.photoId = pa.photoId 
        AND pa.userId = :clientId 
        AND pa.userType = 'client'
        AND pa.isActive = true 
        AND p.isActive = true
        AND p.scheduledDeletionDate IS NULL
        ORDER BY p.uploadedAt DESC
        SKIP :offset LIMIT :limit
      `,
        {
          params: {
            clientId: req.user.clientId || req.user.userId,
            offset: offset,
            limit: parseInt(limit),
          },
        }
      );

      const photosWithThumbnails = accessiblePhotos.map((photo) => ({
        id: photo.id,
        filename: photo.filename,
        originalName: photo.originalName,
        size: photo.size,
        width: photo.width,
        height: photo.height,
        shareToken: photo.shareToken,
        uploadedAt: photo.uploadedAt,
        tags: photo.tags || [],
        thumbnail: `data:image/jpeg;base64,${photo.thumbnailDataB64}`,
      }));

      res.json({
        success: true,
        photos: photosWithThumbnails,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: accessiblePhotos.length,
        },
      });
    } catch (error) {
      console.error("Get client photos error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve photos",
      });
    } finally {
      this.dbInstance.closeConnection();
    }
  }

  async getPhoto(req, res) {
    try {
      const { photoId } = req.params;
      const { thumbnail = false } = req.query;

      const db = this.dbInstance.useDatabase(
        process.env.DB_NAME,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD
      );

      // Check access permissions
      let hasAccess = false;
      let photo;

      if (req.user.role === "admin") {
        hasAccess = true;
      } else if (req.user.role === "photographer") {
        // Photographer can access their own photos - use photoId (UUID)
        const photos = await db.query(
          `
          SELECT photoDataB64, thumbnailDataB64, mimetype, originalName 
          FROM Photo 
          WHERE photoId = :photoId AND photographerId = :photographerId AND isActive = true
          AND scheduledDeletionDate IS NULL
        `,
          {
            params: {
              photoId: photoId,
              photographerId: req.user.photographerId || req.user.userId,
            },
          }
        );
        hasAccess = photos.length > 0;
        photo = photos[0];
      } else {
        // Check PhotoAccess for clients/guests - use photoId (UUID)
        const accessCheck = await db.query(
          `
          SELECT p.photoDataB64, p.thumbnailDataB64, p.mimetype, p.originalName
          FROM Photo p, PhotoAccess pa
          WHERE p.photoId = :photoId 
          AND pa.photoId = :photoId 
          AND pa.userId = :userId 
          AND pa.isActive = true 
          AND p.isActive = true
          AND p.scheduledDeletionDate IS NULL
        `,
          {
            params: {
              photoId: photoId,
              userId: req.user.clientId || req.user.guestId || req.user.userId,
            },
          }
        );
        hasAccess = accessCheck.length > 0;
        photo = accessCheck[0];
      }

      if (!hasAccess || !photo) {
        return res.status(404).json({
          success: false,
          message: "Photo not found or access denied",
        });
      }

      // Return appropriate image data
      const imageData = thumbnail ? photo.thumbnailDataB64 : photo.photoDataB64;
      const buffer = Buffer.from(imageData, "base64");

      res.setHeader("Content-Type", photo.mimetype || "image/jpeg");
      res.setHeader("Content-Length", buffer.length);
      res.setHeader("Cache-Control", "public, max-age=86400"); // Cache for 1 day
      res.send(buffer);
    } catch (error) {
      console.error("Get photo error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve photo",
      });
    } finally {
      this.dbInstance.closeConnection();
    }
  }

  async sharePhotoViaToken(req, res) {
    try {
      const { shareToken } = req.params;

      const db = this.dbInstance.useDatabase(
        process.env.DB_NAME,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD
      );

      const photos = await db.query(
        `
        SELECT photoDataB64, thumbnailDataB64, mimetype, originalName 
        FROM Photo 
        WHERE shareToken = :shareToken AND isActive = true
      `,
        {
          params: { shareToken },
        }
      );

      if (photos.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Photo not found or no longer available",
        });
      }

      const photo = photos[0];
      const imageData = photo.photoDataB64;
      const buffer = Buffer.from(imageData, "base64");

      res.setHeader("Content-Type", photo.mimetype || "image/jpeg");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${photo.originalName}"`
      );
      res.setHeader("Cache-Control", "public, max-age=3600"); // Cache for 1 hour
      res.send(buffer);
    } catch (error) {
      console.error("Share photo error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to share photo",
      });
    } finally {
      this.dbInstance.closeConnection();
    }
  }

  async deletePhoto(req, res) {
    try {
      const { photoId } = req.params;

      const db = this.dbInstance.useDatabase(
        process.env.DB_NAME,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD
      );

      // Check ownership (photographer or admin only)
      let canDelete = false;

      if (req.user.role === "admin") {
        // Admin can delete any photo - verify it exists by UUID
        const photos = await db.query(
          `SELECT photoId FROM Photo WHERE photoId = :photoId`,
          {
            params: { photoId: photoId },
          }
        );
        canDelete = photos.length > 0;
      } else if (req.user.role === "photographer") {
        // Photographer can only delete their own photos - use photoId
        const photos = await db.query(
          `SELECT photoId FROM Photo 
           WHERE photoId = :photoId AND photographerId = :photographerId`,
          {
            params: {
              photoId: photoId,
              photographerId: req.user.photographerId || req.user.userId,
            },
          }
        );
        canDelete = photos.length > 0;
      }

      if (!canDelete) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to delete this photo",
        });
      }

      console.log(`🗑️  Deleting photo with UUID: ${photoId}`);

      // Use soft delete service with UUID - NO MORE RIDS!
      const result = await this.softDeleteService.markForDeletion(
        "Photo",
        photoId,
        req.user.role === "photographer"
          ? "Deleted by photographer"
          : "Deleted by admin",
        "photoId" // Specify the UUID field name
      );

      res.json({
        success: true,
        message:
          "Photo marked for deletion. It will be permanently deleted in 7 days.",
        scheduledDeletionDate: result.scheduledDeletionDate,
      });
    } catch (error) {
      console.error("Delete photo error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete photo",
      });
    } finally {
      this.dbInstance.closeConnection();
    }
  }
}

module.exports = EnhancedPhotoService;
