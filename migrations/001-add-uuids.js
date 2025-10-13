const Database = require("../Database/databaseClass");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();

class UUIDMigration {
  constructor() {
    this.dbInstance = new Database(
      process.env.DB_HOST,
      process.env.DB_PORT,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );
  }

  async run() {
    console.log("🚀 Starting UUID Migration...\n");

    const db = this.dbInstance.useDatabase(
      process.env.DB_NAME,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );

    try {
      // Step 1: Add UUID fields to User class
      console.log("📝 Step 1: Adding userId field to User records...");
      await this.migrateUsers(db);

      // Step 2: Add UUID fields to Photographer class
      console.log(
        "\n📝 Step 2: Adding photographerId field to Photographer records..."
      );
      await this.migratePhotographers(db);

      // Step 3: Add UUID fields to Client class
      console.log("\n📝 Step 3: Adding clientId field to Client records...");
      await this.migrateClients(db);

      // Step 4: Add UUID fields to PhotoCollection class
      console.log(
        "\n📝 Step 4: Adding collectionId field to PhotoCollection records..."
      );
      await this.migrateCollections(db);

      // Step 5: Add UUID fields to Photo class
      console.log("\n📝 Step 5: Adding photoId field to Photo records...");
      await this.migratePhotos(db);

      // Step 6: Add UUID fields to Guest class
      console.log("\n📝 Step 6: Adding guestId field to Guest records...");
      await this.migrateGuests(db);

      // Step 7: Update foreign key references
      console.log("\n📝 Step 7: Updating foreign key references...");
      await this.updateForeignKeys(db);

      // Step 8: Verify migration
      console.log("\n📝 Step 8: Verifying migration...");
      await this.verifyMigration(db);

      console.log("\n✅ Migration completed successfully!");
    } catch (error) {
      console.error("\n❌ Migration failed:", error);
      throw error;
    } finally {
      this.dbInstance.closeConnection();
    }
  }

  async migrateUsers(db) {
    const users = await db.query(
      "SELECT @rid as rid FROM User WHERE userId IS NULL"
    );
    console.log(`   Found ${users.length} users to migrate`);

    for (const user of users) {
      const userId = uuidv4();
      const rid = user.rid.toString();
      await db.query(
        `UPDATE User SET userId = '${userId}' WHERE @rid = ${rid}`
      );
    }
    console.log(`   ✓ Updated ${users.length} users with UUIDs`);
  }

  async migratePhotographers(db) {
    const photographers = await db.query(
      "SELECT @rid as rid FROM Photographer WHERE photographerId IS NULL"
    );
    console.log(`   Found ${photographers.length} photographers to migrate`);

    for (const photographer of photographers) {
      const photographerId = uuidv4();
      const rid = photographer.rid.toString();
      await db.query(
        `UPDATE Photographer SET photographerId = '${photographerId}' WHERE @rid = ${rid}`
      );
    }
    console.log(
      `   ✓ Updated ${photographers.length} photographers with UUIDs`
    );
  }

  async migrateClients(db) {
    const clients = await db.query(
      "SELECT @rid as rid FROM Client WHERE clientId IS NULL"
    );
    console.log(`   Found ${clients.length} clients to migrate`);

    for (const client of clients) {
      const clientId = uuidv4();
      const rid = client.rid.toString();
      await db.query(
        `UPDATE Client SET clientId = '${clientId}' WHERE @rid = ${rid}`
      );
    }
    console.log(`   ✓ Updated ${clients.length} clients with UUIDs`);
  }

  async migrateCollections(db) {
    const collections = await db.query(
      "SELECT @rid as rid FROM PhotoCollection WHERE collectionId IS NULL"
    );
    console.log(`   Found ${collections.length} collections to migrate`);

    for (const collection of collections) {
      const collectionId = uuidv4();
      const rid = collection.rid.toString();
      await db.query(
        `UPDATE PhotoCollection SET collectionId = '${collectionId}' WHERE @rid = ${rid}`
      );
    }
    console.log(`   ✓ Updated ${collections.length} collections with UUIDs`);
  }

  async migratePhotos(db) {
    const photos = await db.query(
      "SELECT @rid as rid FROM Photo WHERE photoId IS NULL"
    );
    console.log(`   Found ${photos.length} photos to migrate`);

    for (const photo of photos) {
      const photoId = uuidv4();
      const rid = photo.rid.toString();
      await db.query(
        `UPDATE Photo SET photoId = '${photoId}' WHERE @rid = ${rid}`
      );
    }
    console.log(`   ✓ Updated ${photos.length} photos with UUIDs`);
  }

  async migrateGuests(db) {
    const guests = await db.query(
      "SELECT @rid as rid FROM Guest WHERE guestId IS NULL"
    );
    console.log(`   Found ${guests.length} guests to migrate`);

    for (const guest of guests) {
      const guestId = uuidv4();
      const rid = guest.rid.toString();
      await db.query(
        `UPDATE Guest SET guestId = '${guestId}' WHERE @rid = ${rid}`
      );
    }
    console.log(`   ✓ Updated ${guests.length} guests with UUIDs`);
  }

