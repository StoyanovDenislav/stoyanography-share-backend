const bcrypt = require("bcrypt");
const { body, validationResult } = require("express-validator");
const Database = require("../Database/databaseClass");
const { generateToken, setTokenCookie } = require("../middleware/auth");
const EncryptionService = require("./encryptionService");

class GuestService {
  constructor() {
    this.dbInstance = new Database(
      process.env.DB_HOST,
      process.env.DB_PORT,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );
    this.encryption = new EncryptionService();
  }

  // Validation for guest login
  static getLoginValidation() {
    return [
      body("username").notEmpty().withMessage("Username is required"),
      body("password").notEmpty().withMessage("Password is required"),
    ];
  }

  async authenticateGuest(username, password) {
    const db = this.dbInstance.useDatabase(
      process.env.DB_NAME,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );

    try {
      // Find guest by username
      // Format current date for OrientDB comparison
      const now = new Date().toISOString().replace("T", " ").substring(0, 19);
      console.log("🔍 Guest authentication attempt:", {
        username,
        currentTime: now,
      });

      const guests = await db.query(
        "SELECT FROM Guest WHERE username = :username AND isActive = true AND expiresAt > date(:now, 'yyyy-MM-dd HH:mm:ss')",
        {
          params: {
            username,
            now: now,
          },
        }
      );

      console.log("📊 Guest query results:", {
        found: guests.length,
        guestData:
          guests.length > 0
            ? {
                username: guests[0].username,
                expiresAt: guests[0].expiresAt,
                isActive: guests[0].isActive,
              }
            : "No guest found",
      });

      if (guests.length === 0) {
        throw new Error("Invalid credentials or access expired");
      }

      const guest = guests[0];

      // Verify password
      const isValidPassword = await bcrypt.compare(password, guest.password);

      if (!isValidPassword) {
        throw new Error("Invalid credentials");
      }

      // Update last login
      await db.query(
        "UPDATE Guest SET lastLogin = :lastLogin WHERE @rid = :rid",
        {
          params: {
            lastLogin: new Date().toISOString(),
            rid: guest["@rid"],
          },
        }
      );

      // Decrypt email for response
      const decryptedEmail = this.encryption.decryptSimple(
        guest.encryptedEmail
      );

      // Return guest without password
      return {
        id: guest["@rid"],
        username: guest.username,
        email: decryptedEmail || guest.email,
        guestName: guest.guestName,
        clientId: guest.clientId,
        createdAt: guest.createdAt,
        expiresAt: guest.expiresAt,
        lastLogin: new Date().toISOString(),
        role: "guest",
      };
    } catch (error) {
      throw error;
    } finally {
      this.dbInstance.closeConnection();
    }
  }

