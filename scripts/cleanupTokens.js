require("dotenv").config();
const RefreshTokenService = require("../services/refreshTokenService");

/**
 * Cleanup script for expired refresh tokens
 * Run this periodically (e.g., via cron job) to keep the database clean
 */
async function cleanupTokens() {
  console.log("🧹 Starting refresh token cleanup...");

  const refreshTokenService = new RefreshTokenService();

  try {
    const deletedCount = await refreshTokenService.cleanupExpiredTokens();
    console.log(`✅ Cleaned up ${deletedCount} expired/revoked tokens`);
  } catch (error) {
    console.error("❌ Error during cleanup:", error);
    process.exit(1);
  }

  process.exit(0);
}

cleanupTokens();
