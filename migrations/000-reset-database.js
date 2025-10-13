const Database = require("../Database/databaseClass");
require("dotenv").config();

class DatabaseReset {
  constructor() {
    this.dbInstance = new Database(
      process.env.DB_HOST,
      process.env.DB_PORT,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );
  }

  async run() {
    console.log("🗑️  Starting Database Reset...\n");

    const db = this.dbInstance.useDatabase(
      process.env.DB_NAME,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );

    try {
      // Delete all records from each class
      console.log("📝 Deleting all records...");

      await this.deleteAllRecords(db, "GuestAccess");
      await this.deleteAllRecords(db, "PhotoAccess");
      await this.deleteAllRecords(db, "Guest");
      await this.deleteAllRecords(db, "Photo");
      await this.deleteAllRecords(db, "PhotoCollection");
      await this.deleteAllRecords(db, "Client");
      await this.deleteAllRecords(db, "Photographer");
      await this.deleteAllRecords(db, "User");

      console.log("\n✅ Database reset completed successfully!");
      console.log("\n💡 You can now create a new photographer account.");
    } catch (error) {
      console.error("\n❌ Reset failed:", error);
      throw error;
    } finally {
      this.dbInstance.closeConnection();
    }
  }

  async deleteAllRecords(db, className) {
    try {
      const count = await db.query(
        `SELECT count(*) as count FROM ${className}`
      );
      const recordCount = count[0].count;

      if (recordCount > 0) {
        await db.query(`DELETE FROM ${className}`);
        console.log(`   ✓ Deleted ${recordCount} records from ${className}`);
      } else {
        console.log(`   - ${className} was already empty`);
      }
    } catch (error) {
      // Class might not exist, that's okay
      console.log(`   - ${className} does not exist or is empty`);
    }
  }
}

// Run reset if called directly
if (require.main === module) {
  const reset = new DatabaseReset();

  // Add confirmation prompt
  const readline = require("readline").createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  readline.question(
    "⚠️  This will DELETE ALL DATA. Are you sure? (yes/no): ",
    (answer) => {
      readline.close();

      if (answer.toLowerCase() === "yes") {
        reset
          .run()
          .then(() => process.exit(0))
          .catch((err) => {
            console.error(err);
            process.exit(1);
          });
      } else {
        console.log("Reset cancelled.");
        process.exit(0);
      }
    }
  );
}

module.exports = DatabaseReset;