  async login(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const { username, password } = req.body;

      // Authenticate guest
      const guest = await this.authenticateGuest(username, password);

      // Generate JWT token
      const token = generateToken({
        userId: guest.id,
        guestId: guest.id,
        username: guest.username,
        email: guest.email,
        role: guest.role,
        clientId: guest.clientId,
        expiresAt: guest.expiresAt,
      });

      // Set token in HTTP-only cookie
      setTokenCookie(res, token);

      res.json({
        success: true,
        message: "Guest login successful",
        guest: {
          id: guest.id,
          username: guest.username,
          email: guest.email,
          guestName: guest.guestName,
          expiresAt: guest.expiresAt,
          lastLogin: guest.lastLogin,
        },
      });
    } catch (error) {
      console.error("Guest login error:", error);
      res.status(401).json({
        success: false,
        message: error.message || "Login failed",
      });
    }
  }

  async getAccessiblePhotos(req, res) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;
      const guestId = req.user.guestId || req.user.userId;

      const db = this.dbInstance.useDatabase(
        process.env.DB_NAME,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD
      );

      // Check if guest access is still valid
      const guest = await db.query(
        "SELECT expiresAt FROM Guest WHERE @rid = :guestId AND isActive = true",
        { params: { guestId } }
      );

      if (guest.length === 0 || new Date(guest[0].expiresAt) < new Date()) {
        return res.status(403).json({
          success: false,
          message: "Guest access has expired",
        });
      }

      // Get photos accessible to this guest
      const guestAccess = await db.query(
        `
        SELECT ga.photoIds, ga.accessCount, ga.maxAccessCount
        FROM GuestAccess ga
        WHERE ga.guestId = :guestId 
        AND ga.isActive = true 
        AND ga.expiresAt > :now
      `,
        {
          params: {
            guestId: guestId,
            now: new Date().toISOString(),
          },
        }
      );

      if (guestAccess.length === 0) {
        return res.json({
          success: true,
          photos: [],
          message: "No photos available or access expired",
        });
      }

      const access = guestAccess[0];

      // Check access count limits
      if (
        access.maxAccessCount &&
        access.accessCount >= access.maxAccessCount
      ) {
        return res.status(403).json({
          success: false,
          message: "Maximum access count reached",
        });
      }

      if (!access.photoIds || access.photoIds.length === 0) {
        return res.json({
          success: true,
          photos: [],
          message: "No photos shared with you",
        });
      }

      // Get photo details
      const photos = await db.query(
        `
        SELECT @rid as id, filename, originalName, size, width, height, 
               shareToken, uploadedAt, tags, thumbnailDataB64
        FROM Photo 
        WHERE @rid IN :photoIds AND isActive = true
        ORDER BY uploadedAt DESC
        SKIP :offset LIMIT :limit
      `,
        {
          params: {
            photoIds: access.photoIds,
            offset: offset,
            limit: parseInt(limit),
          },
        }
      );

      // Increment access count
      await db.query(
        `
        UPDATE GuestAccess SET accessCount = accessCount + 1 
        WHERE guestId = :guestId AND isActive = true
      `,
        {
          params: { guestId },
        }
      );

      const photosWithThumbnails = photos.map((photo) => ({
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
        accessInfo: {
          accessCount: access.accessCount + 1,
          maxAccessCount: access.maxAccessCount,
          remaining: access.maxAccessCount
            ? access.maxAccessCount - (access.accessCount + 1)
            : "unlimited",
        },
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: photos.length,
        },
      });
    } catch (error) {
      console.error("Get guest photos error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve photos",
      });
    } finally {
      this.dbInstance.closeConnection();
    }
  }

  async getProfile(req, res) {
    try {
      const guestId = req.user.guestId || req.user.userId;
      const db = this.dbInstance.useDatabase(
        process.env.DB_NAME,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD
      );

      const guests = await db.query(
        `
        SELECT g.username, g.email, g.guestName, g.createdAt, g.lastLogin, g.expiresAt,
               ga.sharedAt, ga.accessCount, ga.maxAccessCount
        FROM Guest g, GuestAccess ga
        WHERE g.@rid = :guestId 
        AND ga.guestId = :guestId 
        AND g.isActive = true 
        AND ga.isActive = true
      `,
        {
          params: { guestId },
        }
      );

      if (guests.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Guest not found or access expired",
        });
      }

      const guest = guests[0];
      const decryptedEmail = this.encryption.decryptSimple(guest.email);

      res.json({
        success: true,
        guest: {
          username: guest.username,
          email: decryptedEmail || guest.email,
          guestName: guest.guestName,
          createdAt: guest.createdAt,
          lastLogin: guest.lastLogin,
          expiresAt: guest.expiresAt,
          sharedAt: guest.sharedAt,
          accessCount: guest.accessCount,
          maxAccessCount: guest.maxAccessCount,
          isExpired: new Date(guest.expiresAt) < new Date(),
        },
      });
    } catch (error) {
      console.error("Guest profile fetch error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch profile",
      });
    } finally {
      this.dbInstance.closeConnection();
    }
  }
}

module.exports = GuestService;
