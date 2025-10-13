const Database = require("../Database/databaseClass");
const SoftDeleteService = require("./softDeleteService");

class CleanupService {
  constructor() {
    this.dbInstance = new Database(
      process.env.DB_HOST,
      process.env.DB_PORT,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );
    this.softDeleteService = new SoftDeleteService();
  }

  /**
   * Delete expired PhotoCollections
   */
  async cleanupExpiredCollections() {
    const db = this.dbInstance.useDatabase(
      process.env.DB_NAME,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );

    try {
      // Find expired collections (autoDeleteAt has passed)
      const expiredCollections = await db.query(
        `SELECT collectionId, name, autoDeleteAt FROM PhotoCollection 
         WHERE autoDeleteAt IS NOT NULL 
         AND autoDeleteAt < sysdate()
         AND isActive = true
         AND scheduledDeletionDate IS NULL`
      );

      console.log(
        `🔍 Found ${expiredCollections.length} expired collections to soft-delete`
      );

      if (expiredCollections.length > 0) {
        console.log("Current time:", new Date().toISOString());
        expiredCollections.forEach((c) => {
          console.log(`  - ${c.name}: autoDeleteAt = ${c.autoDeleteAt}`);
        });
      }

      for (const collection of expiredCollections) {
        console.log(
          `🗑️  Soft-deleting expired collection: ${collection.name} (${collection.collectionId})`
        );

        try {
          // First, get all photos in this collection
          const photosInCollection = await db.query(
            `SELECT photoId, originalName
             FROM Photo
             WHERE @rid IN (
               SELECT expand(in) 
               FROM CollectionPhoto 
               WHERE out IN (SELECT FROM PhotoCollection WHERE collectionId = :collectionId)
             )
             AND scheduledDeletionDate IS NULL`,
            {
              params: { collectionId: collection.collectionId },
            }
          );

          console.log(
            `   📸 Found ${photosInCollection.length} photos in collection to soft-delete`
          );

          // Soft delete each photo in the collection
          for (const photo of photosInCollection) {
            try {
              await this.softDeleteService.markForDeletion(
                "Photo",
                photo.photoId,
                `Collection "${collection.name}" expired`,
                "photoId"
              );
              console.log(`      ✅ Photo soft-deleted: ${photo.originalName}`);
            } catch (photoError) {
              console.error(
                `      ❌ Error soft-deleting photo ${photo.originalName}:`,
                photoError.message
              );
            }
          }

          // Now soft delete the collection itself
          await this.softDeleteService.markForDeletion(
            "PhotoCollection",
            collection.collectionId,
            "Auto-delete timer expired",
            "collectionId"
          );
          console.log(
            `   ✅ Collection soft-deleted: ${collection.name} (with ${photosInCollection.length} photos)`
          );
        } catch (error) {
          console.error(
            `   ❌ Error soft-deleting collection ${collection.name}:`,
            error.message
          );
        }
      }

      console.log(
        `✅ Cleanup complete. Soft-deleted ${expiredCollections.length} expired collections`
      );
      return expiredCollections.length;
    } catch (error) {
      console.error("Cleanup error:", error);
      throw error;
    } finally {
      this.dbInstance.closeConnection();
    }
  }

  /**
   * Delete expired Guest accounts
   */
  async cleanupExpiredGuests() {
    const db = this.dbInstance.useDatabase(
      process.env.DB_NAME,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );

    try {
      const now = new Date().toISOString();

      // Mark expired guests as inactive
      const result = await db.query(
        `UPDATE Guest SET isActive = false 
         WHERE expiresAt < :now AND isActive = true`,
        {
          params: { now },
        }
      );

      console.log(`✅ Deactivated expired guest accounts`);
      return result;
    } catch (error) {
      console.error("Guest cleanup error:", error);
      throw error;
    } finally {
      this.dbInstance.closeConnection();
    }
  }

  /**
   * Run all cleanup tasks
   */
  async runAll() {
    console.log("\n🧹 Starting cleanup tasks...");
    const collectionsDeleted = await this.cleanupExpiredCollections();
    await this.cleanupExpiredGuests();
    console.log("🧹 All cleanup tasks complete\n");
    return { collectionsDeleted };
  }
}

module.exports = CleanupService;
