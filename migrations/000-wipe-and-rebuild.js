require("dotenv").config();
const Database = require("../Database/databaseClass");

async function wipeAndRebuild() {
  console.log("🚨 WIPING DATABASE AND REBUILDING SCHEMA...");
  console.log("⚠️  This will DELETE ALL DATA!");

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

    // Step 1: Delete all vertices (this will cascade to edges)
    console.log("\n📋 Step 1: Deleting all vertices...");

    const classes = [
      "RefreshToken",
      "Photo",
      "PhotoCollection",
      "Guest",
      "Client",
      "Photographer",
      "User",
    ];

    for (const className of classes) {
      try {
        const result = await db.query(`DELETE VERTEX ${className}`);
        console.log(
          `   ✅ Deleted all ${className} vertices: ${result.length} records`
        );
      } catch (error) {
        console.log(
          `   ⚠️  ${className} class doesn't exist or is empty: ${error.message}`
        );
      }
    }

    // Step 2: Drop all classes
    console.log("\n📋 Step 2: Dropping all classes...");

    const allClasses = [
      "RefreshToken",
      "Photo",
      "PhotoCollection",
      "Guest",
      "Client",
      "Photographer",
      "User",
      "PhotoAccess",
      "CollectionAccess",
      "CollectionPhoto",
      "ClientGuests",
      "PhotographerClients",
    ];

    for (const className of allClasses) {
      try {
        await db.query(`DROP CLASS ${className} UNSAFE`);
        console.log(`   ✅ Dropped class ${className}`);
      } catch (error) {
        console.log(
          `   ⚠️  ${className} class doesn't exist: ${error.message}`
        );
      }
    }

    // Step 3: Recreate all vertex classes
    console.log("\n📋 Step 3: Creating vertex classes...");

    const vertexClasses = [
      "User",
      "Photographer",
      "Client",
      "Guest",
      "Photo",
      "PhotoCollection",
      "RefreshToken",
    ];

    for (const className of vertexClasses) {
      try {
        await db.query(`CREATE CLASS ${className} EXTENDS V`);
        console.log(`   ✅ Created class ${className}`);
      } catch (error) {
        console.log(`   ⚠️  ${className} already exists: ${error.message}`);
      }
    }

    // Step 4: Create edge classes
    console.log("\n📋 Step 4: Creating edge classes...");

    const edgeClasses = [
      "PhotoAccess",
      "CollectionAccess",
      "CollectionPhoto",
      "ClientGuests",
      "PhotographerClients",
    ];

    for (const className of edgeClasses) {
      try {
        await db.query(`CREATE CLASS ${className} EXTENDS E`);
        console.log(`   ✅ Created edge class ${className}`);
      } catch (error) {
        console.log(`   ⚠️  ${className} already exists: ${error.message}`);
      }
    }

    // Step 5: Create User properties
    console.log("\n📋 Step 5: Creating User properties...");
    const userProperties = [
      { name: "username", type: "STRING" },
      { name: "email", type: "STRING" },
      { name: "password", type: "STRING" },
      { name: "role", type: "STRING" },
      { name: "createdAt", type: "DATETIME" },
      { name: "lastLogin", type: "DATETIME" },
      { name: "mustChangePassword", type: "BOOLEAN" },
    ];

    for (const prop of userProperties) {
      try {
        await db.query(`CREATE PROPERTY User.${prop.name} ${prop.type}`);
        console.log(`   ✅ User.${prop.name} created`);
      } catch (e) {
        console.log(`   ⚠️  User.${prop.name} already exists`);
      }
    }

    // Step 6: Create Photographer properties
    console.log("\n📋 Step 6: Creating Photographer properties...");
    const photographerProperties = [
      { name: "photographerId", type: "STRING" },
      { name: "username", type: "STRING" },
      { name: "email", type: "STRING" },
      { name: "password", type: "STRING" },
      { name: "businessName", type: "STRING" },
      { name: "role", type: "STRING" },
      { name: "createdAt", type: "DATETIME" },
      { name: "lastLogin", type: "DATETIME" },
      { name: "isActive", type: "BOOLEAN" },
      { name: "createdBy", type: "STRING" },
      { name: "mustChangePassword", type: "BOOLEAN" },
      { name: "deletedAt", type: "DATETIME" },
      { name: "scheduledDeletionDate", type: "DATETIME" },
      { name: "deletionReason", type: "STRING" },
    ];

    for (const prop of photographerProperties) {
      try {
        await db.query(
          `CREATE PROPERTY Photographer.${prop.name} ${prop.type}`
        );
        console.log(`   ✅ Photographer.${prop.name} created`);
      } catch (e) {
        console.log(`   ⚠️  Photographer.${prop.name} already exists`);
      }
    }

    // Step 7: Create Client properties
    console.log("\n📋 Step 7: Creating Client properties...");
    const clientProperties = [
      { name: "clientId", type: "STRING" },
      { name: "username", type: "STRING" },
      { name: "encryptedEmail", type: "STRING" },
      { name: "password", type: "STRING" },
      { name: "clientName", type: "STRING" },
      { name: "role", type: "STRING" },
      { name: "photographerId", type: "STRING" },
      { name: "createdAt", type: "DATETIME" },
      { name: "lastLogin", type: "DATETIME" },
      { name: "isActive", type: "BOOLEAN" },
      { name: "notificationSent", type: "BOOLEAN" },
      { name: "mustChangePassword", type: "BOOLEAN" },
      { name: "deletedAt", type: "DATETIME" },
      { name: "scheduledDeletionDate", type: "DATETIME" },
      { name: "deletionReason", type: "STRING" },
    ];

    for (const prop of clientProperties) {
      try {
        await db.query(`CREATE PROPERTY Client.${prop.name} ${prop.type}`);
        console.log(`   ✅ Client.${prop.name} created`);
      } catch (e) {
        console.log(`   ⚠️  Client.${prop.name} already exists`);
      }
    }

    // Step 8: Create Guest properties
    console.log("\n📋 Step 8: Creating Guest properties...");
    const guestProperties = [
      { name: "guestId", type: "STRING" },
      { name: "clientId", type: "STRING" },
      { name: "username", type: "STRING" },
      { name: "encryptedEmail", type: "STRING" },
      { name: "password", type: "STRING" },
      { name: "guestName", type: "STRING" },
      { name: "role", type: "STRING" },
      { name: "createdAt", type: "DATETIME" },
      { name: "expiresAt", type: "DATETIME" },
      { name: "isActive", type: "BOOLEAN" },
      { name: "mustChangePassword", type: "BOOLEAN" },
      { name: "deletedAt", type: "DATETIME" },
      { name: "scheduledDeletionDate", type: "DATETIME" },
      { name: "deletionReason", type: "STRING" },
    ];

    for (const prop of guestProperties) {
      try {
        await db.query(`CREATE PROPERTY Guest.${prop.name} ${prop.type}`);
        console.log(`   ✅ Guest.${prop.name} created`);
      } catch (e) {
        console.log(`   ⚠️  Guest.${prop.name} already exists`);
      }
    }

    // Step 9: Create Photo properties
    console.log("\n📋 Step 9: Creating Photo properties...");
    const photoProperties = [
      { name: "photoId", type: "STRING" },
      { name: "filename", type: "STRING" },
      { name: "originalName", type: "STRING" },
      { name: "encryptedOriginalName", type: "STRING" },
      { name: "mimetype", type: "STRING" },
      { name: "size", type: "LONG" },
      { name: "width", type: "INTEGER" },
      { name: "height", type: "INTEGER" },
      { name: "shareToken", type: "STRING" },
      { name: "photoDataB64", type: "STRING" },
      { name: "encryptedPhotoData", type: "STRING" },
      { name: "thumbnailDataB64", type: "STRING" },
      { name: "photographerId", type: "STRING" },
      { name: "createdAt", type: "DATETIME" },
      { name: "uploadedAt", type: "DATETIME" },
      { name: "tags", type: "EMBEDDEDLIST" },
      { name: "metadata", type: "EMBEDDED" },
      { name: "isActive", type: "BOOLEAN" },
      { name: "deletedAt", type: "DATETIME" },
      { name: "scheduledDeletionDate", type: "DATETIME" },
      { name: "deletionReason", type: "STRING" },
    ];

    for (const prop of photoProperties) {
      try {
        await db.query(`CREATE PROPERTY Photo.${prop.name} ${prop.type}`);
        console.log(`   ✅ Photo.${prop.name} created`);
      } catch (e) {
        console.log(`   ⚠️  Photo.${prop.name} already exists`);
      }
    }

    // Step 10: Create PhotoCollection properties
    console.log("\n📋 Step 10: Creating PhotoCollection properties...");
    const collectionProperties = [
      { name: "collectionId", type: "STRING" },
      { name: "name", type: "STRING" },
      { name: "description", type: "STRING" },
      { name: "photographerId", type: "STRING" },
      { name: "coverPhotoId", type: "STRING" },
      { name: "isActive", type: "BOOLEAN" },
      { name: "createdAt", type: "DATETIME" },
      { name: "updatedAt", type: "DATETIME" },
      { name: "autoDeleteAt", type: "DATETIME" },
      { name: "deletedAt", type: "DATETIME" },
      { name: "scheduledDeletionDate", type: "DATETIME" },
      { name: "deletionReason", type: "STRING" },
    ];

    for (const prop of collectionProperties) {
      try {
        await db.query(
          `CREATE PROPERTY PhotoCollection.${prop.name} ${prop.type}`
        );
        console.log(`   ✅ PhotoCollection.${prop.name} created`);
      } catch (e) {
        console.log(`   ⚠️  PhotoCollection.${prop.name} already exists`);
      }
    }

    // Step 10.5: Create RefreshToken properties
    console.log("\n📋 Step 10.5: Creating RefreshToken properties...");
    const refreshTokenProperties = [
      { name: "token", type: "STRING" },
      { name: "sessionId", type: "STRING" },
      { name: "userId", type: "STRING" },
      { name: "userRole", type: "STRING" },
      { name: "expiresAt", type: "DATETIME" },
      { name: "createdAt", type: "DATETIME" },
      { name: "ipAddress", type: "STRING" },
      { name: "userAgent", type: "STRING" },
    ];

    for (const prop of refreshTokenProperties) {
      try {
        await db.query(
          `CREATE PROPERTY RefreshToken.${prop.name} ${prop.type}`
        );
        console.log(`   ✅ RefreshToken.${prop.name} created`);
      } catch (e) {
        console.log(`   ⚠️  RefreshToken.${prop.name} already exists`);
      }
    }

    // Step 11: Create indexes
    console.log("\n📋 Step 11: Creating indexes...");

    const indexes = [
      { class: "User", field: "username", unique: true },
      { class: "User", field: "email", unique: true },
      { class: "Photographer", field: "photographerId", unique: true },
      { class: "Photographer", field: "username", unique: true },
      { class: "Photographer", field: "email", unique: true },
      { class: "Client", field: "clientId", unique: true },
      { class: "Client", field: "username", unique: true },
      { class: "Guest", field: "guestId", unique: true },
      { class: "Guest", field: "username", unique: true },
      { class: "Photo", field: "photoId", unique: true },
      { class: "Photo", field: "shareToken", unique: true },
      { class: "PhotoCollection", field: "collectionId", unique: true },
      { class: "RefreshToken", field: "token", unique: true },
      { class: "RefreshToken", field: "sessionId", unique: true },
    ];

    for (const idx of indexes) {
      try {
        const uniqueStr = idx.unique ? "UNIQUE" : "";
        await db.query(`CREATE INDEX ${idx.class}.${idx.field} ${uniqueStr}`);
        console.log(`   ✅ ${idx.class}.${idx.field} index created`);
      } catch (e) {
        console.log(`   ⚠️  ${idx.class}.${idx.field} index already exists`);
      }
    }

    console.log("\n✅ Database wiped and schema rebuilt successfully!");
    console.log("⚠️  Remember to run the create-admin migration next!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    dbInstance.closeConnection();
  }
}

// Run the migration
wipeAndRebuild()
  .then(() => {
    console.log("\n🎉 Migration completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  });
