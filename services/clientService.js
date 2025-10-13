const bcrypt = require("bcrypt");
const { body, validationResult } = require("express-validator");
const Database = require("../Database/databaseClass");
const { generateToken, setTokenCookie } = require("../middleware/auth");
const EncryptionService = require("./encryptionService");
const EmailService = require("./emailService");
const UserCredentials = require("../UserManagement/generateUserCredentials");

class ClientService {
  constructor() {
    this.dbInstance = new Database(
      process.env.DB_HOST,
      process.env.DB_PORT,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );
    this.encryption = new EncryptionService();
    this.emailService = new EmailService();
    this.userCredentials = new UserCredentials();
  }

  // Validation for guest creation
  static getGuestValidation() {
    return [
      body("email")
        .isEmail()
        .withMessage("Please provide a valid email address")
        .normalizeEmail(),
      body("guestName")
        .isLength({ min: 2, max: 100 })
        .withMessage("Guest name must be between 2 and 100 characters"),
      body("photoIds")
        .isArray({ min: 1 })
        .withMessage("At least one photo must be selected"),
      body("expirationDays")
        .optional()
        .isInt({ min: 1, max: 30 })
        .withMessage("Expiration must be between 1 and 30 days"),
    ];
  }

  async authenticateClient(username, password) {
    const db = this.dbInstance.useDatabase(
      process.env.DB_NAME,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );

    try {
      // Find client by username
      const clients = await db.query(
        "SELECT FROM Client WHERE username = :username AND isActive = true",
        { params: { username } }
      );

      if (clients.length === 0) {
        throw new Error("Invalid credentials");
      }

      const client = clients[0];

      // Verify password
      const isValidPassword = await bcrypt.compare(password, client.password);

      if (!isValidPassword) {
        throw new Error("Invalid credentials");
      }

      // Update last login
      await db.query(
        "UPDATE Client SET lastLogin = :lastLogin WHERE @rid = :rid",
        {
          params: {
            lastLogin: new Date().toISOString(),
            rid: client["@rid"],
          },
        }
      );

      // Return client without password and without email for privacy
      return {
        id: client["@rid"],
        username: client.username,
        clientName: client.clientName,
        photographerId: client.photographerId,
        createdAt: client.createdAt,
        lastLogin: new Date().toISOString(),
        role: "client",
      };
    } catch (error) {
      throw error;
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

      // Authenticate client
      const client = await this.authenticateClient(username, password);

      // Generate JWT token
      const token = generateToken({
        userId: client.id,
        clientId: client.id,
        username: client.username,
        email: client.email,
        role: client.role,
        photographerId: client.photographerId,
      });

      // Set token in HTTP-only cookie
      setTokenCookie(res, token);

      res.json({
        success: true,
        message: "Login successful",
        client: {
          id: client.id,
          username: client.username,
          email: client.email,
          clientName: client.clientName,
          lastLogin: client.lastLogin,
        },
      });
    } catch (error) {
      console.error("Client login error:", error);
      res.status(401).json({
        success: false,
        message: error.message || "Login failed",
      });
    }
  }

