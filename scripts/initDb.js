require("dotenv").config();
const Database = require("../Database/databaseClass");

async function initializeDatabase() {
  const dbInstance = new Database(
    process.env.DB_HOST,
    process.env.DB_PORT,
    process.env.DB_USERNAME,
    process.env.DB_PASSWORD
  );

  try {
    console.log("Connecting to database...");
    const db = dbInstance.useDatabase(
      process.env.DB_NAME,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );

    // Create User class (for admin users)
    console.log("Creating User class...");
    try {
      await db.query("CREATE CLASS User EXTENDS V");
      console.log("User class created successfully");
    } catch (e) {
      if (e.message.includes("already exists")) {
        console.log("User class already exists");
      } else {
        console.error("Error creating User class:", e.message);
      }
    }

    // Create Client class (for photo sharing clients)
    console.log("Creating Client class...");
    try {
      await db.query("CREATE CLASS Client EXTENDS V");
      console.log("Client class created successfully");
    } catch (e) {
      if (e.message.includes("already exists")) {
        console.log("Client class already exists");
      } else {
        console.error("Error creating Client class:", e.message);
      }
    }

    // Create Guest class (for temporary access)
    console.log("Creating Guest class...");
    try {
      await db.query("CREATE CLASS Guest EXTENDS V");
      console.log("Guest class created successfully");
    } catch (e) {
      if (e.message.includes("already exists")) {
        console.log("Guest class already exists");
      } else {
        console.error("Error creating Guest class:", e.message);
      }
    }

    // Create Photo class
    console.log("Creating Photo class...");
    try {
      await db.query("CREATE CLASS Photo EXTENDS V");
      console.log("Photo class created successfully");
    } catch (e) {
      if (e.message.includes("already exists")) {
        console.log("Photo class already exists");
      } else {
        console.error("Error creating Photo class:", e.message);
      }
    }

    // Create User properties
    console.log("Creating User properties...");
    const userProperties = [
      { name: "username", type: "STRING" },
      { name: "email", type: "STRING" },
      { name: "password", type: "STRING" },
      { name: "createdAt", type: "DATETIME" },
      { name: "lastLogin", type: "DATETIME" },
    ];

    for (const prop of userProperties) {
      try {
        await db.query(`CREATE PROPERTY User.${prop.name} ${prop.type}`);
        console.log(`User property ${prop.name} created`);
      } catch (e) {
        if (e.message.includes("already exists")) {
          console.log(`User property ${prop.name} already exists`);
        }
      }
    }

    // Create Photographer properties
    console.log("Creating Photographer properties...");
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
      // Soft delete fields
      { name: "deletedAt", type: "DATETIME" },
      { name: "scheduledDeletionDate", type: "DATETIME" },
      { name: "deletionReason", type: "STRING" },
    ];

    for (const prop of photographerProperties) {
      try {
        await db.query(
          `CREATE PROPERTY Photographer.${prop.name} ${prop.type}`
        );
        console.log(`Photographer property ${prop.name} created`);
      } catch (e) {
        if (e.message.includes("already exists")) {
          console.log(`Photographer property ${prop.name} already exists`);
        }
      }
    }

    // Create Client properties
    console.log("Creating Client properties...");
    const clientProperties = [
      { name: "clientId", type: "STRING" },
      { name: "username", type: "STRING" },
      { name: "email", type: "STRING" },
      { name: "plainEmail", type: "STRING" },
      { name: "password", type: "STRING" },
      { name: "createdAt", type: "DATETIME" },
      { name: "lastLogin", type: "DATETIME" },
      { name: "isActive", type: "BOOLEAN" },
      { name: "deactivatedAt", type: "DATETIME" },
      // Soft delete fields
      { name: "deletedAt", type: "DATETIME" },
      { name: "scheduledDeletionDate", type: "DATETIME" },
      { name: "deletionReason", type: "STRING" },
    ];

    for (const prop of clientProperties) {
      try {
        await db.query(`CREATE PROPERTY Client.${prop.name} ${prop.type}`);
        console.log(`Client property ${prop.name} created`);
      } catch (e) {
        if (e.message.includes("already exists")) {
          console.log(`Client property ${prop.name} already exists`);
        }
      }
    }

    // Create Guest properties
    console.log("Creating Guest properties...");
    const guestProperties = [
      { name: "guestId", type: "STRING" },
      { name: "username", type: "STRING" },
      { name: "email", type: "STRING" },
      { name: "password", type: "STRING" },
      { name: "guestName", type: "STRING" },
      { name: "createdAt", type: "DATETIME" },
      { name: "expiresAt", type: "DATETIME" },
      { name: "isActive", type: "BOOLEAN" },
      { name: "clientId", type: "STRING" },
      // Soft delete fields
      { name: "deletedAt", type: "DATETIME" },
      { name: "scheduledDeletionDate", type: "DATETIME" },
      { name: "deletionReason", type: "STRING" },
    ];

    for (const prop of guestProperties) {
      try {
        await db.query(`CREATE PROPERTY Guest.${prop.name} ${prop.type}`);
        console.log(`Guest property ${prop.name} created`);
      } catch (e) {
        if (e.message.includes("already exists")) {
          console.log(`Guest property ${prop.name} already exists`);
        }
      }
    }

    // Create Photo properties
    console.log("Creating Photo properties...");
    const photoProperties = [
      { name: "clientId", type: "STRING" },
      { name: "filename", type: "STRING" },
      { name: "originalName", type: "STRING" },
      { name: "mimetype", type: "STRING" },
      { name: "size", type: "LONG" },
      { name: "shareToken", type: "STRING" },
      { name: "uploadedAt", type: "DATETIME" },
      { name: "isActive", type: "BOOLEAN" },
      { name: "deletedAt", type: "DATETIME" },
    ];

    for (const prop of photoProperties) {
      try {
        await db.query(`CREATE PROPERTY Photo.${prop.name} ${prop.type}`);
        console.log(`Photo property ${prop.name} created`);
      } catch (e) {
        if (e.message.includes("already exists")) {
          console.log(`Photo property ${prop.name} already exists`);
        }
      }
    }

    // Create indexes
    console.log("Creating indexes...");

    // Photographer indexes
    try {
      await db.query("CREATE INDEX Photographer.photographerId UNIQUE");
      console.log("Photographer photographerId index created");
    } catch (e) {
      if (e.message.includes("already exists")) {
        console.log("Photographer photographerId index already exists");
      }
    }

    try {
      await db.query("CREATE INDEX Photographer.username UNIQUE");
      console.log("Photographer username index created");
    } catch (e) {
      if (e.message.includes("already exists")) {
        console.log("Photographer username index already exists");
      }
    }

    try {
      await db.query("CREATE INDEX Photographer.email UNIQUE");
      console.log("Photographer email index created");
    } catch (e) {
      if (e.message.includes("already exists")) {
        console.log("Photographer email index already exists");
      }
    }

    // User indexes
    try {
      await db.query("CREATE INDEX User.username UNIQUE");
      console.log("User username index created");
    } catch (e) {
      if (e.message.includes("already exists")) {
        console.log("User username index already exists");
      }
    }

    try {
      await db.query("CREATE INDEX User.email UNIQUE");
      console.log("User email index created");
    } catch (e) {
      if (e.message.includes("already exists")) {
        console.log("User email index already exists");
      }
    }

    // Client indexes
    try {
      await db.query("CREATE INDEX Client.clientId UNIQUE");
      console.log("Client clientId index created");
    } catch (e) {
      if (e.message.includes("already exists")) {
        console.log("Client clientId index already exists");
      }
    }

    try {
      await db.query("CREATE INDEX Client.username UNIQUE");
      console.log("Client username index created");
    } catch (e) {
      if (e.message.includes("already exists")) {
        console.log("Client username index already exists");
      }
    }

    try {
      await db.query("CREATE INDEX Client.plainEmail UNIQUE");
      console.log("Client email index created");
    } catch (e) {
      if (e.message.includes("already exists")) {
        console.log("Client email index already exists");
      }
    }

    // Guest indexes
    try {
      await db.query("CREATE INDEX Guest.guestId UNIQUE");
      console.log("Guest guestId index created");
    } catch (e) {
      if (e.message.includes("already exists")) {
        console.log("Guest guestId index already exists");
      }
    }

    try {
      await db.query("CREATE INDEX Guest.username UNIQUE");
      console.log("Guest username index created");
    } catch (e) {
      if (e.message.includes("already exists")) {
        console.log("Guest username index already exists");
      }
    }

    // Photo indexes
    try {
      await db.query("CREATE INDEX Photo.shareToken UNIQUE");
      console.log("Photo shareToken index created");
    } catch (e) {
      if (e.message.includes("already exists")) {
        console.log("Photo shareToken index already exists");
      }
    }

    try {
      await db.query("CREATE INDEX Photo.clientId");
      console.log("Photo clientId index created");
    } catch (e) {
      if (e.message.includes("already exists")) {
        console.log("Photo clientId index already exists");
      }
    }

    console.log("Database initialization completed successfully!");
  } catch (error) {
    console.error("Database initialization failed:", error);
  } finally {
    dbInstance.closeConnection();
  }
}

if (require.main === module) {
  initializeDatabase();
}

module.exports = initializeDatabase;
