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

    // Create all classes
    const classes = [
      { name: "User", description: "System administrators" },
      {
        name: "Photographer",
        description: "Photo uploaders and client managers",
      },
      { name: "Client", description: "Photo viewers and guest managers" },
      { name: "Guest", description: "Temporary photo viewers" },
      { name: "Photo", description: "Photo storage with metadata" },
      { name: "PhotoGroup", description: "Photo organization groups" },
      { name: "PhotoAccess", description: "Access permissions for photos" },
      { name: "GuestAccess", description: "Guest access to specific photos" },
    ];

    for (const cls of classes) {
      console.log(`Creating ${cls.name} class (${cls.description})...`);
      try {
        await db.query(`CREATE CLASS ${cls.name} EXTENDS V`);
        console.log(`${cls.name} class created successfully`);
      } catch (e) {
        if (e.message.includes("already exists")) {
          console.log(`${cls.name} class already exists`);
        } else {
          console.error(`Error creating ${cls.name} class:`, e.message);
        }
      }
    }

    // User properties (Administrator)
    console.log("Creating User properties...");
    const userProperties = [
      { name: "username", type: "STRING" },
      { name: "email", type: "STRING" },
      { name: "password", type: "STRING" },
      { name: "role", type: "STRING" }, // 'admin'
      { name: "createdAt", type: "DATETIME" },
      { name: "lastLogin", type: "DATETIME" },
      { name: "isActive", type: "BOOLEAN" },
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

    // Photographer properties
    console.log("Creating Photographer properties...");
    const photographerProperties = [
      { name: "username", type: "STRING" },
      { name: "email", type: "STRING" },
      { name: "password", type: "STRING" },
      { name: "businessName", type: "STRING" },
      { name: "role", type: "STRING" }, // 'photographer'
      { name: "createdAt", type: "DATETIME" },
      { name: "lastLogin", type: "DATETIME" },
      { name: "isActive", type: "BOOLEAN" },
      { name: "createdBy", type: "STRING" }, // Admin who created this photographer
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

    // Client properties
    console.log("Creating Client properties...");
    const clientProperties = [
      { name: "username", type: "STRING" },
      { name: "encryptedEmail", type: "STRING" }, // Only encrypted email stored
      { name: "password", type: "STRING" },
      { name: "clientName", type: "STRING" },
      { name: "role", type: "STRING" }, // 'client'
      { name: "photographerId", type: "STRING" },
      { name: "createdAt", type: "DATETIME" },
      { name: "lastLogin", type: "DATETIME" },
      { name: "isActive", type: "BOOLEAN" },
      { name: "notificationSent", type: "BOOLEAN" },
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

    // Guest properties
    console.log("Creating Guest properties...");
    const guestProperties = [
      { name: "username", type: "STRING" },
      { name: "encryptedEmail", type: "STRING" }, // Only encrypted email stored
      { name: "password", type: "STRING" },
      { name: "guestName", type: "STRING" },
      { name: "role", type: "STRING" }, // 'guest'
      { name: "clientId", type: "STRING" },
      { name: "createdAt", type: "DATETIME" },
      { name: "lastLogin", type: "DATETIME" },
      { name: "expiresAt", type: "DATETIME" },
      { name: "isActive", type: "BOOLEAN" },
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

    // Photo properties (with B64 storage)
    console.log("Creating Photo properties...");
    const photoProperties = [
      { name: "photographerId", type: "STRING" },
      { name: "filename", type: "STRING" },
      { name: "originalName", type: "STRING" },
      { name: "encryptedOriginalName", type: "STRING" },
      { name: "mimetype", type: "STRING" },
      { name: "size", type: "LONG" },
      { name: "width", type: "INTEGER" },
      { name: "height", type: "INTEGER" },
      { name: "photoDataB64", type: "STRING" }, // Base64 encoded photo
      { name: "thumbnailDataB64", type: "STRING" }, // Base64 encoded thumbnail
      { name: "encryptedPhotoData", type: "STRING" }, // Encrypted photo data
      { name: "shareToken", type: "STRING" },
      { name: "uploadedAt", type: "DATETIME" },
      { name: "isActive", type: "BOOLEAN" },
      { name: "tags", type: "EMBEDDEDLIST STRING" }, // Photo tags for organization
      { name: "metadata", type: "EMBEDDED" }, // EXIF and other metadata
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

    // PhotoGroup properties
    console.log("Creating PhotoGroup properties...");
    const photoGroupProperties = [
      { name: "groupName", type: "STRING" },
      { name: "description", type: "STRING" },
      { name: "photographerId", type: "STRING" },
      { name: "createdAt", type: "DATETIME" },
      { name: "isActive", type: "BOOLEAN" },
      { name: "photoIds", type: "EMBEDDEDLIST STRING" }, // List of photo IDs
      { name: "clientIds", type: "EMBEDDEDLIST STRING" }, // List of client IDs with access
    ];

    for (const prop of photoGroupProperties) {
      try {
        await db.query(`CREATE PROPERTY PhotoGroup.${prop.name} ${prop.type}`);
        console.log(`PhotoGroup property ${prop.name} created`);
      } catch (e) {
        if (e.message.includes("already exists")) {
          console.log(`PhotoGroup property ${prop.name} already exists`);
        }
      }
    }

    // PhotoAccess properties (fine-grained permissions)
    console.log("Creating PhotoAccess properties...");
    const photoAccessProperties = [
      { name: "photoId", type: "STRING" },
      { name: "userId", type: "STRING" }, // Can be client or guest ID
      { name: "userType", type: "STRING" }, // 'client' or 'guest'
      { name: "accessType", type: "STRING" }, // 'view', 'download', 'share'
      { name: "grantedBy", type: "STRING" }, // Who granted this access
      { name: "grantedAt", type: "DATETIME" },
      { name: "expiresAt", type: "DATETIME" },
      { name: "isActive", type: "BOOLEAN" },
    ];

    for (const prop of photoAccessProperties) {
      try {
        await db.query(`CREATE PROPERTY PhotoAccess.${prop.name} ${prop.type}`);
        console.log(`PhotoAccess property ${prop.name} created`);
      } catch (e) {
        if (e.message.includes("already exists")) {
          console.log(`PhotoAccess property ${prop.name} already exists`);
        }
      }
    }

    // GuestAccess properties (specific photo sharing to guests)
    console.log("Creating GuestAccess properties...");
    const guestAccessProperties = [
      { name: "guestId", type: "STRING" },
      { name: "photoIds", type: "EMBEDDEDLIST STRING" },
      { name: "sharedBy", type: "STRING" }, // Client ID who shared
      { name: "sharedAt", type: "DATETIME" },
      { name: "expiresAt", type: "DATETIME" },
      { name: "accessCount", type: "INTEGER" },
      { name: "maxAccessCount", type: "INTEGER" },
      { name: "isActive", type: "BOOLEAN" },
    ];

    for (const prop of guestAccessProperties) {
      try {
        await db.query(`CREATE PROPERTY GuestAccess.${prop.name} ${prop.type}`);
        console.log(`GuestAccess property ${prop.name} created`);
      } catch (e) {
        if (e.message.includes("already exists")) {
          console.log(`GuestAccess property ${prop.name} already exists`);
        }
      }
    }

    // Create indexes for performance
    console.log("Creating indexes...");

    const indexes = [
      // User indexes
      { table: "User", field: "username", unique: true },
      { table: "User", field: "email", unique: true },

      // Photographer indexes
      { table: "Photographer", field: "username", unique: true },
      { table: "Photographer", field: "email", unique: true },

      // Client indexes
      { table: "Client", field: "username", unique: true },
      { table: "Client", field: "encryptedEmail", unique: false }, // Changed from email to encryptedEmail
      { table: "Client", field: "photographerId", unique: false },

      // Guest indexes
      { table: "Guest", field: "username", unique: true },
      { table: "Guest", field: "clientId", unique: false },

      // Photo indexes
      { table: "Photo", field: "shareToken", unique: true },
      { table: "Photo", field: "photographerId", unique: false },
      { table: "Photo", field: "uploadedAt", unique: false },

      // Group indexes
      { table: "PhotoGroup", field: "photographerId", unique: false },

      // Access indexes
      { table: "PhotoAccess", field: "photoId", unique: false },
      { table: "PhotoAccess", field: "userId", unique: false },
      { table: "GuestAccess", field: "guestId", unique: false },
    ];

    for (const index of indexes) {
      try {
        let indexQuery;
        if (index.unique) {
          indexQuery = `CREATE INDEX ${index.table}_${index.field}_idx ON ${index.table} (${index.field}) UNIQUE`;
        } else {
          indexQuery = `CREATE INDEX ${index.table}_${index.field}_idx ON ${index.table} (${index.field}) NOTUNIQUE`;
        }
        await db.query(indexQuery);
        console.log(`${index.table}.${index.field} index created`);
      } catch (e) {
        if (e.message.includes("already exists")) {
          console.log(`${index.table}.${index.field} index already exists`);
        } else {
          console.log(
            `${index.table}.${index.field} index creation failed:`,
            e.message
          );
        }
      }
    }

    // Create default admin user
    console.log("Creating default admin user...");
    try {
      const bcrypt = require("bcrypt");
      const hashedPassword = await bcrypt.hash("admin123", 12);

      // OrientDB uses specific date format
      const currentDate = new Date();
      const formattedDate =
        currentDate.getFullYear() +
        "-" +
        String(currentDate.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(currentDate.getDate()).padStart(2, "0") +
        " " +
        String(currentDate.getHours()).padStart(2, "0") +
        ":" +
        String(currentDate.getMinutes()).padStart(2, "0") +
        ":" +
        String(currentDate.getSeconds()).padStart(2, "0");

      await db.query(
        `
        INSERT INTO User SET 
        username = 'admin', 
        email = 'admin@stoyanography.com', 
        password = :password, 
        role = 'admin',
        createdAt = date(:createdAt, 'yyyy-MM-dd HH:mm:ss'),
        isActive = true
      `,
        {
          params: {
            password: hashedPassword,
            createdAt: formattedDate,
          },
        }
      );
      console.log(
        "Default admin user created (username: admin, password: admin123)"
      );
    } catch (e) {
      if (
        e.message.includes("duplicate") ||
        e.message.includes("already exists")
      ) {
        console.log("Default admin user already exists");
      } else {
        console.log("Failed to create default admin user:", e.message);
      }
    }

    console.log("\n🎉 Database initialization completed successfully!");
    console.log("\nDefault admin credentials:");
    console.log("Username: admin");
    console.log("Password: admin123");
    console.log("\nPlease change the default password after first login.");
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