  async updateForeignKeys(db) {
    // Update Photo.photographerId references
    console.log("   Updating Photo.photographerId references...");
    const photos = await db.query(
      `SELECT @rid as rid, photographerId FROM Photo WHERE photographerId LIKE '#%'`
    );

    for (const photo of photos) {
      const photographer = await db.query(
        `SELECT photographerId FROM Photographer WHERE @rid = ${photo.photographerId}`
      );

      if (photographer.length > 0 && photographer[0].photographerId) {
        await db.query(
          `UPDATE Photo SET photographerId = '${photographer[0].photographerId}' WHERE @rid = ${photo.rid}`
        );
      }
    }
    console.log(`   ✓ Updated ${photos.length} photo photographer references`);

    // Update Photo.collectionId references
    console.log("   Updating Photo.collectionId references...");
    const photosWithCollection = await db.query(
      `SELECT @rid as rid, collectionId FROM Photo WHERE collectionId LIKE '#%'`
    );

    for (const photo of photosWithCollection) {
      const collection = await db.query(
        `SELECT collectionId FROM PhotoCollection WHERE @rid = ${photo.collectionId}`
      );

      if (collection.length > 0 && collection[0].collectionId) {
        await db.query(
          `UPDATE Photo SET collectionId = '${collection[0].collectionId}' WHERE @rid = ${photo.rid}`
        );
      }
    }
    console.log(
      `   ✓ Updated ${photosWithCollection.length} photo collection references`
    );

    // Update Client.photographerId references
    console.log("   Updating Client.photographerId references...");
    const clients = await db.query(
      `SELECT @rid as rid, photographerId FROM Client WHERE photographerId LIKE '#%'`
    );

    for (const client of clients) {
      const photographer = await db.query(
        `SELECT photographerId FROM Photographer WHERE @rid = ${client.photographerId}`
      );

      if (photographer.length > 0 && photographer[0].photographerId) {
        await db.query(
          `UPDATE Client SET photographerId = '${photographer[0].photographerId}' WHERE @rid = ${client.rid}`
        );
      }
    }
    console.log(
      `   ✓ Updated ${clients.length} client photographer references`
    );

    // Update PhotoCollection.photographerId references
    console.log("   Updating PhotoCollection.photographerId references...");
    const collections = await db.query(
      `SELECT @rid as rid, photographerId FROM PhotoCollection WHERE photographerId LIKE '#%'`
    );

    for (const collection of collections) {
      const photographer = await db.query(
        `SELECT photographerId FROM Photographer WHERE @rid = ${collection.photographerId}`
      );

      if (photographer.length > 0 && photographer[0].photographerId) {
        await db.query(
          `UPDATE PhotoCollection SET photographerId = '${photographer[0].photographerId}' WHERE @rid = ${collection.rid}`
        );
      }
    }
    console.log(
      `   ✓ Updated ${collections.length} collection photographer references`
    );

    // Update Guest.clientId references
    console.log("   Updating Guest.clientId references...");
    const guests = await db.query(
      `SELECT @rid as rid, clientId FROM Guest WHERE clientId LIKE '#%'`
    );

    for (const guest of guests) {
      const client = await db.query(
        `SELECT clientId FROM Client WHERE @rid = ${guest.clientId}`
      );

      if (client.length > 0 && client[0].clientId) {
        await db.query(
          `UPDATE Guest SET clientId = '${client[0].clientId}' WHERE @rid = ${guest.rid}`
        );
      }
    }
    console.log(`   ✓ Updated ${guests.length} guest client references`);
  }

  async verifyMigration(db) {
    const checks = [
      { class: "User", field: "userId" },
      { class: "Photographer", field: "photographerId" },
      { class: "Client", field: "clientId" },
      { class: "PhotoCollection", field: "collectionId" },
      { class: "Photo", field: "photoId" },
      { class: "Guest", field: "guestId" },
    ];

    for (const check of checks) {
      const missing = await db.query(
        `SELECT count(*) as count FROM ${check.class} WHERE ${check.field} IS NULL`
      );

      if (missing[0].count > 0) {
        throw new Error(
          `${missing[0].count} ${check.class} records are missing ${check.field}!`
        );
      }

      const total = await db.query(
        `SELECT count(*) as count FROM ${check.class}`
      );
      console.log(
        `   ✓ ${check.class}: ${total[0].count} records, all have ${check.field}`
      );
    }

    // Check for remaining RID references
    const ridChecks = [
      { class: "Photo", field: "photographerId" },
      { class: "Photo", field: "collectionId" },
      { class: "Client", field: "photographerId" },
      { class: "PhotoCollection", field: "photographerId" },
      { class: "Guest", field: "clientId" },
    ];

    for (const check of ridChecks) {
      const ridRefs = await db.query(
        `SELECT count(*) as count FROM ${check.class} WHERE ${check.field} LIKE '#%'`
      );

      if (ridRefs[0].count > 0) {
        console.warn(
          `   ⚠️  Warning: ${ridRefs[0].count} ${check.class} records still have RID in ${check.field}`
        );
      }
    }
  }

  async rollback() {
    console.log("🔄 Rolling back migration...");
    const db = this.dbInstance.useDatabase(
      process.env.DB_NAME,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );

    try {
      // Remove UUID fields
      await db.query("UPDATE User REMOVE userId");
      await db.query("UPDATE Photographer REMOVE photographerId");
      await db.query("UPDATE Client REMOVE clientId");
      await db.query("UPDATE PhotoCollection REMOVE collectionId");
      await db.query("UPDATE Photo REMOVE photoId");
      await db.query("UPDATE Guest REMOVE guestId");

      console.log("✅ Rollback completed");
    } catch (error) {
      console.error("❌ Rollback failed:", error);
      throw error;
    } finally {
      this.dbInstance.closeConnection();
    }
  }
}

// Run migration if called directly
if (require.main === module) {
  const migration = new UUIDMigration();

  const args = process.argv.slice(2);

  if (args.includes("--rollback")) {
    migration
      .rollback()
      .then(() => process.exit(0))
      .catch((err) => {
        console.error(err);
        process.exit(1);
      });
  } else {
    migration
      .run()
      .then(() => process.exit(0))
      .catch((err) => {
        console.error(err);
        process.exit(1);
      });
  }
}

module.exports = UUIDMigration;
