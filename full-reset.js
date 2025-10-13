const Database = require("./Database/databaseClass");
require("dotenv").config();

async function fullReset() {
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
    console.log("🗑️  Deleting all edges and vertices...");
    
    try {
      await db.query("DELETE EDGE CollectionPhoto");
      console.log("   ✓ Deleted CollectionPhoto edges");
    } catch (e) {
      console.log("   ⚠️  No CollectionPhoto edges to delete");
    }
    
    try {
      await db.query("DELETE EDGE CollectionAccess");
      console.log("   ✓ Deleted CollectionAccess edges");
    } catch (e) {
      console.log("   ⚠️  No CollectionAccess edges to delete");
    }
    
    try {
      await db.query("DELETE VERTEX PhotoCollection UNSAFE");
      console.log("   ✓ Deleted PhotoCollection vertices");
    } catch (e) {
      console.log("   ⚠️  No PhotoCollection vertices to delete");
    }
    
    console.log("\n🔨 Dropping classes...");
    
    try {
      await db.query("DROP CLASS CollectionPhoto UNSAFE");
      console.log("   ✓ Dropped CollectionPhoto class");
    } catch (e) {
      console.log("   ⚠️  CollectionPhoto class doesn't exist");
    }
    
    try {
      await db.query("DROP CLASS CollectionAccess UNSAFE");
      console.log("   ✓ Dropped CollectionAccess class");
    } catch (e) {
      console.log("   ⚠️  CollectionAccess class doesn't exist");
    }
    
    try {
      await db.query("DROP CLASS PhotoCollection UNSAFE");
      console.log("   ✓ Dropped PhotoCollection class");
    } catch (e) {
      console.log("   ⚠️  PhotoCollection class doesn't exist");
    }
    
    console.log("\n✅ Full reset complete!");
    console.log("\nNow run: node migrations/006-add-photocollections.js");
    
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    dbInstance.closeConnection();
    process.exit(0);
  }
}

fullReset();
