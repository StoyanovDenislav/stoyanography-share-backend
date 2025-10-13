const Database = require("./Database/databaseClass");
require("dotenv").config();

async function cleanInvalidEdges() {
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
    console.log("Checking for invalid CollectionPhoto edges...");
    
    // Get all CollectionPhoto edges
    const edges = await db.query("SELECT @rid, out, in FROM CollectionPhoto");
    console.log(`Found ${edges.length} total edges`);
    
    let deletedCount = 0;
    
    for (const edge of edges) {
      const outRid = edge.out;
      const inRid = edge.in;
      
      // Check if RIDs contain -2 (invalid temporary RID)
      if (outRid.toString().includes('-2:') || inRid.toString().includes('-2:')) {
        console.log(`Deleting invalid edge: ${edge["@rid"]} (out: ${outRid}, in: ${inRid})`);
        await db.query(`DELETE EDGE ${edge["@rid"]}`);
        deletedCount++;
      }
    }
    
    console.log(`\nCleaned up ${deletedCount} invalid edges`);
    console.log("Done!");
    
  } catch (error) {
    console.error("Error cleaning edges:", error);
  } finally {
    dbInstance.closeConnection();
    process.exit(0);
  }
}

cleanInvalidEdges();
