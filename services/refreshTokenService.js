const crypto = require("crypto");
const Database = require("../Database/databaseClass");
const { toOrientDBDateTime } = require("../utils/dateFormatter");

class RefreshTokenService {
  constructor() {
    this.dbInstance = new Database(
      process.env.DB_HOST,
      process.env.DB_PORT,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );
  }

  /**
   * Generate a secure random refresh token
   */
  generateRefreshToken() {
    return crypto.randomBytes(64).toString("hex");
  }

  /**
   * Generate a secure session ID (smaller, for cookie)
   */
  generateSessionId() {
    return crypto.randomBytes(32).toString("hex");
  }

  /**
   * Store refresh token in database
   * @param {string} userId - User's RID
   * @param {string} userRole - User's role (admin, photographer, client, guest)
   * @param {string} ipAddress - Request IP address
   * @param {string} userAgent - Request user agent
   * @returns {Promise<string>} - The session ID (NOT the refresh token!)
   */
  async storeRefreshToken(
    userId,
    userRole,
    ipAddress = null,
    userAgent = null
  ) {
    const db = this.dbInstance.useDatabase(
      process.env.DB_NAME,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );

    try {
      const token = this.generateRefreshToken(); // Stored in DB
      const sessionId = this.generateSessionId(); // Returned to client
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

      const query = `INSERT INTO RefreshToken SET 
        token = :token,
        sessionId = :sessionId,
        userId = :userId,
        userRole = :userRole,
        expiresAt = :expiresAt,
        createdAt = :createdAt,
        ipAddress = :ipAddress,
        userAgent = :userAgent,
        isRevoked = false`;

      await db.query(query, {
        params: {
          token,
          sessionId,
          userId,
          userRole,
          expiresAt: toOrientDBDateTime(expiresAt),
          createdAt: toOrientDBDateTime(new Date()),
          ipAddress: ipAddress || "unknown",
          userAgent: userAgent || "unknown",
        },
      });

      return sessionId; // Return sessionId, NOT the token!
    } finally {
      this.dbInstance.closeConnection();
    }
  }

  /**
   * Validate session ID and return user data
   * @param {string} sessionId - The session ID from cookie
   * @returns {Promise<Object|null>} - Token data or null if invalid
   */
  async validateSessionId(sessionId) {
    const db = this.dbInstance.useDatabase(
      process.env.DB_NAME,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );

    try {
      // Only check if session exists and hasn't expired
      // If it's in the DB, it's valid (revoked ones are deleted)
      const query = `SELECT * FROM RefreshToken WHERE sessionId = :sessionId AND expiresAt > sysdate()`;

      const result = await db.query(query, {
        params: { sessionId },
      });

      if (result.length === 0) {
        return null;
      }

      return result[0];
    } finally {
      this.dbInstance.closeConnection();
    }
  }

  /**
   * Revoke a session by session ID (deletes from database)
   * @param {string} sessionId - The session ID to revoke
   * @param {string} reason - Reason for revocation (for logging)
   */
  async revokeSession(sessionId, reason = "Manual revocation") {
    const db = this.dbInstance.useDatabase(
      process.env.DB_NAME,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );

    try {
      console.log(`Revoking session ${sessionId}: ${reason}`);

      // Delete the session immediately instead of marking as revoked
      const query = `DELETE VERTEX RefreshToken WHERE sessionId = :sessionId`;

      const result = await db.query(query, {
        params: {
          sessionId,
        },
      });

      console.log(`Session ${sessionId} deleted from database`);
      return result;
    } finally {
      this.dbInstance.closeConnection();
    }
  }

  /**
   * Revoke all refresh tokens for a user (deletes from database)
   * @param {string} userId - User's RID
   * @param {string} reason - Reason for revocation (for logging)
   */
  async revokeAllUserTokens(userId, reason = "Logout all sessions") {
    const db = this.dbInstance.useDatabase(
      process.env.DB_NAME,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );

    try {
      console.log(`Revoking all sessions for user ${userId}: ${reason}`);

      // Delete all sessions for this user
      const query = `DELETE VERTEX RefreshToken WHERE userId = :userId`;

      const result = await db.query(query, {
        params: {
          userId,
        },
      });

      console.log(`All sessions for user ${userId} deleted from database`);
      return result;
    } finally {
      this.dbInstance.closeConnection();
    }
  }

  /**
   * Clean up expired tokens (for maintenance)
   * Now only deletes expired tokens since revoked ones are deleted immediately
   */
  async cleanupExpiredTokens() {
    const db = this.dbInstance.useDatabase(
      process.env.DB_NAME,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );

    try {
      // Only delete expired tokens (revoked tokens are already deleted on revocation)
      const query = `DELETE VERTEX RefreshToken WHERE expiresAt < sysdate()`;

      const result = await db.query(query);
      return result.length;
    } finally {
      this.dbInstance.closeConnection();
    }
  }

  /**
   * Get all active sessions for a user
   * @param {string} userId - User's RID
   */
  async getUserActiveSessions(userId) {
    const db = this.dbInstance.useDatabase(
      process.env.DB_NAME,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );

    try {
      // All sessions in DB are active (revoked ones are deleted)
      const query = `SELECT @rid, createdAt, ipAddress, userAgent, expiresAt 
        FROM RefreshToken 
        WHERE userId = :userId AND expiresAt > sysdate()
        ORDER BY createdAt DESC`;

      return await db.query(query, {
        params: { userId },
      });
    } finally {
      this.dbInstance.closeConnection();
    }
  }

  /**
   * Rotate refresh token (issue new one and delete old)
   * @param {string} oldSessionId - The old session ID
   * @param {string} userId - User's RID
   * @param {string} userRole - User's role
   * @param {string} ipAddress - Request IP address
   * @param {string} userAgent - Request user agent
   * @returns {Promise<string>} - The new session ID
   */
  async rotateSession(oldSessionId, userId, userRole, ipAddress, userAgent) {
    // Delete old session (immediate deletion)
    await this.revokeSession(oldSessionId, "Session rotated");

    // Issue new session
    return await this.storeRefreshToken(userId, userRole, ipAddress, userAgent);
  }
}

module.exports = RefreshTokenService;
