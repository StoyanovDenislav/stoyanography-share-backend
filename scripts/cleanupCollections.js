#!/usr/bin/env node

/**
 * Cleanup script for expired collections
 * This script deletes collections that have reached their autoDeleteAt timestamp
 * Run this periodically via cron (e.g., daily at midnight)
 */

require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});
const Database = require("../Database/databaseClass");

async function cleanupExpiredCollections() {
  const db = new Database();

  try {
    console.log("Starting collection cleanup...");

    const dbInstance = db.useDatabase(
      process.env.DB_NAME,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );

    // Find all collections that have expired
    const expiredCollections = await dbInstance.query(
      `SELECT collectionId, name, autoDeleteAt 
       FROM PhotoCollection 
       WHERE autoDeleteAt <= sysdate() 
       AND isActive = true 
       AND deletedAt IS NULL`
    );

    if (!expiredCollections || expiredCollections.length === 0) {
      console.log("No expired collections found.");
      return;
    }

    console.log(
      `Found ${expiredCollections.length} expired collection(s) to delete.`
    );

    // Delete each expired collection
    for (const collection of expiredCollections) {
      console.log(
        `Deleting collection: ${collection.name} (expired on ${new Date(
          collection.autoDeleteAt
        ).toISOString()})`
      );

      // Soft delete the collection by setting deletedAt and isActive
      await dbInstance.query(
        `UPDATE PhotoCollection 
         SET deletedAt = sysdate(), 
             isActive = false,
             deletionReason = 'Auto-deleted after 14 days'
         WHERE collectionId = :collectionId`,
        {
          params: { collectionId: collection.collectionId },
        }
      );

      console.log(`✓ Deleted collection: ${collection.name}`);
    }

    console.log(
      `\nCleanup complete! Deleted ${expiredCollections.length} collection(s).`
    );
  } catch (error) {
    console.error("Error during collection cleanup:", error);
    process.exit(1);
  } finally {
    await db.closeConnection();
  }
}

// Run the cleanup
cleanupExpiredCollections();
