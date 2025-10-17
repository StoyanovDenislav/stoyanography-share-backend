const bcrypt = require("bcrypt");
const { body, validationResult } = require("express-validator");
const Database = require("../Database/databaseClass");
const RefreshTokenService = require("./refreshTokenService");
const {
  generateToken,
  setTokenCookie,
  setSessionIdCookie,
} = require("../middleware/auth");
const { now, toOrientDBDateTime } = require("../utils/dateFormatter");

class AuthService {
  constructor() {
    this.dbInstance = new Database(
      process.env.DB_HOST,
      process.env.DB_PORT,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );
  }

  // Validation rules for registration
  static getRegisterValidation() {
    return [
      body("username")
        .isLength({ min: 3, max: 30 })
        .withMessage("Username must be between 3 and 30 characters")
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage(
          "Username can only contain letters, numbers, and underscores"
        ),

      body("email")
        .isEmail()
        .withMessage("Please provide a valid email address")
        .normalizeEmail(),

      body("password")
        .isLength({ min: 8 })
        .withMessage("Password must be at least 8 characters long")
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage(
          "Password must contain at least one lowercase letter, one uppercase letter, and one number"
        ),
    ];
  }

  // Validation rules for login
  static getLoginValidation() {
    return [
      body("username").notEmpty().withMessage("Username is required"),

      body("password").notEmpty().withMessage("Password is required"),
    ];
  }

  async hashPassword(password) {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  async comparePassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
  }

  async createUser(userData) {
    const db = this.dbInstance.useDatabase(
      process.env.DB_NAME,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );

    try {
      // Check if user already exists
      const existingUser = await db.query(
        "SELECT FROM User WHERE username = :username OR email = :email",
        {
          params: {
            username: userData.username,
            email: userData.email,
          },
        }
      );

      if (existingUser.length > 0) {
        throw new Error("User with this username or email already exists");
      }

      // Hash password
      const hashedPassword = await this.hashPassword(userData.password);

      // Create user record
      const result = await db.query(
        "INSERT INTO User SET username = :username, email = :email, password = :password, createdAt = :createdAt",
        {
          params: {
            username: userData.username,
            email: userData.email,
            password: hashedPassword,
            createdAt: now(),
          },
        }
      );

      return result[0];
    } catch (error) {
      throw error;
    } finally {
      this.dbInstance.closeConnection();
    }
  }

  async authenticateUser(username, password) {
    const db = this.dbInstance.useDatabase(
      process.env.DB_NAME,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );

    try {
      let user = null;
      let userClass = null;

      // Try to find user in User class (Admin)
      let users = await db.query(
        "SELECT FROM User WHERE username = :username",
        { params: { username } }
      );

      if (users.length > 0) {
        user = users[0];
        userClass = "User";
      }

      // Try Photographer class if not found
      if (!user) {
        users = await db.query(
          "SELECT FROM Photographer WHERE username = :username",
          { params: { username } }
        );
        if (users.length > 0) {
          user = users[0];
          userClass = "Photographer";
        }
      }

      // Try Client class if not found
      if (!user) {
        users = await db.query(
          "SELECT FROM Client WHERE username = :username",
          { params: { username } }
        );
        if (users.length > 0) {
          user = users[0];
          userClass = "Client";
        }
      }

      // Guest authentication DISABLED
      // if (!user) {
      //   const now = new Date().toISOString().replace("T", " ").substring(0, 19);
      //   users = await db.query(
      //     "SELECT FROM Guest WHERE username = :username AND isActive = true AND expiresAt > date(:now, 'yyyy-MM-dd HH:mm:ss')",
      //     { params: { username, now: now } }
      //   );
      //   if (users.length > 0) {
      //     user = users[0];
      //     userClass = "Guest";
      //   }
      // }

      if (!user) {
        throw new Error("Invalid credentials");
      }

      // Check if account is active
      if (user.isActive === false) {
        throw new Error("Account is disabled");
      }

      // Check if guest access has expired
      if (userClass === "Guest" && user.expiresAt) {
        // OrientDB stores dates in 'yyyy-MM-dd HH:mm:ss' format
        // Convert to Date objects for comparison
        const now = new Date();
        let expiresAt;

        // Handle both OrientDB date format and ISO format
        if (typeof user.expiresAt === "string") {
          // If it's in 'yyyy-MM-dd HH:mm:ss' format, convert to ISO
          const dateStr = user.expiresAt.replace(" ", "T");
          expiresAt = new Date(dateStr);
        } else {
          expiresAt = new Date(user.expiresAt);
        }

        console.log("🕒 Guest expiration check:", {
          username,
          now: now.toISOString(),
          expiresAt: expiresAt.toISOString(),
          expired: now > expiresAt,
        });

        if (now > expiresAt) {
          throw new Error("Guest access has expired");
        }
      }

      // Verify password
      console.log("🔐 Verifying password for user:", {
        username,
        userClass,
        hasPassword: !!user.password,
        passwordLength: user.password?.length,
      });

      const isValidPassword = await this.comparePassword(
        password,
        user.password
      );

      console.log("🔑 Password verification result:", {
        username,
        isValid: isValidPassword,
      });

      if (!isValidPassword) {
        throw new Error("Invalid credentials");
      }

      // Update last login
      await db.query(
        `UPDATE ${userClass} SET lastLogin = :lastLogin WHERE @rid = :rid`,
        {
          params: {
            lastLogin: now(),
            rid: user["@rid"],
          },
        }
      );

      console.log(
        `✅ User authenticated: ${username} (${userClass}, role: ${user.role})`
      );

      // Return user without password
      const { password: _, ...userWithoutPassword } = user;
      return userWithoutPassword;
    } catch (error) {
      console.error("❌ Authentication failed:", error.message);
      throw error;
    } finally {
      this.dbInstance.closeConnection();
    }
  }

