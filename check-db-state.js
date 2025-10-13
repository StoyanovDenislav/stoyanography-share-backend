const Database = require("./Database/databaseClass");
require("dotenv").config();

async function checkState() {
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
    // Check class definition
    console.log("Checking PhotoCollection class...");
    const classInfo = await db.query("SELECT FROM (SELECT expand(classes) FROM metadata:schema) WHERE name = 'PhotoCollection'");
    console.log("Class info:", JSON.stringify(classInfo, null, 2));
    
    // Try to create a test collection using CREATE VERTEX
    console.log("\n\nTrying CREATE VERTEX...");
    const testResult = await db.query(`
      CREATE VERTEX PhotoCollection SET 
        collectionId = 'test-uuid-123',
        name = 'Test Collection',
        description = 'Test',
        photographerId = '#38:1',
        isActive = true,
        createdAt = sysdate(),
        updatedAt = sysdate()
      RETURN @rid, collectionId
    `);
    
    console.log("Test creation result:", testResult);
    
    if (testResult && testResult.length > 0) {
      const rid = testResult[0]["@rid"];
      console.log("\nTest RID:", rid);
      console.log("RID cluster:", rid.cluster);
      console.log("RID position:", rid.position);
      
      // Delete the test record
      await db.query(`DELETE VERTEX PhotoCollection WHERE collectionId = 'test-uuid-123'`);
      console.log("Test record deleted");
    }
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    dbInstance.closeConnection();
    process.exit(0);
  }
}

checkState();
