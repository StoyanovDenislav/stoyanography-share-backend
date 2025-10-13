const Database = require("./Database/databaseClass");
require("dotenv").config();

async function reset() {
  const dbInstance = new Database(
    process.env.DB_HOST,
    process.env.DB_PORT,
    process.env.DB_USERNAME,
    process.env.DB_PASSWORD
  );

  const db = dbInstance.useDatabase(
    process.env.DB_NAME,
    process.env.DB_USERNAME,
    process.env.DB_PASSWORD
  );

  try {
    console.log("Deleting all CollectionPhoto edges...");
    await db.query("DELETE EDGE CollectionPhoto");
    
    console.log("Deleting all CollectionAccess edges...");
    await db.query("DELETE EDGE CollectionAccess");
    
    console.log("Deleting all PhotoCollection vertices...");
    await db.query("DELETE VERTEX PhotoCollection");
    
    console.log("\nDropping and recreating classes...");
    
    // Drop classes
    try {
      await db.query("DROP CLASS CollectionPhoto UNSAFE");
      await db.query("DROP CLASS CollectionAccess UNSAFE");
      await db.query("DROP CLASS PhotoCollection UNSAFE");
    } catch (e) {
      console.log("Some classes didn't exist, continuing...");
    }
    
    console.log("\nDone! Now run the migration again:");
    console.log("node migrations/006-add-photocollections.js");
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    dbInstance.closeConnection();
    process.exit(0);
  }
}

reset();
