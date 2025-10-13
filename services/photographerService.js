const bcrypt = require("bcrypt");
const { body, validationResult } = require("express-validator");
const Database = require("../Database/databaseClass");
const { generateToken } = require("../middleware/auth");
const EncryptionService = require("./encryptionService");
const EmailService = require("./emailService");
const EnhancedPhotoService = require("./enhancedPhotoService");
const UserCredentials = require("../UserManagement/generateUserCredentials");
const { now, toOrientDBDateTime } = require("../utils/dateFormatter");
const nodemailer = require("nodemailer");

class PhotographerService {
  constructor() {
    this.dbInstance = new Database(
      process.env.DB_HOST,
      process.env.DB_PORT,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );
    this.encryption = new EncryptionService();
    this.emailService = new EmailService();
    this.photoService = new EnhancedPhotoService();
    this.userCredentials = new UserCredentials();
  }

  // Validation for photographer creation (admin only)
  static getPhotographerValidation() {
    return [
      body("email")
        .isEmail()
        .withMessage("Please provide a valid email address")
        .normalizeEmail(),
      body("businessName")
        .isLength({ min: 2, max: 100 })
        .withMessage("Business name must be between 2 and 100 characters"),
      body("username")
        .optional()
        .isLength({ min: 3, max: 30 })
        .withMessage("Username must be between 3 and 30 characters"),
    ];
  }

  // Validation for client creation (photographer only)
  static getClientValidation() {
    return [
      body("email")
        .isEmail()
        .withMessage("Please provide a valid email address")
        .normalizeEmail(),
      body("clientName")
        .isLength({ min: 2, max: 100 })
        .withMessage("Client name must be between 2 and 100 characters"),
    ];
  }

  async createPhotographer(req, res) {
    try {
      // Only admin can create photographers
      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Only administrators can create photographer accounts",
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

      const { email, businessName, username } = req.body;

      const db = this.dbInstance.useDatabase(
        process.env.DB_NAME,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD
      );

      // Check if photographer already exists
      const existingPhotographer = await db.query(
        "SELECT FROM Photographer WHERE email = :email",
        { params: { email } }
      );

      if (existingPhotographer.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Photographer with this email already exists",
        });
      }

      // Generate credentials
      const generatedUsername =
        username || this.userCredentials.generateUserCode();
      const password = await this.userCredentials.generateSecurePassword(12);
      const hashedPassword = await bcrypt.hash(password, 12);
      const { v4: uuidv4 } = require("uuid");
      const photographerId = uuidv4();

      // Create photographer
      const result = await db.query(
        `
        INSERT INTO Photographer SET 
        photographerId = :photographerId,
        username = :username,
        email = :email,
        password = :password,
        businessName = :businessName,
        role = 'photographer',
        createdAt = :createdAt,
        isActive = true,
        createdBy = :createdBy,
        mustChangePassword = true
      `,
        {
          params: {
            photographerId: photographerId,
            username: generatedUsername,
            email: email,
            password: hashedPassword,
            businessName: businessName,
            createdAt: now(),
            createdBy: req.user.userId,
          },
        }
      );

      // Send credentials via email
      try {
        await this.emailService.sendPhotographerCredentials(email, {
          username: generatedUsername,
          password: password,
          businessName: businessName,
        });
      } catch (emailError) {
        console.error("Failed to send credentials email:", emailError);
        // Continue even if email fails - we still return credentials in response
      }

