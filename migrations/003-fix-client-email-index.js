const Database = require("../Database/databaseClass");
require("dotenv").config();

class FixClientEmailIndex {
  constructor() {
    this.dbInstance = new Database(
      process.env.DB_HOST,
      process.env.DB_PORT,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );
  }

  async run() {
    console.log("🔧 Fixing Client email indexes...\n");

    const db = this.dbInstance.useDatabase(
      process.env.DB_NAME,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );

    try {
      // Drop existing email indexes
      console.log("Dropping existing email indexes...");

      try {
        await db.query("DROP INDEX Client.email");
        console.log("  ✓ Dropped Client.email");
      } catch (e) {
        console.log("  - Client.email doesn't exist or already dropped");
      }

      try {
        await db.query("DROP INDEX Client_email_idx");
        console.log("  ✓ Dropped Client_email_idx");
      } catch (e) {
        console.log("  - Client_email_idx doesn't exist or already dropped");
      }

      try {
        await db.query("DROP INDEX Client.plainEmail");
        console.log("  ✓ Dropped Client.plainEmail");
      } catch (e) {
        console.log("  - Client.plainEmail doesn't exist or already dropped");
      }

      // Recreate email index that ignores null values
      console.log("\nCreating new email index that ignores nulls...");
      await db.query(
        "CREATE INDEX Client.email ON Client (email) UNIQUE METADATA {ignoreNullValues: true}"
      );
      console.log("  ✓ Created Client.email index");

      console.log("\n✅ Email index fixed successfully!");
      console.log("   Clients can now be created without email addresses.");
    } catch (error) {
      console.error("\n❌ Fix failed:", error);
      throw error;
    } finally {
      this.dbInstance.closeConnection();
    }
  }
}

// Run if called directly
if (require.main === module) {
  const fixer = new FixClientEmailIndex();
  fixer
    .run()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = FixClientEmailIndex;
