const Database = require("../Database/databaseClass");
require("dotenv").config();

class PhotoCollectionMigration {
  constructor() {
    this.dbInstance = new Database(
      process.env.DB_HOST,
      process.env.DB_PORT,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );
  }

  async run() {
    console.log("🚀 Starting PhotoCollection Migration...\n");

    const db = this.dbInstance.useDatabase(
      process.env.DB_NAME,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );

    try {
      // Create PhotoCollection class
      console.log("📝 Creating PhotoCollection class...");

      try {
        await db.query("DROP CLASS PhotoCollection UNSAFE");
        console.log("   Dropped existing PhotoCollection class");
      } catch (error) {
        // Class doesn't exist, that's fine
      }

      await db.query(`
        CREATE CLASS PhotoCollection EXTENDS V
      `);

      // Add properties
      await db.query(`
        CREATE PROPERTY PhotoCollection.collectionId STRING
      `);
      await db.query(`
        CREATE PROPERTY PhotoCollection.name STRING
      `);
      await db.query(`
        CREATE PROPERTY PhotoCollection.description STRING
      `);
      await db.query(`
        CREATE PROPERTY PhotoCollection.photographerId STRING
      `);
      await db.query(`
        CREATE PROPERTY PhotoCollection.coverPhotoId STRING
      `);
      await db.query(`
        CREATE PROPERTY PhotoCollection.isActive BOOLEAN
      `);
      await db.query(`
        CREATE PROPERTY PhotoCollection.createdAt DATETIME
      `);
      await db.query(`
        CREATE PROPERTY PhotoCollection.updatedAt DATETIME
      `);
      await db.query(`
        CREATE PROPERTY PhotoCollection.expiresAt DATETIME
      `);

      // Create indexes
      await db.query(`
        CREATE INDEX PhotoCollection.collectionId UNIQUE
      `);
      await db.query(`
        CREATE INDEX PhotoCollection.photographerId NOTUNIQUE
      `);

      console.log("   ✓ PhotoCollection class created successfully");

      // Create CollectionPhoto edge class (many-to-many relationship)
      console.log("\n📝 Creating CollectionPhoto edge class...");

      try {
        await db.query("DROP CLASS CollectionPhoto UNSAFE");
        console.log("   Dropped existing CollectionPhoto class");
      } catch (error) {
        // Class doesn't exist, that's fine
      }

      await db.query(`
        CREATE CLASS CollectionPhoto EXTENDS E
      `);

      await db.query(`
        CREATE PROPERTY CollectionPhoto.addedAt DATETIME
      `);
      await db.query(`
        CREATE PROPERTY CollectionPhoto.orderIndex INTEGER
      `);

      console.log("   ✓ CollectionPhoto edge class created successfully");

      // Create CollectionAccess edge class (for sharing collections with clients)
      console.log("\n📝 Creating CollectionAccess edge class...");

      try {
        await db.query("DROP CLASS CollectionAccess UNSAFE");
        console.log("   Dropped existing CollectionAccess class");
      } catch (error) {
        // Class doesn't exist, that's fine
      }

      await db.query(`
        CREATE CLASS CollectionAccess EXTENDS E
      `);

      await db.query(`
        CREATE PROPERTY CollectionAccess.accessType STRING
      `);
      await db.query(`
        CREATE PROPERTY CollectionAccess.grantedAt DATETIME
      `);
      await db.query(`
        CREATE PROPERTY CollectionAccess.expiresAt DATETIME
      `);

      console.log("   ✓ CollectionAccess edge class created successfully");

      console.log("\n✅ PhotoCollection migration completed successfully!");
    } catch (error) {
      console.error("\n❌ Migration failed:", error);
      throw error;
    } finally {
      this.dbInstance.closeConnection();
    }
  }
}

// Run migration if called directly
if (require.main === module) {
  const migration = new PhotoCollectionMigration();
  migration.run().catch((error) => {
    console.error("Migration error:", error);
    process.exit(1);
  });
}

module.exports = PhotoCollectionMigration;