  async getAccessiblePhotos(req, res) {
    try {
      const { page = 1, limit = 100 } = req.query;
      const offset = (page - 1) * limit;
      const clientUsername = req.user.username;

      const db = this.dbInstance.useDatabase(
        process.env.DB_NAME,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD
      );

      // Get photos accessible to this client via CollectionAccess edges
      const accessiblePhotos = await db.query(
        `SELECT 
          @rid as id,
          filename,
          originalName,
          shareToken,
          size,
          width,
          height,
          uploadedAt,
          tags,
          thumbnailDataB64
         FROM Photo
         WHERE isActive = true
         AND @rid IN (
           SELECT out.@rid FROM CollectionPhoto
           WHERE in IN (
             SELECT out FROM CollectionAccess
             WHERE in IN (SELECT FROM Client WHERE username = :clientUsername)
           )
         )
         ORDER BY uploadedAt DESC
         SKIP :offset LIMIT :limit`,
        {
          params: {
            clientUsername,
            offset: offset,
            limit: parseInt(limit),
          },
        }
      );

      const photosWithThumbnails = accessiblePhotos.map((photo) => ({
        id: photo.id,
        filename: photo.filename,
        originalName: photo.originalName,
        shareToken: photo.shareToken,
        size: photo.size,
        width: photo.width,
        height: photo.height,
        uploadedAt: photo.uploadedAt,
        tags: photo.tags || [],
        thumbnailDataB64: photo.thumbnailDataB64,
        selected: false,
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
      console.error("Get accessible photos error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve photos",
        error: error.message,
      });
    }
  }

  async getCollections(req, res) {
    try {
      const clientUsername = req.user.username;

      const db = this.dbInstance.useDatabase(
        process.env.DB_NAME,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD
      );

      // Get all collections the client has access to via CollectionAccess edges
      const collections = await db.query(
        `SELECT 
          collectionId,
          name,
          description,
          createdAt,
          updatedAt,
          autoDeleteAt
         FROM PhotoCollection
         WHERE @rid IN (
           SELECT out FROM CollectionAccess 
           WHERE in IN (SELECT FROM Client WHERE username = :clientUsername)
         )
         AND isActive = true
         ORDER BY createdAt DESC`,
        {
          params: { clientUsername },
        }
      );

      // Get photo count and first thumbnail for each collection
      const collectionsWithDetails = await Promise.all(
        collections.map(async (c) => {
          // Count photos
          const photoCount = await db.query(
            `SELECT COUNT(*) as count 
             FROM CollectionPhoto 
             WHERE out IN (SELECT FROM PhotoCollection WHERE collectionId = :collectionId)`,
            {
              params: { collectionId: c.collectionId },
            }
          );

          // Get first photo's thumbnail
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
          const now = new Date();
          const deleteDate = new Date(c.autoDeleteAt);
          const daysRemaining = Math.max(0, Math.ceil((deleteDate - now) / (1000 * 60 * 60 * 24)));

          return {
            collectionId: c.collectionId,
            name: c.name,
            description: c.description,
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
        collections: collectionsWithDetails,
      });
    } catch (error) {
      console.error("Get collections error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve collections",
        error: error.message,
      });
    }
  }

  async getCollectionPhotos(req, res) {
    try {
      const { collectionId } = req.params;
      const clientUsername = req.user.username;

      const db = this.dbInstance.useDatabase(
        process.env.DB_NAME,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD
      );

      // Verify client has access to this collection
      const accessCheck = await db.query(
        `SELECT COUNT(*) as count 
         FROM CollectionAccess 
         WHERE out IN (SELECT FROM PhotoCollection WHERE collectionId = :collectionId)
         AND in IN (SELECT FROM Client WHERE username = :clientUsername)`,
        {
          params: { collectionId, clientUsername },
        }
      );

      if (accessCheck.length === 0 || accessCheck[0].count === 0) {
        return res.status(403).json({
          success: false,
          message: "You don't have access to this collection",
        });
      }

      // Get all photos in this collection
      const photos = await db.query(
        `SELECT 
          @rid as id,
          filename,
          originalName,
          shareToken,
          size,
          width,
          height,
          uploadedAt,
          tags,
          thumbnailDataB64
         FROM Photo
         WHERE @rid IN (
           SELECT in FROM CollectionPhoto 
           WHERE out IN (SELECT FROM PhotoCollection WHERE collectionId = :collectionId)
         )
         AND isActive = true
         ORDER BY uploadedAt DESC`,
        {
          params: { collectionId },
        }
      );

      const photosWithThumbnails = photos.map((p) => ({
        id: p.id,
        shareToken: p.shareToken,
        filename: p.filename,
        originalName: p.originalName,
        size: p.size,
        width: p.width,
        height: p.height,
        uploadedAt: p.uploadedAt,
        tags: p.tags || [],
        thumbnailDataB64: p.thumbnailDataB64,
        selected: false,
      }));

      res.json({
        success: true,
        photos: photosWithThumbnails,
      });
    } catch (error) {
      console.error("Get collection photos error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve collection photos",
        error: error.message,
      });
    }
  }

  async getGuests(req, res) {
    try {
      const clientUsername = req.user.username;

      const db = this.dbInstance.useDatabase(
        process.env.DB_NAME,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD
      );

      // Get all guests created by this client (including inactive ones)
      const guests = await db.query(
        `SELECT 
          @rid as id,
          username,
          guestName,
          isActive,
          expiresAt,
          createdAt
         FROM Guest 
         WHERE in('ClientGuests').username = :clientUsername
         ORDER BY createdAt DESC`,
        { params: { clientUsername } }
      );

      // For each guest, count how many photos they have access to
      const guestsWithCounts = await Promise.all(
        guests.map(async (guest) => {
          const accessRecords = await db.query(
            `SELECT out.shareToken as shareToken
             FROM PhotoAccess 
             WHERE in('GuestAccess').@rid = :guestId
             AND isActive = true`,
            { params: { guestId: guest.id } }
          );

          return {
            ...guest,
            sharedPhotoCount: accessRecords.length,
          };
        })
      );

      res.json({
        success: true,
        guests: guestsWithCounts,
      });
    } catch (error) {
      console.error("Get guests error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve guests",
        error: error.message,
      });
    }
  }

  async toggleGuestAccess(req, res) {
    try {
      const { guestId } = req.params;
      const clientUsername = req.user.username;

      const db = this.dbInstance.useDatabase(
        process.env.DB_NAME,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD
      );

      // Verify that this guest belongs to the client
      const guestCheck = await db.query(
        `SELECT @rid as id, username, guestName, isActive 
         FROM Guest 
         WHERE @rid = :guestId 
         AND in('ClientGuests').username = :clientUsername`,
        {
          params: { guestId, clientUsername },
        }
      );

      if (guestCheck.length === 0) {
        return res.status(403).json({
          success: false,
          message:
            "Guest not found or you don't have permission to modify this guest",
        });
      }

      const guest = guestCheck[0];
      const newStatus = !guest.isActive;

      // Toggle the guest's active status
      await db.query(
        `UPDATE Guest SET isActive = :isActive WHERE @rid = :guestId`,
        {
          params: {
            isActive: newStatus,
            guestId: guestId,
          },
        }
      );

      console.log(
        `✅ Guest ${guest.username} (${guest.guestName}) access ${
          newStatus ? "enabled" : "disabled"
        } by ${clientUsername}`
      );

      res.json({
        success: true,
        message: `Guest access ${
          newStatus ? "enabled" : "disabled"
        } successfully`,
        guest: {
          id: guestId,
          username: guest.username,
          guestName: guest.guestName,
          isActive: newStatus,
        },
      });
    } catch (error) {
      console.error("Toggle guest access error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to toggle guest access",
        error: error.message,
      });
    }
  }

