const fs = require("fs");
const path = require("path");

/**
 * Automated RID to UUID Migration Script
 *
 * This script converts all RID-based queries to UUID-based queries across service files.
 *
 * Strategy:
 * 1. For queries that return data: Change @rid to appropriate UUID field
 * 2. For queries that filter/update: Change WHERE @rid = :param to WHERE {entity}Id = :param
 * 3. For edge creation: Keep RID retrieval but query by UUID first
 *
 * BACKUP: Creates .backup files before modifying
 */

class RidToUuidMigration {
  constructor() {
    this.servicesDir = path.join(__dirname, "../services");
    this.backupDir = path.join(__dirname, "../services/.backups");
    this.replacements = [];
    this.errors = [];

    // Ensure backup directory exists
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  /**
   * Main migration function
   */
  async migrate() {
    console.log("🚀 Starting RID to UUID Migration\n");
    console.log("⚠️  This will modify multiple service files");
    console.log("✅ Backups will be created before modification\n");

    const serviceFiles = [
      "authService.js",
      "clientService.js",
      "photographerService.js",
      "guestService.js",
      "photoService.js",
      "enhancedPhotoService.js",
    ];

    for (const file of serviceFiles) {
      await this.migrateServiceFile(file);
    }

    this.printSummary();
  }

  /**
   * Migrate a single service file
   */
  async migrateServiceFile(filename) {
    const filePath = path.join(this.servicesDir, filename);

    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  Skipping ${filename} - file not found`);
      return;
    }

    console.log(`\n📄 Processing ${filename}...`);

    // Create backup
    const backupPath = path.join(this.backupDir, `${filename}.backup`);
    fs.copyFileSync(filePath, backupPath);
    console.log(`   ✓ Backup created: ${backupPath}`);

    // Read file content
    let content = fs.readFileSync(filePath, "utf8");
    const originalContent = content;
    let changeCount = 0;

    // Apply transformations based on service type
    switch (filename) {
      case "authService.js":
        ({ content, count: changeCount } = this.migrateAuthService(content));
        break;
      case "clientService.js":
        ({ content, count: changeCount } = this.migrateClientService(content));
        break;
      case "photographerService.js":
        ({ content, count: changeCount } =
          this.migratePhotographerService(content));
        break;
      case "guestService.js":
        ({ content, count: changeCount } = this.migrateGuestService(content));
        break;
      case "photoService.js":
      case "enhancedPhotoService.js":
        ({ content, count: changeCount } = this.migratePhotoService(content));
        break;
      default:
        console.log(`   ⚠️  No migration rules for ${filename}`);
    }

    // Write modified content if changes were made
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, "utf8");
      console.log(`   ✅ Applied ${changeCount} changes`);
      this.replacements.push({ file: filename, count: changeCount });
    } else {
      console.log(`   ℹ️  No changes needed`);
    }
  }

  /**
   * Migrate authService.js
   */
  migrateAuthService(content) {
    let count = 0;

    // Fix: UPDATE ${userClass} SET lastLogin WHERE @rid = :rid
    content = content.replace(
      /UPDATE\s+\$\{userClass\}\s+SET\s+lastLogin\s*=\s*:lastLogin\s+WHERE\s+@rid\s*=\s*:rid/g,
      () => {
        count++;
        return "UPDATE ${userClass} SET lastLogin = :lastLogin WHERE userId = :userId";
      }
    );

    // Fix: SELECT ... WHERE @rid = :rid
    content = content.replace(
      /"SELECT username, email, createdAt, lastLogin FROM User WHERE @rid = :rid"/g,
      () => {
        count++;
        return '"SELECT username, email, createdAt, lastLogin FROM User WHERE userId = :userId"';
      }
    );

    // Fix: userId: user["@rid"] in token generation
    content = content.replace(/userId:\s*user\["@rid"\]/g, () => {
      count++;
      return "userId: user.userId";
    });

    // Fix: id: user["@rid"] in response
    content = content.replace(/id:\s*user\["@rid"\]/g, () => {
      count++;
      return "id: user.userId";
    });

    // Fix: userId: newUser["@rid"]
    content = content.replace(/userId:\s*newUser\["@rid"\]/g, () => {
      count++;
      return "userId: newUser.userId";
    });

    // Fix: id: newUser["@rid"]
    content = content.replace(/id:\s*newUser\["@rid"\]/g, () => {
      count++;
      return "id: newUser.userId";
    });

    return { content, count };
  }

  /**
   * Migrate clientService.js
   */
  migrateClientService(content) {
    let count = 0;

    // Fix: UPDATE Client WHERE @rid = :rid
    content = content.replace(
      /UPDATE\s+Client\s+SET\s+lastLogin\s*=\s*:lastLogin\s+WHERE\s+@rid\s*=\s*:rid/g,
      () => {
        count++;
        return "UPDATE Client SET lastLogin = :lastLogin WHERE clientId = :clientId";
      }
    );

    // Fix: params: { rid: client["@rid"] }
    content = content.replace(/rid:\s*client\["@rid"\]/g, () => {
      count++;
      return "clientId: client.clientId";
    });

    // Fix: id: client["@rid"]
    content = content.replace(/id:\s*client\["@rid"\]/g, () => {
      count++;
      return "id: client.clientId";
    });

    // Fix: SELECT out.@rid as id (edge traversal)
    content = content.replace(/out\.@rid\s+as\s+id/g, () => {
      count++;
      return "out.clientId as id";
    });

    // Fix: SELECT @rid as id FROM Guest/Client
    content = content.replace(/SELECT\s+@rid\s+as\s+id\s+FROM\s+Guest/g, () => {
      count++;
      return "SELECT guestId as id FROM Guest";
    });

    // Fix: SELECT p.@rid as id (photos)
    content = content.replace(/SELECT\s+p\.@rid\s+as\s+id,/g, () => {
      count++;
      return "SELECT p.photoId as id,";
    });

    // Fix: WHERE p.@rid = pa.photoId
    content = content.replace(/WHERE\s+p\.@rid\s*=\s*pa\.photoId/g, () => {
      count++;
      return "WHERE p.photoId = pa.out.photoId";
    });

    // Fix: guestId = result["@rid"]
    content = content.replace(
      /guestId\s*=\s*(\w+)\[0\]\["@rid"\]/g,
      (match, varName) => {
        count++;
        return `guestId = ${varName}[0].guestId`;
      }
    );

    // Fix: WHERE @rid = :guestId
    content = content.replace(/WHERE\s+@rid\s*=\s*:guestId/g, () => {
      count++;
      return "WHERE guestId = :guestId";
    });

    // Fix: WHERE @rid = :clientId
    content = content.replace(
      /FROM\s+Client\s+WHERE\s+@rid\s*=\s*:clientId/g,
      () => {
        count++;
        return "FROM Client WHERE clientId = :clientId";
      }
    );

    // Fix: out('BelongsToCollection').@rid
    content = content.replace(
      /out\('BelongsToCollection'\)\.@rid\s+as\s+collectionId/g,
      () => {
        count++;
        return "out('BelongsToCollection').collectionId as collectionId";
      }
    );

    return { content, count };
  }

  /**
   * Migrate photographerService.js
   */
  migratePhotographerService(content) {
    let count = 0;

    // Fix: id: result[0]["@rid"] -> photographerId
    content = content.replace(
      /id:\s*result\[0\]\["@rid"\]\s*,\s*\/\/\s*Photographer/g,
      () => {
        count++;
        return "id: result[0].photographerId, // Photographer";
      }
    );

    // Fix: id: result[0]["@rid"] -> clientId
    content = content.replace(
      /id:\s*result\[0\]\["@rid"\]\s*,\s*\/\/\s*Client/g,
      () => {
        count++;
        return "id: result[0].clientId, // Client";
      }
    );

    // Fix: id: result[0]["@rid"] -> collectionId
    content = content.replace(
      /id:\s*result\[0\]\["@rid"\]\s*,\s*\/\/\s*Collection/g,
      () => {
        count++;
        return "id: result[0].collectionId, // Collection";
      }
    );

    // Fix: SELECT ... @rid as id ... FROM Photographer
    content = content.replace(
      /SELECT\s+username,\s+businessName,\s+createdAt,\s+isActive,\s+@rid\s+as\s+id\s+FROM\s+Photographer/g,
      () => {
        count++;
        return "SELECT username, businessName, createdAt, isActive, photographerId as id FROM Photographer";
      }
    );

    // Fix: SELECT @rid as id ... FROM PhotoCollection
    content = content.replace(
      /SELECT\s+@rid\s+as\s+id,\s+name,\s+description/g,
      () => {
        count++;
        return "SELECT collectionId as id, name, description";
      }
    );

    // Fix: SELECT @rid as id ... FROM Client
    content = content.replace(
      /SELECT\s+@rid\s+as\s+id,\s+username,\s+email,\s+clientName/g,
      () => {
        count++;
        return "SELECT clientId as id, username, email, clientName";
      }
    );

    // Fix: WHERE @rid = :photographerId
    content = content.replace(
      /FROM\s+Photographer\s+WHERE\s+@rid\s*=\s*:photographerId/g,
      () => {
        count++;
        return "FROM Photographer WHERE photographerId = :photographerId";
      }
    );

    // Fix: WHERE @rid = :rid (Photographer)
    content = content.replace(
      /FROM\s+Photographer\s+WHERE\s+@rid\s*=\s*:rid/g,
      () => {
        count++;
        return "FROM Photographer WHERE photographerId = :photographerId";
      }
    );

    // Fix: WHERE @rid = :collectionId
    content = content.replace(/WHERE\s+@rid\s*=\s*:collectionId/g, () => {
      count++;
      return "WHERE collectionId = :collectionId";
    });

    // Fix: WHERE @rid = :photoId
    content = content.replace(/WHERE\s+@rid\s*=\s*:photoId/g, () => {
      count++;
      return "WHERE photoId = :photoId";
    });

    // Fix: UPDATE ... WHERE @rid = :rid
    content = content.replace(
      /UPDATE\s+Photographer\s+SET\s+isActive\s*=\s*:isActive\s+WHERE\s+@rid\s*=\s*:rid/g,
      () => {
        count++;
        return "UPDATE Photographer SET isActive = :isActive WHERE photographerId = :photographerId";
      }
    );

    // Fix: DELETE VERTEX Photographer WHERE @rid = :rid
    content = content.replace(
      /DELETE\s+VERTEX\s+Photographer\s+WHERE\s+@rid\s*=\s*:rid/g,
      () => {
        count++;
        return "DELETE VERTEX Photographer WHERE photographerId = :photographerId";
      }
    );

    // Fix: UPDATE Photo WHERE @rid = :photoId
    content = content.replace(
      /UPDATE\s+Photo\s+SET\s+collectionId\s*=\s*:collectionId\s+WHERE\s+@rid\s*=\s*:photoId/g,
      () => {
        count++;
        return "UPDATE Photo SET collectionId = :collectionId WHERE photoId = :photoId";
      }
    );

    // Fix: UPDATE PhotoCollection WHERE @rid = :collectionId
    content = content.replace(
      /UPDATE\s+PhotoCollection\s+SET\s+isActive\s*=\s*false\s+WHERE\s+@rid\s*=\s*:collectionId/g,
      () => {
        count++;
        return "UPDATE PhotoCollection SET isActive = false WHERE collectionId = :collectionId";
      }
    );

    return { content, count };
  }

  /**
   * Migrate guestService.js
   */
  migrateGuestService(content) {
    let count = 0;

    // Fix: UPDATE Guest WHERE @rid = :rid
    content = content.replace(
      /UPDATE\s+Guest\s+SET\s+lastLogin\s*=\s*:lastLogin\s+WHERE\s+@rid\s*=\s*:rid/g,
      () => {
        count++;
        return "UPDATE Guest SET lastLogin = :lastLogin WHERE guestId = :guestId";
      }
    );

    // Fix: params: { rid: guest["@rid"] }
    content = content.replace(/rid:\s*guest\["@rid"\]/g, () => {
      count++;
      return "guestId: guest.guestId";
    });

    // Fix: id: guest["@rid"]
    content = content.replace(/id:\s*guest\["@rid"\]/g, () => {
      count++;
      return "id: guest.guestId";
    });

    // Fix: WHERE @rid = :guestId
    content = content.replace(
      /FROM\s+Guest\s+WHERE\s+@rid\s*=\s*:guestId/g,
      () => {
        count++;
        return "FROM Guest WHERE guestId = :guestId";
      }
    );

    // Fix: SELECT @rid as id FROM Photo
    content = content.replace(/SELECT\s+@rid\s+as\s+id,\s+filename/g, () => {
      count++;
      return "SELECT photoId as id, filename";
    });

    // Fix: WHERE @rid IN :photoIds
    content = content.replace(/WHERE\s+@rid\s+IN\s+:photoIds/g, () => {
      count++;
      return "WHERE photoId IN :photoIds";
    });

    // Fix: WHERE g.@rid = :guestId
    content = content.replace(/WHERE\s+g\.@rid\s*=\s*:guestId/g, () => {
      count++;
      return "WHERE g.guestId = :guestId";
    });

    return { content, count };
  }

  /**
   * Migrate photoService.js and enhancedPhotoService.js
   */
  migratePhotoService(content) {
    let count = 0;

    // Fix: id: result[0]["@rid"]
    content = content.replace(/id:\s*result\[0\]\["@rid"\]/g, () => {
      count++;
      return "id: result[0].photoId";
    });

    // Fix: SELECT @rid as id FROM Photo
    content = content.replace(/SELECT\s+@rid\s+as\s+id,\s+filename/g, () => {
      count++;
      return "SELECT photoId as id, filename";
    });

    // Fix: SELECT p.@rid as id
    content = content.replace(/SELECT\s+p\.@rid\s+as\s+id,/g, () => {
      count++;
      return "SELECT p.photoId as id,";
    });

    // Fix: WHERE @rid = :photoId
    content = content.replace(/WHERE\s+@rid\s*=\s*:photoId/g, () => {
      count++;
      return "WHERE photoId = :photoId";
    });

    // Fix: WHERE p.@rid = :photoId
    content = content.replace(/WHERE\s+p\.@rid\s*=\s*:photoId/g, () => {
      count++;
      return "WHERE p.photoId = :photoId";
    });

    // Fix: SELECT @rid FROM Photo WHERE ...
    content = content.replace(/SELECT\s+@rid\s+FROM\s+Photo\s+WHERE/g, () => {
      count++;
      return "SELECT photoId FROM Photo WHERE";
    });

    // Fix: UPDATE Photo ... WHERE @rid = :photoId
    content = content.replace(
      /UPDATE\s+Photo\s+SET\s+isActive\s*=\s*false.*?WHERE\s+@rid\s*=\s*:photoId/g,
      () => {
        count++;
        return "UPDATE Photo SET isActive = false, deletedAt = :deletedAt WHERE photoId = :photoId";
      }
    );

    return { content, count };
  }

  /**
   * Print migration summary
   */
  printSummary() {
    console.log("\n" + "=".repeat(60));
    console.log("📊 MIGRATION SUMMARY");
    console.log("=".repeat(60));

    if (this.replacements.length > 0) {
      console.log("\n✅ Successfully migrated files:");
      let totalChanges = 0;
      this.replacements.forEach(({ file, count }) => {
        console.log(`   ${file}: ${count} changes`);
        totalChanges += count;
      });
      console.log(
        `\n   TOTAL: ${totalChanges} changes across ${this.replacements.length} files`
      );
    }

    if (this.errors.length > 0) {
      console.log("\n❌ Errors encountered:");
      this.errors.forEach((error) => {
        console.log(`   ${error}`);
      });
    }

    console.log("\n📁 Backups location: " + this.backupDir);
    console.log("\n⚠️  IMPORTANT: Test thoroughly before deploying!");
    console.log("   - Run: npm run dev");
    console.log("   - Test login/authentication");
    console.log("   - Test photo upload/sharing");
    console.log("   - Test collection management");
    console.log("\n🔄 To rollback: Copy files from .backups directory");
    console.log("=".repeat(60) + "\n");
  }
}

// Run migration
if (require.main === module) {
  const migration = new RidToUuidMigration();
  migration
    .migrate()
    .then(() => {
      console.log("✅ Migration completed!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Migration failed:", error);
      process.exit(1);
    });
}

module.exports = RidToUuidMigration;
