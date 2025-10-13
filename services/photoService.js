const multer = require("multer");
const path = require("path");
const fs = require("fs").promises;
const crypto = require("crypto");
const Database = require("../Database/databaseClass");
const EncryptionService = require("./encryptionService");
const SoftDeleteService = require("./softDeleteService");

class PhotoService {
  constructor() {
    this.dbInstance = new Database(
      process.env.DB_HOST,
      process.env.DB_PORT,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );
    this.encryption = new EncryptionService();
    this.softDeleteService = new SoftDeleteService();
    this.uploadPath = path.join(__dirname, "../uploads");
    this.ensureUploadDirectory();
  }

  async ensureUploadDirectory() {
    try {
      await fs.access(this.uploadPath);
    } catch {
      await fs.mkdir(this.uploadPath, { recursive: true });
    }
  }

  // Configure multer for file uploads
  getMulterConfig() {
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, this.uploadPath);
      },
      filename: (req, file, cb) => {
        // Generate unique filename
        const uniqueName =
          crypto.randomBytes(16).toString("hex") +
          path.extname(file.originalname);
        cb(null, uniqueName);
      },
    });

    const fileFilter = (req, file, cb) => {
      // Allow only image files
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
        fileSize: 10 * 1024 * 1024, // 10MB limit
      },
    });
  }

  async uploadPhoto(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No file uploaded",
        });
      }

      const db = this.dbInstance.useDatabase(
        process.env.DB_NAME,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD
      );

      // Encrypt file metadata
      const encryptedOriginalName = this.encryption.encryptSimple(
        req.file.originalname
      );
      const encryptedMimetype = this.encryption.encryptSimple(
        req.file.mimetype
      );

      // Generate share link
      const shareToken = crypto.randomBytes(32).toString("hex");

      // Store photo metadata in database
      const result = await db.query(
        "INSERT INTO Photo SET clientId = :clientId, filename = :filename, originalName = :originalName, mimetype = :mimetype, size = :size, shareToken = :shareToken, uploadedAt = :uploadedAt, isActive = :isActive",
        {
          params: {
            clientId: req.user.clientId,
            filename: req.file.filename,
            originalName: encryptedOriginalName,
            mimetype: encryptedMimetype,
            size: req.file.size,
            shareToken: shareToken,
            uploadedAt: new Date().toISOString(),
            isActive: true,
          },
        }
      );

      res.status(201).json({
        success: true,
        message: "Photo uploaded successfully",
        photo: {
          id: result[0]["@rid"],
          filename: req.file.filename,
          originalName: req.file.originalname,
          size: req.file.size,
          shareToken: shareToken,
          shareUrl: `${req.protocol}://${req.get(
            "host"
          )}/api/photos/share/${shareToken}`,
          uploadedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("Photo upload error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to upload photo",
      });
    } finally {
      this.dbInstance.closeConnection();
    }
  }

  async getClientPhotos(req, res) {
    try {
      const db = this.dbInstance.useDatabase(
        process.env.DB_NAME,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD
      );

      const photos = await db.query(
        "SELECT @rid as id, filename, originalName, size, shareToken, uploadedAt, isActive FROM Photo WHERE clientId = :clientId AND isActive = true ORDER BY uploadedAt DESC",
        {
          params: {
            clientId: req.user.clientId,
          },
        }
      );

      // Decrypt original names
      const decryptedPhotos = photos.map((photo) => ({
        id: photo.id,
        filename: photo.filename,
        originalName: this.encryption.decryptSimple(photo.originalName),
        size: photo.size,
        shareToken: photo.shareToken,
        shareUrl: `${req.protocol}://${req.get("host")}/api/photos/share/${
          photo.shareToken
        }`,
        uploadedAt: photo.uploadedAt,
      }));

      res.json({
        success: true,
        photos: decryptedPhotos,
      });
    } catch (error) {
      console.error("Get photos error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve photos",
      });
    } finally {
      this.dbInstance.closeConnection();
    }
  }

  async sharePhoto(req, res) {
    try {
      const { shareToken } = req.params;

      const db = this.dbInstance.useDatabase(
        process.env.DB_NAME,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD
      );

      const photos = await db.query(
        "SELECT filename, originalName, mimetype FROM Photo WHERE shareToken = :shareToken AND isActive = true",
        {
          params: {
            shareToken: shareToken,
          },
        }
      );

      if (photos.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Photo not found or no longer available",
        });
      }

      const photo = photos[0];
      const filePath = path.join(this.uploadPath, photo.filename);

      // Check if file exists
      try {
        await fs.access(filePath);
      } catch {
        return res.status(404).json({
          success: false,
          message: "Photo file not found",
        });
      }

      // Decrypt metadata
      const originalName = this.encryption.decryptSimple(photo.originalName);
      const mimetype = this.encryption.decryptSimple(photo.mimetype);

      // Set appropriate headers
      res.setHeader("Content-Type", mimetype || "image/jpeg");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${originalName}"`
      );

      // Send file
      res.sendFile(filePath);
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

      // Check if photo belongs to client
      const photos = await db.query(
        "SELECT filename FROM Photo WHERE @rid = :photoId AND clientId = :clientId",
        {
          params: {
            photoId: photoId,
            clientId: req.user.clientId,
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

      // Use soft delete service
      const result = await this.softDeleteService.markForDeletion(
        "Photo",
        photoId,
        "Deleted by client"
      );

      // Note: Physical file will be deleted during cleanup after 7 days
      // This preserves data during the grace period

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

module.exports = PhotoService;