  async register(req, res) {
    try {
      // Check validation results
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const { username, email, password } = req.body;

      // Create user
      const newUser = await this.createUser({ username, email, password });

      // Generate JWT token with role
      const token = generateToken({
        userId: newUser["@rid"],
        username: newUser.username,
        email: newUser.email,
        role: newUser.role || "admin",
      });

      res.status(201).json({
        success: true,
        message: "User registered successfully",
        token,
        user: {
          id: newUser["@rid"],
          username: newUser.username,
          email: newUser.email,
        },
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Registration failed",
      });
    }
  }

  async login(req, res) {
    try {
      // Check validation results
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const { username, password } = req.body;

      // Authenticate user
      const user = await this.authenticateUser(username, password);

      // Generate JWT access token with role
      const tokenPayload = {
        userId: user["@rid"],
        username: user.username,
        email: user.email,
        role: user.role || "admin", // Include role in token
      };

      // Add role-specific fields to token
      if (user.role === "photographer") {
        if (user.photographerId)
          tokenPayload.photographerId = user.photographerId;
        if (user.businessName) tokenPayload.businessName = user.businessName;
      }

      if (user.role === "client") {
        if (user.clientName) tokenPayload.clientName = user.clientName;
        if (user.clientId) tokenPayload.clientId = user.clientId;
      }

      // Guest role disabled
      // if (user.role === "guest") {
      //   if (user.guestName) tokenPayload.guestName = user.guestName;
      //   if (user.expiresAt) tokenPayload.expiresAt = user.expiresAt;
      // }

      const token = generateToken(tokenPayload);

      // Store refresh token in database, get session ID
      const refreshTokenService = new RefreshTokenService();
      const sessionId = await refreshTokenService.storeRefreshToken(
        user["@rid"],
        user.role || "admin",
        req.ip || req.connection.remoteAddress,
        req.get("user-agent")
      );

      // Set access token and session ID in cookies
      // The session ID references the refresh token in the database
      setTokenCookie(res, token);
      setSessionIdCookie(res, sessionId);

      res.json({
        success: true,
        message: "Login successful",
        mustChangePassword: user.mustChangePassword || false,
        user: {
          id: user["@rid"],
          username: user.username,
          email: user.email || user.encryptedEmail,
          role: user.role || "admin",
          lastLogin: user.lastLogin,
          mustChangePassword: user.mustChangePassword || false,
          // Include role-specific fields
          ...(user.businessName && { businessName: user.businessName }),
          ...(user.clientName && { clientName: user.clientName }),
          ...(user.guestName && { guestName: user.guestName }),
          ...(user.photographerId && { photographerId: user.photographerId }),
          ...(user.clientId && { clientId: user.clientId }),
          ...(user.expiresAt && { expiresAt: user.expiresAt }),
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(401).json({
        success: false,
        message: error.message || "Login failed",
      });
    }
  }

  async getProfile(req, res) {
    try {
      const db = this.dbInstance.useDatabase(
        process.env.DB_NAME,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD
      );

      const users = await db.query(
        "SELECT username, email, createdAt, lastLogin FROM User WHERE @rid = :rid",
        {
          params: {
            rid: req.user.userId,
          },
        }
      );

      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      res.json({
        success: true,
        user: users[0],
      });
    } catch (error) {
      console.error("Profile fetch error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch profile",
      });
    } finally {
      this.dbInstance.closeConnection();
    }
  }

  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user.userId;
      const userRole = req.user.role;

      if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          message: "New password must be at least 8 characters long",
        });
      }

      const db = this.dbInstance.useDatabase(
        process.env.DB_NAME,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD
      );

      // Determine which class to query based on role
      let userClass = "User";
      if (userRole === "photographer") userClass = "Photographer";
      else if (userRole === "client") userClass = "Client";
      else if (userRole === "guest") userClass = "Guest";

      // Get current user
      const users = await db.query(
        `SELECT password, mustChangePassword FROM ${userClass} WHERE @rid = :userId`,
        { params: { userId } }
      );

      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const user = users[0];

      // Verify current password
      const isPasswordValid = await bcrypt.compare(
        currentPassword,
        user.password
      );
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Current password is incorrect",
        });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 12);

      // Update password and clear mustChangePassword flag
      await db.query(
        `UPDATE ${userClass} SET password = :password, mustChangePassword = false WHERE @rid = :userId`,
        {
          params: {
            password: hashedPassword,
            userId: userId,
          },
        }
      );

      res.json({
        success: true,
        message: "Password changed successfully",
      });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to change password",
        error: error.message,
      });
    } finally {
      this.dbInstance.closeConnection();
    }
  }

  async refreshToken(req, res) {
    try {
      const sessionId = req.cookies?.sessionId;

      if (!sessionId) {
        return res.status(401).json({
          success: false,
          message: "Session ID required",
        });
      }

      // Validate session ID from database
      const refreshTokenService = new RefreshTokenService();
      const tokenData = await refreshTokenService.validateSessionId(sessionId);

      if (!tokenData) {
        return res.status(403).json({
          success: false,
          message: "Invalid or expired session",
        });
      }

      // Fetch user data to get username, email, and photographerId
      const db = this.dbInstance.useDatabase(
        process.env.DB_NAME,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD
      );

      const userClass =
        tokenData.userRole === "photographer"
          ? "Photographer"
          : tokenData.userRole === "client"
          ? "Client"
          : tokenData.userRole === "guest"
          ? "Guest"
          : "User";

      const userQuery = await db.query(
        `SELECT username, email, photographerId, businessName, clientName, guestName, clientId, expiresAt FROM ${userClass} WHERE @rid = :userId`,
        { params: { userId: tokenData.userId } }
      );

      const userData = userQuery[0] || {};

      // Generate new access token
      const tokenPayload = {
        userId: tokenData.userId,
        username: userData.username,
        email: userData.email,
        role: tokenData.userRole,
      };

      // Add role-specific fields
      if (tokenData.userRole === "photographer" && userData.photographerId) {
        tokenPayload.photographerId = userData.photographerId;
        if (userData.businessName)
          tokenPayload.businessName = userData.businessName;
      }

      if (tokenData.userRole === "client") {
        if (userData.clientName) tokenPayload.clientName = userData.clientName;
        if (userData.clientId) tokenPayload.clientId = userData.clientId;
      }

      if (tokenData.userRole === "guest") {
        if (userData.guestName) tokenPayload.guestName = userData.guestName;
        if (userData.expiresAt) tokenPayload.expiresAt = userData.expiresAt;
      }

      const newToken = generateToken(tokenPayload);
      setTokenCookie(res, newToken);

      // Optional: Rotate session for additional security
      if (process.env.ROTATE_REFRESH_TOKENS === "true") {
        const newSessionId = await refreshTokenService.rotateSession(
          sessionId,
          tokenData.userId,
          tokenData.userRole,
          req.ip || req.connection.remoteAddress,
          req.get("user-agent")
        );
        setSessionIdCookie(res, newSessionId);
      }

      res.json({
        success: true,
        message: "Token refreshed successfully",
      });
    } catch (error) {
      console.error("Refresh token error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to refresh token",
      });
    }
  }

  async logout(req, res) {
    try {
      const sessionId = req.cookies?.sessionId;

      console.log("Logout - SessionID from cookie:", sessionId);

      // Revoke session in database
      if (sessionId) {
        const refreshTokenService = new RefreshTokenService();
        await refreshTokenService.revokeSession(sessionId, "User logout");
        console.log("Logout - Session revoked in database:", sessionId);
      } else {
        console.log("Logout - No sessionId found in cookies");
      }

      return res; // Return res for route handler to clear cookies
    } catch (error) {
      console.error("Logout error:", error);
      return res;
    }
  }
}

module.exports = AuthService;