      res.status(201).json({
        success: true,
        message:
          "Photographer created successfully and credentials sent via email",
        photographer: {
          id: result[0]["@rid"],
          username: generatedUsername,
          businessName: businessName,
        },
        credentials: {
          username: generatedUsername,
          password: password,
        },
        note: "Credentials have been sent to the photographer's email address.",
      });
    } catch (error) {
      console.error("Create photographer error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to create photographer",
      });
    } finally {
      this.dbInstance.closeConnection();
    }
  }

  async createClient(req, res) {
    try {
      // Only photographers can create clients
      if (req.user.role !== "photographer") {
        return res.status(403).json({
          success: false,
          message: "Only photographers can create client accounts",
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

      const { email, clientName } = req.body;
      const photographerId = req.user.photographerId || req.user.userId;

      const db = this.dbInstance.useDatabase(
        process.env.DB_NAME,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD
      );

      // Check if client already exists for this photographer (by encrypted email for privacy)
      const encryptedEmailToCheck = this.encryption.encryptSimple(email);
      const existingClient = await db.query(
        "SELECT FROM Client WHERE encryptedEmail = :encryptedEmail AND photographerId = :photographerId",
        { params: { encryptedEmail: encryptedEmailToCheck, photographerId } }
      );

      if (existingClient.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Client with this email already exists for your account",
        });
      }

      // Generate credentials
      const username = this.userCredentials.generateUserCode();
      const password = await this.userCredentials.generateSecurePassword(12);
      const hashedPassword = await bcrypt.hash(password, 12);
      const encryptedEmail = this.encryption.encryptSimple(email);
      const { v4: uuidv4 } = require("uuid");
      const clientId = uuidv4();

      // Create client - IMPORTANT: We do NOT store the plain email for privacy
      const result = await db.query(
        `
        INSERT INTO Client SET 
        clientId = :clientId,
        username = :username,
        encryptedEmail = :encryptedEmail,
        password = :password,
        clientName = :clientName,
        role = 'client',
        photographerId = :photographerId,
        createdAt = :createdAt,
        isActive = true,
        notificationSent = false,
        mustChangePassword = true
      `,
        {
          params: {
            clientId: clientId,
            username: username,
            encryptedEmail: encryptedEmail,
            password: hashedPassword,
            clientName: clientName,
            photographerId: photographerId,
            createdAt: now(),
          },
        }
      );

      // Get photographer info for email
      const photographerInfo = await db.query(
        "SELECT businessName, username FROM Photographer WHERE @rid = :photographerId",
        { params: { photographerId: photographerId } }
      );

      // Send credentials via email (email NOT stored in database)
      const emailResult = await this.emailService.sendClientCredentials(
        email, // This email is only used for sending, not stored
        {
          username: username,
          password: password,
        },
        photographerInfo[0] || {
          businessName: "Photography Studio",
          username: "photographer",
        }
      );

      // Send credentials via email
      // await this.sendClientCredentialsEmail(email, username, password, clientName);

      res.status(201).json({
        success: true,
        message: "Client created successfully and credentials sent via email",
        client: {
          id: result[0]["@rid"],
          username: username,
          clientName: clientName,
          // Email not included in response for privacy
          emailSent: emailResult.success,
        },
        credentials: {
          username: username,
          password: password,
        },
      });
    } catch (error) {
      console.error("Create client error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to create client",
      });
    } finally {
      this.dbInstance.closeConnection();
    }
  }

  async getClients(req, res) {
    try {
      if (req.user.role !== "photographer" && req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      const photographerId = req.user.photographerId || req.user.userId;
      const db = this.dbInstance.useDatabase(
        process.env.DB_NAME,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD
      );

      let query = `
        SELECT clientId as id, username, email, clientName, createdAt, lastLogin, isActive
        FROM Client 
        WHERE isActive = true
      `;

      const params = {};

      if (req.user.role === "photographer") {
        query += ` AND photographerId = :photographerId`;
        params.photographerId = photographerId;
      }

      query += ` ORDER BY createdAt DESC`;

      const clients = await db.query(query, { params });

      res.json({
        success: true,
        clients: clients,
      });
    } catch (error) {
      console.error("Get clients error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve clients",
      });
    } finally {
      this.dbInstance.closeConnection();
    }
  }

  async sharePhotosWithClient(req, res) {
    try {
      if (req.user.role !== "photographer") {
        return res.status(403).json({
          success: false,
          message: "Only photographers can share photos with clients",
        });
      }

      const { clientId, photoIds, accessType = "view" } = req.body;

      if (!clientId || !photoIds || !Array.isArray(photoIds)) {
        return res.status(400).json({
          success: false,
          message: "Client ID and photo IDs array are required",
        });
      }

      const photographerId = req.user.photographerId || req.user.userId;
      const db = this.dbInstance.useDatabase(
        process.env.DB_NAME,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD
      );

      // Verify client belongs to this photographer
      const clients = await db.query(
        "SELECT FROM Client WHERE @rid = :clientId AND photographerId = :photographerId",
        { params: { clientId, photographerId } }
      );

      if (clients.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Client not found or not accessible",
        });
      }

      // Verify photos belong to this photographer
      const photos = await db.query(
        "SELECT @rid FROM Photo WHERE @rid IN :photoIds AND photographerId = :photographerId AND isActive = true",
        { params: { photoIds, photographerId } }
      );

      if (photos.length !== photoIds.length) {
        return res.status(400).json({
          success: false,
          message: "Some photos not found or not accessible",
        });
      }

      // Create access permissions
      for (const photoId of photoIds) {
        try {
          await db.query(
            `
            INSERT INTO PhotoAccess SET 
            photoId = :photoId,
            userId = :clientId,
            userType = 'client',
            accessType = :accessType,
            grantedBy = :photographerId,
            grantedAt = :grantedAt,
            isActive = true
          `,
            {
              params: {
                photoId: photoId,
                clientId: clientId,
                accessType: accessType,
                photographerId: photographerId,
                grantedAt: new Date().toISOString(),
              },
            }
          );
        } catch (e) {
          if (!e.message.includes("duplicate")) {
            throw e;
          }
          // Access already exists, update it
          await db.query(
            `
            UPDATE PhotoAccess SET 
            accessType = :accessType,
            grantedAt = :grantedAt,
            isActive = true
            WHERE photoId = :photoId AND userId = :clientId
          `,
            {
              params: {
                accessType: accessType,
                grantedAt: new Date().toISOString(),
                photoId: photoId,
                clientId: clientId,
              },
            }
          );
        }
      }

      res.json({
        success: true,
        message: `Successfully shared ${photoIds.length} photos with client`,
        sharedCount: photoIds.length,
      });
    } catch (error) {
      console.error("Share photos error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to share photos with client",
      });
    } finally {
      this.dbInstance.closeConnection();
    }
  }

  async createPhotoGroup(req, res) {
    try {
      if (req.user.role !== "photographer") {
        return res.status(403).json({
          success: false,
          message: "Only photographers can create photo groups",
        });
      }

      const { groupName, description, photoIds, clientIds } = req.body;

      if (!groupName || !photoIds || !Array.isArray(photoIds)) {
        return res.status(400).json({
          success: false,
          message: "Group name and photo IDs array are required",
        });
      }

      const photographerId = req.user.photographerId || req.user.userId;
      const db = this.dbInstance.useDatabase(
        process.env.DB_NAME,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD
      );

      // Create photo group
      const result = await db.query(
        `
        INSERT INTO PhotoGroup SET 
        groupName = :groupName,
        description = :description,
        photographerId = :photographerId,
        createdAt = :createdAt,
        isActive = true,
        photoIds = :photoIds,
        clientIds = :clientIds
      `,
        {
          params: {
            groupName: groupName,
            description: description || "",
            photographerId: photographerId,
            createdAt: now(),
            photoIds: photoIds,
            clientIds: clientIds || [],
          },
        }
      );

      // If clients are specified, grant access to all photos in the group
      if (clientIds && clientIds.length > 0) {
        for (const clientId of clientIds) {
          for (const photoId of photoIds) {
            try {
              await db.query(
                `
                INSERT INTO PhotoAccess SET 
                photoId = :photoId,
                userId = :clientId,
                userType = 'client',
                accessType = 'view',
                grantedBy = :photographerId,
                grantedAt = :grantedAt,
                isActive = true
              `,
                {
                  params: {
                    photoId: photoId,
                    clientId: clientId,
                    photographerId: photographerId,
                    grantedAt: new Date().toISOString(),
                  },
                }
              );
            } catch (e) {
              // Access might already exist, ignore duplicates
              if (!e.message.includes("duplicate")) {
                console.warn("Failed to grant access:", e.message);
              }
            }
          }
        }
      }

      res.status(201).json({
        success: true,
        message: "Photo group created successfully",
        group: {
          id: result[0]["@rid"],
          groupName: groupName,
          description: description,
          photoCount: photoIds.length,
          clientCount: clientIds ? clientIds.length : 0,
        },
      });
    } catch (error) {
      console.error("Create photo group error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create photo group",
      });
    } finally {
      this.dbInstance.closeConnection();
    }
  }

  async getPhotoGroups(req, res) {
    try {
      if (req.user.role !== "photographer") {
        return res.status(403).json({
          success: false,
          message: "Only photographers can view photo groups",
        });
      }

      const photographerId = req.user.photographerId || req.user.userId;
      const db = this.dbInstance.useDatabase(
        process.env.DB_NAME,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD
      );

      const groups = await db.query(
        `
        SELECT @rid as id, groupName, description, createdAt, photoIds, clientIds
        FROM PhotoGroup 
        WHERE photographerId = :photographerId AND isActive = true
        ORDER BY createdAt DESC
      `,
        {
          params: { photographerId },
        }
      );

      res.json({
        success: true,
        groups: groups.map((group) => ({
          id: group.id,
          groupName: group.groupName,
          description: group.description,
          createdAt: group.createdAt,
          photoCount: group.photoIds ? group.photoIds.length : 0,
          clientCount: group.clientIds ? group.clientIds.length : 0,
        })),
      });
    } catch (error) {
      console.error("Get photo groups error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve photo groups",
      });
    } finally {
      this.dbInstance.closeConnection();
    }
  }

  // Admin methods
  async getAllPhotographers(req, res) {
    try {
      const db = this.dbInstance.useDatabase(
        process.env.DB_NAME,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD
      );

      const photographers = await db.query(
        "SELECT username, businessName, createdAt, isActive, @rid as id FROM Photographer ORDER BY createdAt DESC"
      );

      res.json({
        success: true,
        photographers: photographers.map((p) => ({
          id: p.id,
          username: p.username,
          businessName: p.businessName,
          createdAt: p.createdAt,
          isActive: p.isActive !== false, // Default to true if not set
        })),
      });
    } catch (error) {
      console.error("Get all photographers error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve photographers",
      });
    } finally {
      this.dbInstance.closeConnection();
    }
  }

  async togglePhotographerStatus(req, res) {
    try {
      const { photographerId } = req.params;
      console.log("🔄 Toggling photographer status for:", photographerId);

      const db = this.dbInstance.useDatabase(
        process.env.DB_NAME,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD
      );

      // Get current photographer
      const photographer = await db.query(
        "SELECT isActive FROM Photographer WHERE @rid = :rid",
        { params: { rid: photographerId } }
      );

      if (photographer.length === 0) {
        console.log("❌ Photographer not found:", photographerId);
        return res.status(404).json({
          success: false,
          message: "Photographer not found",
        });
      }

      const currentStatus = photographer[0].isActive !== false;
      const newStatus = !currentStatus;

      console.log("   Current status:", currentStatus);
      console.log("   New status:", newStatus);

      // Toggle status
      await db.query(
        "UPDATE Photographer SET isActive = :isActive WHERE @rid = :rid",
        {
          params: {
            isActive: newStatus,
            rid: photographerId,
          },
        }
      );

      console.log("✅ Photographer status toggled successfully");

      res.json({
        success: true,
        message: `Photographer ${
          newStatus ? "activated" : "deactivated"
        } successfully`,
        isActive: newStatus,
      });
    } catch (error) {
      console.error("❌ Toggle photographer status error:", error);
      console.error("   Error message:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to update photographer status",
        error: error.message,
      });
    } finally {
      this.dbInstance.closeConnection();
    }
  }

  async getPhotographerStats(req, res) {
    try {
      const { photographerId } = req.params;

      const db = this.dbInstance.useDatabase(
        process.env.DB_NAME,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD
      );

      // Get photographer info
      const photographer = await db.query(
        "SELECT username, businessName, createdAt FROM Photographer WHERE @rid = :rid",
        { params: { rid: photographerId } }
      );

      if (photographer.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Photographer not found",
        });
      }

      // Get client count
      const clients = await db.query(
        "SELECT count(*) as count FROM Client WHERE photographerId = :pid",
        { params: { pid: photographerId } }
      );

      // Get photo count
      const photos = await db.query(
        "SELECT count(*) as count FROM Photo WHERE photographerId = :pid",
        { params: { pid: photographerId } }
      );

      res.json({
        success: true,
        stats: {
          photographer: photographer[0],
          clientCount: clients[0]?.count || 0,
          photoCount: photos[0]?.count || 0,
        },
      });
    } catch (error) {
      console.error("Get photographer stats error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve photographer statistics",
      });
    } finally {
      this.dbInstance.closeConnection();
    }
  }

  async deletePhotographer(req, res) {
    try {
      const { photographerId } = req.params;
      const { reason = "Admin deletion" } = req.body;
      console.log("🗑️  Soft deleting photographer:", photographerId);

      const db = this.dbInstance.useDatabase(
        process.env.DB_NAME,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD
      );

      // Check if photographer exists by UUID
      const photographer = await db.query(
        "SELECT photographerId, businessName FROM Photographer WHERE photographerId = :photographerId",
        { params: { photographerId: photographerId } }
      );

      if (photographer.length === 0) {
        console.log("❌ Photographer not found:", photographerId);
        return res.status(404).json({
          success: false,
          message: "Photographer not found",
        });
      }

      console.log("   Found photographer:", photographer[0].businessName);

      // Use soft delete service
      const SoftDeleteService = require("./softDeleteService");
      const softDeleteService = new SoftDeleteService();

      // Photographer ID is already a UUID
      const result = await softDeleteService.markForDeletion(
        "Photographer",
        photographerId,
        reason,
        "photographerId" // Use photographerId UUID
      );

      console.log("✅ Photographer marked for deletion");

      res.json({
        success: true,
        message:
          "Photographer marked for deletion. Will be permanently deleted in 7 days.",
        scheduledDeletionDate: result.scheduledDeletionDate,
      });
    } catch (error) {
      console.error("❌ Soft delete photographer error:", error);
      console.error("   Error message:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to delete photographer",
        error: error.message,
      });
    } finally {
      this.dbInstance.closeConnection();
    }
  }
}

module.exports = PhotographerService;