  async createGuest(req, res) {
    try {
      console.log("createGuest called by user:", req.user);
      console.log("User role:", req.user.role);

      if (req.user.role !== "client") {
        console.log(
          "ROLE CHECK FAILED: Expected 'client', got:",
          req.user.role
        );
        return res.status(403).json({
          success: false,
          message: "Only clients can create guest accounts",
        });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const { email, guestName, photoIds, expirationDays = 7 } = req.body;
      const clientUsername = req.user.username;
      const clientId = req.user.userId; // Get client's UUID

      console.log("Creating guest for client:", clientUsername);
      console.log("Photo shareTokens to share:", photoIds);

      const db = this.dbInstance.useDatabase(
        process.env.DB_NAME,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD
      );

      // Get the photos by their shareTokens (temporarily bypassing access check)
      console.log("Fetching photos by shareTokens:", photoIds);

      const accessiblePhotos = await db.query(
        `SELECT @rid as photoId, shareToken 
         FROM Photo 
         WHERE shareToken IN :shareTokens
         AND isActive = true`,
        {
          params: {
            shareTokens: photoIds,
          },
        }
      );

      console.log(
        "Photos found:",
        accessiblePhotos.length,
        "out of",
        photoIds.length,
        "requested"
      );

      if (accessiblePhotos.length !== photoIds.length) {
        console.log("PHOTO FETCH FAILED - Some photos not found");
        return res.status(403).json({
          success: false,
          message: `Only found ${accessiblePhotos.length} of ${photoIds.length} photos`,
        });
      }

      // Check if guest already exists for this client (by encrypted email for privacy)
      const encryptedEmailToCheck = this.encryption.encryptSimple(email);
      const existingGuest = await db.query(
        `SELECT @rid as id, username, expiresAt 
         FROM Guest 
         WHERE encryptedEmail = :encryptedEmail 
         AND in('ClientGuests').username = :clientUsername 
         AND isActive = true`,
        { params: { encryptedEmail: encryptedEmailToCheck, clientUsername } }
      );

      let guestUsername;
      let credentials;
      const expirationDate = new Date(
        Date.now() + expirationDays * 24 * 60 * 60 * 1000
      );

      if (existingGuest.length > 0) {
        // Update existing guest access period using username
        guestUsername = existingGuest[0].username;

        await db.query(
          `UPDATE Guest SET 
           expiresAt = date(:expiresAt, 'yyyy-MM-dd HH:mm:ss')
           WHERE username = :username`,
          {
            params: {
              expiresAt: expirationDate
                .toISOString()
                .replace("T", " ")
                .substring(0, 19),
              username: guestUsername,
            },
          }
        );

        credentials = {
          username: guestUsername,
          password: "existing_account",
          expiresAt: expirationDate.toISOString(),
        };
      } else {
        // Generate credentials for new guest
        guestUsername = this.userCredentials.generateUserCode();
        const password = await this.userCredentials.generateSecurePassword(10);
        const hashedPassword = await bcrypt.hash(password, 12);
        const encryptedEmail = this.encryption.encryptSimple(email);
        const { v4: uuidv4 } = require("uuid");
        const guestId = uuidv4();

        // Create guest using INSERT INTO
        await db.query(
          `INSERT INTO Guest SET 
           guestId = :guestId,
           clientId = :clientId,
           username = :username,
           encryptedEmail = :encryptedEmail,
           password = :password,
           guestName = :guestName,
           role = 'guest',
           createdAt = sysdate(),
           expiresAt = date(:expiresAt, 'yyyy-MM-dd HH:mm:ss'),
           isActive = true,
           mustChangePassword = true`,
          {
            params: {
              guestId: guestId,
              clientId: clientId,
              username: guestUsername,
              encryptedEmail: encryptedEmail,
              password: hashedPassword,
              guestName: guestName,
              expiresAt: expirationDate
                .toISOString()
                .replace("T", " ")
                .substring(0, 19),
            },
          }
        );

        // Create ClientGuests edge linking client to guest
        await db.query(
          `CREATE EDGE ClientGuests 
           FROM (SELECT FROM Client WHERE username = :clientUsername LIMIT 1)
           TO (SELECT FROM Guest WHERE username = :guestUsername LIMIT 1)
           SET createdAt = sysdate()`,
          {
            params: { clientUsername, guestUsername },
          }
        );

        credentials = {
          username: guestUsername,
          password: password,
          expiresAt: expirationDate.toISOString(),
        };
      }

      // Delete existing PhotoAccess edges for this guest (cleanup old access)
      await db.query(
        `DELETE EDGE PhotoAccess 
         WHERE in IN (SELECT FROM Guest WHERE username = :guestUsername)`,
        { params: { guestUsername } }
      );

      // Create PhotoAccess edges for each photo using shareTokens from accessiblePhotos
      const shareTokens = accessiblePhotos.map((p) => p.shareToken);
      console.log(
        `Creating PhotoAccess edges for ${shareTokens.length} photos`
      );

      for (const shareToken of shareTokens) {
        console.log(`Creating PhotoAccess for shareToken: ${shareToken}`);
        const result = await db.query(
          `CREATE EDGE PhotoAccess 
           FROM (SELECT FROM Photo WHERE shareToken = :shareToken LIMIT 1)
           TO (SELECT FROM Guest WHERE username = :guestUsername LIMIT 1)
           SET accessType = 'view', grantedAt = sysdate(), expiresAt = date(:expiresAt, 'yyyy-MM-dd HH:mm:ss'), isActive = true`,
          {
            params: {
              shareToken,
              guestUsername,
              expiresAt: expirationDate
                .toISOString()
                .replace("T", " ")
                .substring(0, 19),
            },
          }
        );
        console.log(`PhotoAccess edge created:`, result);
      }

      // Get client info for email
      const clientInfo = await db.query(
        `SELECT clientName FROM Client WHERE username = :clientUsername`,
        { params: { clientUsername } }
      );

      // Send credentials via email (email NOT stored in database)
      if (credentials.password !== "existing_account") {
        const emailResult = await this.emailService.sendGuestCredentials(
          email, // This email is only used for sending, not stored
          {
            username: credentials.username,
            password: credentials.password,
            expiresAt: credentials.expiresAt,
          },
          clientInfo[0] || { clientName: "Client" },
          photoIds.length
        );
      }

      res.status(201).json({
        success: true,
        message:
          "Guest access created successfully and credentials sent via email",
        guest: {
          username: guestUsername,
          guestName: guestName,
          sharedPhotoCount: shareTokens.length,
          expiresIn: `${expirationDays} days`,
          emailSent: credentials.password !== "existing_account",
        },
        credentials:
          credentials.password !== "existing_account"
            ? {
                username: credentials.username,
                password: credentials.password,
              }
            : {
                message:
                  "Guest already exists, existing credentials will be used",
              },
      });
    } catch (error) {
      console.error("Create guest error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to create guest access",
      });
    }
  }
}

module.exports = ClientService;
