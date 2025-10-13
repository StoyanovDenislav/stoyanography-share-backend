const Database = require("./Database/databaseClass");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();

async function test() {
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
    const collectionId = uuidv4();
    console.log("Creating test collection with UUID:", collectionId);
    
    const result = await db.query(
      `CREATE VERTEX PhotoCollection SET 
       collectionId = :collectionId,
       name = :name,
       description = :description,
       photographerId = :photographerId,
       isActive = true,
       createdAt = sysdate(),
       updatedAt = sysdate()
       RETURN @rid, collectionId`,
      {
        params: {
          collectionId,
          name: "Test Collection",
          description: "Testing RID assignment",
          photographerId: "#38:1",
        },
      }
    );
    
    console.log("\n✅ Result:", result);
    
    if (result && result.length > 0) {
      const rid = result[0]["@rid"];
      console.log("\n📍 RID:", rid.toString());
      console.log("   Cluster:", rid.cluster);
      console.log("   Position:", rid.position);
      
      // Verify we can query it back
      const verify = await db.query(
        `SELECT @rid, collectionId, name FROM PhotoCollection WHERE collectionId = :collectionId`,
        { params: { collectionId } }
      );
      
      console.log("\n✅ Verification query:", verify);
      
      // Clean up
      await db.query(`DELETE VERTEX PhotoCollection WHERE collectionId = :collectionId`, 
        { params: { collectionId } });
      console.log("\n🗑️  Test record deleted");
    }
    
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    dbInstance.closeConnection();
    process.exit(0);
  }
}

test();
