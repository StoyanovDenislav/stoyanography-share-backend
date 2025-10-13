const Database = require("../Database/databaseClass");
require("dotenv").config();

/**
 * Migration: Convert PhotoAccess and GuestAccess from vertex classes to edge classes
 *
 * PhotoAccess should be an edge connecting Client -> Photo
 * GuestAccess should be an edge connecting Guest -> Photo
 */

class ConvertAccessToEdges {
  constructor() {
    this.dbInstance = new Database(
      process.env.DB_HOST,
      process.env.DB_PORT,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );
  }

  async run() {
    console.log(
      "🔄 Converting PhotoAccess and GuestAccess to edge classes...\n"
    );

    const db = this.dbInstance.useDatabase(
      process.env.DB_NAME,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );

    try {
      // 1. Check if PhotoAccess exists as a vertex class
      console.log("1️⃣  Checking PhotoAccess class...");
      try {
        const photoAccessClass = await db.query(
          "SELECT FROM (SELECT expand(classes) FROM metadata:schema) WHERE name = 'PhotoAccess'"
        );

        if (photoAccessClass.length > 0) {
          console.log("   PhotoAccess class exists");

          // Check if there's any data
          const photoAccessData = await db.query(
            "SELECT count(*) as count FROM PhotoAccess"
          );
          console.log(
            `   Found ${photoAccessData[0].count} PhotoAccess records`
          );

          if (photoAccessData[0].count > 0) {
            console.log(
              "   ⚠️  WARNING: PhotoAccess has data - backup recommended before migration"
            );
          }

          // Drop the vertex class
          console.log("   Dropping PhotoAccess vertex class...");
          await db.query("DROP CLASS PhotoAccess UNSAFE");
          console.log("   ✓ PhotoAccess vertex class dropped");
        }
      } catch (e) {
        console.log("   PhotoAccess class doesn't exist or error:", e.message);
      }

      // 2. Create PhotoAccess as an edge class
      console.log("\n2️⃣  Creating PhotoAccess as edge class...");
      try {
        await db.query("CREATE CLASS PhotoAccess EXTENDS E");
        console.log("   ✓ PhotoAccess edge class created");
      } catch (e) {
        if (e.message.includes("already exists")) {
          console.log("   PhotoAccess edge class already exists");
        } else {
          throw e;
        }
      }

      // 3. Create PhotoAccess properties
      console.log("\n3️⃣  Creating PhotoAccess properties...");
      const photoAccessProps = [
        { name: "accessType", type: "STRING" },
        { name: "grantedAt", type: "DATETIME" },
        { name: "isActive", type: "BOOLEAN" },
      ];

      for (const prop of photoAccessProps) {
        try {
          await db.query(
            `CREATE PROPERTY PhotoAccess.${prop.name} ${prop.type}`
          );
          console.log(`   ✓ Created property ${prop.name}`);
        } catch (e) {
          if (e.message.includes("already exists")) {
            console.log(`   - Property ${prop.name} already exists`);
          } else {
            console.log(`   ⚠️  Error creating ${prop.name}:`, e.message);
          }
        }
      }

      // 4. Check if GuestAccess exists as a vertex class
      console.log("\n4️⃣  Checking GuestAccess class...");
      try {
        const guestAccessClass = await db.query(
          "SELECT FROM (SELECT expand(classes) FROM metadata:schema) WHERE name = 'GuestAccess'"
        );

        if (guestAccessClass.length > 0) {
          console.log("   GuestAccess class exists");

          // Check if there's any data
          const guestAccessData = await db.query(
            "SELECT count(*) as count FROM GuestAccess"
          );
          console.log(
            `   Found ${guestAccessData[0].count} GuestAccess records`
          );

          if (guestAccessData[0].count > 0) {
            console.log(
              "   ⚠️  WARNING: GuestAccess has data - backup recommended before migration"
            );
          }

          // Drop the vertex class
          console.log("   Dropping GuestAccess vertex class...");
          await db.query("DROP CLASS GuestAccess UNSAFE");
          console.log("   ✓ GuestAccess vertex class dropped");
        }
      } catch (e) {
        console.log("   GuestAccess class doesn't exist or error:", e.message);
      }

      // 5. Create GuestAccess as an edge class
      console.log("\n5️⃣  Creating GuestAccess as edge class...");
      try {
        await db.query("CREATE CLASS GuestAccess EXTENDS E");
        console.log("   ✓ GuestAccess edge class created");
      } catch (e) {
        if (e.message.includes("already exists")) {
          console.log("   GuestAccess edge class already exists");
        } else {
          throw e;
        }
      }

      // 6. Create GuestAccess properties
      console.log("\n6️⃣  Creating GuestAccess properties...");
      const guestAccessProps = [
        { name: "accessType", type: "STRING" },
        { name: "grantedAt", type: "DATETIME" },
        { name: "expiresAt", type: "DATETIME" },
        { name: "accessCount", type: "INTEGER" },
        { name: "maxAccessCount", type: "INTEGER" },
        { name: "isActive", type: "BOOLEAN" },
      ];

      for (const prop of guestAccessProps) {
        try {
          await db.query(
            `CREATE PROPERTY GuestAccess.${prop.name} ${prop.type}`
          );
          console.log(`   ✓ Created property ${prop.name}`);
        } catch (e) {
          if (e.message.includes("already exists")) {
            console.log(`   - Property ${prop.name} already exists`);
          } else {
            console.log(`   ⚠️  Error creating ${prop.name}:`, e.message);
          }
        }
      }

      console.log("\n✅ Migration complete!");
      console.log("\nNext steps:");
      console.log("- PhotoAccess is now an edge: Client -> Photo");
      console.log("- GuestAccess is now an edge: Guest -> Photo");
      console.log("- Use CREATE EDGE syntax to create access permissions");
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
  const migration = new ConvertAccessToEdges();
  migration
    .run()
    .then(() => {
      console.log("\n🎉 Migration completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n💥 Migration failed:", error);
      process.exit(1);
    });
}

module.exports = ConvertAccessToEdges;
