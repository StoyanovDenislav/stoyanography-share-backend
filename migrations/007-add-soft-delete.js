const Database = require("../Database/databaseClass");
require("dotenv").config();

class SoftDeleteMigration {
  constructor() {
    this.dbInstance = new Database(
      process.env.DB_HOST,
      process.env.DB_PORT,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );
  }

  async run() {
    console.log("🚀 Starting Soft Delete Migration...\n");

    const db = this.dbInstance.useDatabase(
      process.env.DB_NAME,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );

    try {
      // Add soft delete fields to all vertex classes
      const classes = [
        "Photographer",
        "Client",
        "Guest",
        "Photo",
        "PhotoCollection",
      ];

      for (const className of classes) {
        console.log(`📝 Adding soft delete fields to ${className}...`);

        try {
          // Add deletedAt field (when marked for deletion)
          await db.query(`CREATE PROPERTY ${className}.deletedAt DATETIME`);
          console.log(`   ✅ Added deletedAt to ${className}`);
        } catch (error) {
          console.log(`   ⚠️  deletedAt already exists on ${className}`);
        }

        try {
          // Add scheduledDeletionDate field (when it will be permanently deleted)
          await db.query(
            `CREATE PROPERTY ${className}.scheduledDeletionDate DATETIME`
          );
          console.log(`   ✅ Added scheduledDeletionDate to ${className}`);
        } catch (error) {
          console.log(
            `   ⚠️  scheduledDeletionDate already exists on ${className}`
          );
        }

        try {
          // Add deletionReason field (why it was deleted)
          await db.query(`CREATE PROPERTY ${className}.deletionReason STRING`);
          console.log(`   ✅ Added deletionReason to ${className}`);
        } catch (error) {
          console.log(`   ⚠️  deletionReason already exists on ${className}`);
        }
      }

      console.log("\n✅ Soft delete migration completed successfully!");
      console.log(
        "📋 All entities now support soft deletion with 7-day grace period"
      );
    } catch (error) {
      console.error("❌ Migration failed:", error);
      throw error;
    }
  }
}

// Run migration if called directly
if (require.main === module) {
  const migration = new SoftDeleteMigration();
  migration
    .run()
    .then(() => {
      console.log("\n🎉 Migration completed!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n💥 Migration failed:", error);
      process.exit(1);
    });
}

module.exports = SoftDeleteMigration;
