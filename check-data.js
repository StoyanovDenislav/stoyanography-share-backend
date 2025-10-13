const Database = require("./Database/databaseClass");
require("dotenv").config();

async function checkData() {
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
    console.log("Checking PhotoCollections...");
    const collections = await db.query("SELECT @rid, collectionId, name, photographerId FROM PhotoCollection WHERE isActive = true");
    console.log(`Found ${collections.length} collections:`);
    collections.forEach(c => {
      console.log(`  - ${c.name} (${c.collectionId}), RID: ${c["@rid"]}, Photographer: ${c.photographerId}`);
    });
    
    console.log("\nChecking Photos...");
    const photos = await db.query("SELECT @rid, filename, photographerId FROM Photo WHERE isActive = true LIMIT 5");
    console.log(`Found ${photos.length} recent photos:`);
    photos.forEach(p => {
      console.log(`  - ${p.filename}, RID: ${p["@rid"]}, Photographer: ${p.photographerId}`);
    });
    
    console.log("\nChecking CollectionPhoto edges...");
    const edges = await db.query("SELECT @rid, out, in FROM CollectionPhoto");
    console.log(`Found ${edges.length} edges:`);
    for (const edge of edges) {
      console.log(`  - Edge RID: ${edge["@rid"]}`);
      console.log(`    out (collection): ${edge.out}`);
      console.log(`    in (photo): ${edge.in}`);
      
      // Try to get the collection details
      try {
        const coll = await db.query(`SELECT collectionId FROM PhotoCollection WHERE @rid = ${edge.out}`);
        if (coll.length > 0) {
          console.log(`    Collection ID: ${coll[0].collectionId}`);
        }
      } catch (e) {
        console.log(`    ERROR getting collection: ${e.message}`);
      }
    }
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    dbInstance.closeConnection();
    process.exit(0);
  }
}

checkData();
