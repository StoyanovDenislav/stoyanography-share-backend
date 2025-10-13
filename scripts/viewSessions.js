require("dotenv").config();
const RefreshTokenService = require("../services/refreshTokenService");

/**
 * Debug script to view all refresh tokens/sessions
 */
async function viewSessions() {
  console.log("🔍 Viewing all sessions...\n");

  const Database = require("../Database/databaseClass");
  const dbInstance = new Database(
    process.env.DB_HOST,
    process.env.DB_PORT,
    process.env.DB_USERNAME,
    process.env.DB_PASSWORD
  );

  try {
    const db = dbInstance.useDatabase(
      process.env.DB_NAME,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );

    const query = `SELECT sessionId, userId, userRole, createdAt, expiresAt, ipAddress FROM RefreshToken ORDER BY createdAt DESC`;
    const sessions = await db.query(query);

    if (sessions.length === 0) {
      console.log("No sessions found.");
    } else {
      console.log(`Found ${sessions.length} session(s):\n`);
      sessions.forEach((session, index) => {
        console.log(`Session ${index + 1}:`);
        console.log(`  SessionID: ${session.sessionId}`);
        console.log(`  UserID: ${session.userId}`);
        console.log(`  Role: ${session.userRole}`);
        console.log(`  Created: ${session.createdAt}`);
        console.log(`  Expires: ${session.expiresAt}`);
        console.log(`  IP: ${session.ipAddress}`);
        console.log("");
      });
    }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    dbInstance.closeConnection();
  }
}

viewSessions();
