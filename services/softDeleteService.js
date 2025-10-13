const Database = require("../Database/databaseClass");
const { toOrientDBDateTime } = require("../utils/dateFormatter");

class SoftDeleteService {
  constructor() {
    this.dbInstance = new Database(
      process.env.DB_HOST,
      process.env.DB_PORT,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );
  }

  /**
   * Mark an entity for deletion (soft delete)
   * @param {string} entityClass - Class name (Photographer, Client, Photo, etc.)
   * @param {string} entityId - UUID of the entity (photoId, collectionId, etc.)
   * @param {string} reason - Reason for deletion
   * @param {string} idField - The UUID field name (default: 'id', or 'photoId', 'collectionId', etc.)
   * @returns {Promise<object>} Updated entity
   */
  async markForDeletion(
    entityClass,
    entityId,
    reason = "User requested deletion",
    idField = null
  ) {
    const db = this.dbInstance.useDatabase(
      process.env.DB_NAME,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );

    const now = new Date();
    const scheduledDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

    // Determine which field to use for the WHERE clause
    let whereField = idField;
    if (!whereField) {
      // Auto-detect based on entity class
      if (entityClass === "Photo") whereField = "photoId";
      else if (entityClass === "PhotoCollection") whereField = "collectionId";
      else if (entityClass === "Photographer") whereField = "photographerId";
      else if (entityClass === "Client") whereField = "clientId";
      else if (entityClass === "Guest") whereField = "guestId";
      else whereField = "id"; // Default fallback
    }

    const query = `UPDATE ${entityClass} 
       SET deletedAt = :deletedAt,
           scheduledDeletionDate = :scheduledDate,
           deletionReason = :reason,
           isActive = false
       WHERE ${whereField} = :entityId`;

    console.log(`🗑️  Soft delete query: ${query}`);
    console.log(`🗑️  Parameters:`, {
      entityId,
      deletedAt: toOrientDBDateTime(now),
      scheduledDate: toOrientDBDateTime(scheduledDate),
      reason,
    });

    const result = await db.query(query, {
      params: {
        entityId,
        deletedAt: toOrientDBDateTime(now),
        scheduledDate: toOrientDBDateTime(scheduledDate),
        reason,
      },
    });

    console.log(
      `🗑️  Marked ${entityClass} ${entityId} for deletion on ${scheduledDate.toLocaleDateString()}`
    );
    console.log(`🗑️  Update result:`, result);

    return {
      deletedAt: now,
      scheduledDeletionDate: scheduledDate,
      deletionReason: reason,
    };
  }

  /**
   * Restore a soft-deleted entity
   * @param {string} entityClass - Class name
   * @param {string} entityId - UUID of the entity
   * @param {string} idField - The UUID field name (default: auto-detect, or 'photoId', 'collectionId', etc.)
   * @returns {Promise<object>} Restored entity
   */
  async restoreDeleted(entityClass, entityId, idField = null) {
    const db = this.dbInstance.useDatabase(
      process.env.DB_NAME,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );

    // Determine which field to use for the WHERE clause
    let whereField = idField;
    if (!whereField) {
      // Auto-detect based on entity class
      if (entityClass === "Photo") whereField = "photoId";
      else if (entityClass === "PhotoCollection") whereField = "collectionId";
      else if (entityClass === "Photographer") whereField = "photographerId";
      else if (entityClass === "Client") whereField = "clientId";
      else if (entityClass === "Guest") whereField = "guestId";
      else whereField = "id"; // Default fallback
    }

    const query = `UPDATE ${entityClass} 
       SET deletedAt = null,
           scheduledDeletionDate = null,
           deletionReason = null,
           isActive = true
       WHERE ${whereField} = :entityId`;

    console.log(`♻️  Restore query: ${query}`);
    console.log(`♻️  Parameters:`, { entityId });

    await db.query(query, {
      params: { entityId },
    });

    console.log(
      `♻️  Restored ${entityClass} ${entityId} from scheduled deletion`
    );

    return {
      id: entityId,
      restored: true,
    };
  }

  /**
   * Permanently delete entities scheduled for deletion
   * @returns {Promise<object>} Deletion summary
   */
  async cleanupScheduledDeletions() {
    const db = this.dbInstance.useDatabase(
      process.env.DB_NAME,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );

    const now = toOrientDBDateTime(new Date());
    const deletionSummary = {
      photographers: 0,
      clients: 0,
      guests: 0,
      photos: 0,
      collections: 0,
      totalDeleted: 0,
    };

    console.log("\n🧹 Starting scheduled deletion cleanup...");
    console.log(`   Current time: ${new Date().toISOString()}`);

    // Delete Photographers (cascades to their clients and photos)
    const photographers = await db.query(
      `SELECT @rid as id, businessName 
       FROM Photographer 
       WHERE scheduledDeletionDate <= :now 
       AND scheduledDeletionDate IS NOT NULL`,
      { params: { now } }
    );

    for (const photographer of photographers) {
      console.log(
        `   🗑️  Permanently deleting photographer: ${photographer.businessName}`
      );

      // Delete associated clients
      const clients = await db.query(
        `SELECT @rid FROM Client WHERE photographerId = :photogId`,
        { params: { photogId: photographer.id } }
      );

      for (const client of clients) {
        // Delete client's guests
        await db.query(`DELETE VERTEX Guest WHERE clientId = :clientId`, {
          params: { clientId: client["@rid"] },
        });

        // Delete client
        await db.query(`DELETE VERTEX Client WHERE @rid = :clientId`, {
          params: { clientId: client["@rid"] },
        });
        deletionSummary.clients++;
      }

      // Delete photographer's photos
      const photos = await db.query(
        `SELECT @rid FROM Photo WHERE photographerId = :photogId`,
        { params: { photogId: photographer.id } }
      );
      deletionSummary.photos += photos.length;

      await db.query(`DELETE VERTEX Photo WHERE photographerId = :photogId`, {
        params: { photogId: photographer.id },
      });

      // Delete photographer's collections
      const collections = await db.query(
        `SELECT @rid FROM PhotoCollection WHERE photographerId = :photogId`,
        { params: { photogId: photographer.id } }
      );
      deletionSummary.collections += collections.length;

      await db.query(
        `DELETE VERTEX PhotoCollection WHERE photographerId = :photogId`,
        {
          params: { photogId: photographer.id },
        }
      );

      // Delete photographer
      await db.query(`DELETE VERTEX Photographer WHERE @rid = :photogId`, {
        params: { photogId: photographer.id },
      });
      deletionSummary.photographers++;
    }

    // Delete standalone Clients
    const clients = await db.query(
      `SELECT @rid as id, clientName 
       FROM Client 
       WHERE scheduledDeletionDate <= :now 
       AND scheduledDeletionDate IS NOT NULL`,
      { params: { now } }
    );

    for (const client of clients) {
      console.log(`   🗑️  Permanently deleting client: ${client.clientName}`);

      // Delete client's guests
      const guests = await db.query(
        `SELECT @rid FROM Guest WHERE clientId = :clientId`,
        { params: { clientId: client.id } }
      );
      deletionSummary.guests += guests.length;

      await db.query(`DELETE VERTEX Guest WHERE clientId = :clientId`, {
        params: { clientId: client.id },
      });

      await db.query(`DELETE VERTEX Client WHERE @rid = :clientId`, {
        params: { clientId: client.id },
      });
      deletionSummary.clients++;
    }

    // Delete standalone Guests
    const guests = await db.query(
      `SELECT @rid as id, guestName 
       FROM Guest 
       WHERE scheduledDeletionDate <= :now 
       AND scheduledDeletionDate IS NOT NULL`,
      { params: { now } }
    );

    for (const guest of guests) {
      console.log(`   🗑️  Permanently deleting guest: ${guest.guestName}`);

      await db.query(`DELETE VERTEX Guest WHERE @rid = :guestId`, {
        params: { guestId: guest.id },
      });
      deletionSummary.guests++;
    }

    // Delete standalone Photos
    const photos = await db.query(
      `SELECT @rid as id, originalName 
       FROM Photo 
       WHERE scheduledDeletionDate <= :now 
       AND scheduledDeletionDate IS NOT NULL`,
      { params: { now } }
    );

    for (const photo of photos) {
      console.log(`   🗑️  Permanently deleting photo: ${photo.originalName}`);

      await db.query(`DELETE VERTEX Photo WHERE @rid = :photoId`, {
        params: { photoId: photo.id },
      });
      deletionSummary.photos++;
    }

    // Delete standalone Collections
    const collections = await db.query(
      `SELECT @rid as id, name 
       FROM PhotoCollection 
       WHERE scheduledDeletionDate <= :now 
       AND scheduledDeletionDate IS NOT NULL`,
      { params: { now } }
    );

    for (const collection of collections) {
      console.log(`   🗑️  Permanently deleting collection: ${collection.name}`);

      await db.query(
        `DELETE VERTEX PhotoCollection WHERE @rid = :collectionId`,
        {
          params: { collectionId: collection.id },
        }
      );
      deletionSummary.collections++;
    }

    deletionSummary.totalDeleted =
      deletionSummary.photographers +
      deletionSummary.clients +
      deletionSummary.guests +
      deletionSummary.photos +
      deletionSummary.collections;

    console.log("\n✅ Scheduled deletion cleanup complete!");
    console.log(`   Photographers: ${deletionSummary.photographers}`);
    console.log(`   Clients: ${deletionSummary.clients}`);
    console.log(`   Guests: ${deletionSummary.guests}`);
    console.log(`   Photos: ${deletionSummary.photos}`);
    console.log(`   Collections: ${deletionSummary.collections}`);
    console.log(`   Total: ${deletionSummary.totalDeleted}\n`);

    return deletionSummary;
  }

  /**
   * NUCLEAR OPTION: Permanently delete ALL entities marked for deletion (regardless of scheduled date)
   * @returns {Promise<object>} Deletion summary
   */
  async nukeAllMarkedForDeletion() {
    const db = this.dbInstance.useDatabase(
      process.env.DB_NAME,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );

    const deletionSummary = {
      photographers: 0,
      clients: 0,
      guests: 0,
      photos: 0,
      collections: 0,
      totalDeleted: 0,
    };

    console.log("\n💣 NUCLEAR DELETION - Removing ALL marked items...");
    console.log(`   ⚠️  WARNING: Ignoring 7-day grace period!`);

    // Delete Photographers (cascades to their clients and photos)
    const photographers = await db.query(
      `SELECT @rid as id, businessName 
       FROM Photographer 
       WHERE scheduledDeletionDate IS NOT NULL`
    );

    for (const photographer of photographers) {
      console.log(`   💥 Nuking photographer: ${photographer.businessName}`);

      // Delete associated clients
      const clients = await db.query(
        `SELECT @rid FROM Client WHERE photographerId = :photogId`,
        { params: { photogId: photographer.id } }
      );

      for (const client of clients) {
        // Delete client's guests
        await db.query(`DELETE VERTEX Guest WHERE clientId = :clientId`, {
          params: { clientId: client["@rid"] },
        });

        // Delete client
        await db.query(`DELETE VERTEX Client WHERE @rid = :clientId`, {
          params: { clientId: client["@rid"] },
        });
        deletionSummary.clients++;
      }

      // Delete photographer's photos
      const photos = await db.query(
        `SELECT @rid FROM Photo WHERE photographerId = :photogId`,
        { params: { photogId: photographer.id } }
      );
      deletionSummary.photos += photos.length;

      await db.query(`DELETE VERTEX Photo WHERE photographerId = :photogId`, {
        params: { photogId: photographer.id },
      });

      // Delete photographer's collections
      const collections = await db.query(
        `SELECT @rid FROM PhotoCollection WHERE photographerId = :photogId`,
        { params: { photogId: photographer.id } }
      );
      deletionSummary.collections += collections.length;

      await db.query(
        `DELETE VERTEX PhotoCollection WHERE photographerId = :photogId`,
        {
          params: { photogId: photographer.id },
        }
      );

      // Delete photographer
      await db.query(`DELETE VERTEX Photographer WHERE @rid = :photogId`, {
        params: { photogId: photographer.id },
      });
      deletionSummary.photographers++;
    }

    // Delete standalone Clients
    const clients = await db.query(
      `SELECT @rid as id, clientName 
       FROM Client 
       WHERE scheduledDeletionDate IS NOT NULL`
    );

    for (const client of clients) {
      console.log(`   💥 Nuking client: ${client.clientName}`);

      // Delete client's guests
      const guests = await db.query(
        `SELECT @rid FROM Guest WHERE clientId = :clientId`,
        { params: { clientId: client.id } }
      );
      deletionSummary.guests += guests.length;

      await db.query(`DELETE VERTEX Guest WHERE clientId = :clientId`, {
        params: { clientId: client.id },
      });

      await db.query(`DELETE VERTEX Client WHERE @rid = :clientId`, {
        params: { clientId: client.id },
      });
      deletionSummary.clients++;
    }

    // Delete standalone Guests
    const guests = await db.query(
      `SELECT @rid as id, guestName 
       FROM Guest 
       WHERE scheduledDeletionDate IS NOT NULL`
    );

    for (const guest of guests) {
      console.log(`   💥 Nuking guest: ${guest.guestName}`);

      await db.query(`DELETE VERTEX Guest WHERE @rid = :guestId`, {
        params: { guestId: guest.id },
      });
      deletionSummary.guests++;
    }

    // Delete standalone Photos
    const photos = await db.query(
      `SELECT @rid as id, originalName 
       FROM Photo 
       WHERE scheduledDeletionDate IS NOT NULL`
    );

    for (const photo of photos) {
      console.log(`   💥 Nuking photo: ${photo.originalName}`);

      await db.query(`DELETE VERTEX Photo WHERE @rid = :photoId`, {
        params: { photoId: photo.id },
      });
      deletionSummary.photos++;
    }

    // Delete standalone Collections
    const collections = await db.query(
      `SELECT @rid as id, name 
       FROM PhotoCollection 
       WHERE scheduledDeletionDate IS NOT NULL`
    );

    for (const collection of collections) {
      console.log(`   💥 Nuking collection: ${collection.name}`);

      await db.query(
        `DELETE VERTEX PhotoCollection WHERE @rid = :collectionId`,
        {
          params: { collectionId: collection.id },
        }
      );
      deletionSummary.collections++;
    }

    deletionSummary.totalDeleted =
      deletionSummary.photographers +
      deletionSummary.clients +
      deletionSummary.guests +
      deletionSummary.photos +
      deletionSummary.collections;

    console.log("\n💥 NUCLEAR DELETION COMPLETE!");
    console.log(`   Photographers: ${deletionSummary.photographers}`);
    console.log(`   Clients: ${deletionSummary.clients}`);
    console.log(`   Guests: ${deletionSummary.guests}`);
    console.log(`   Photos: ${deletionSummary.photos}`);
    console.log(`   Collections: ${deletionSummary.collections}`);
    console.log(`   Total: ${deletionSummary.totalDeleted}\n`);

    return deletionSummary;
  }

  /**
   * Get all entities scheduled for deletion
   * @returns {Promise<object>} Entities by type
   */
  async getScheduledDeletions() {
    const db = this.dbInstance.useDatabase(
      process.env.DB_NAME,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );

    const photographers = await db.query(
      `SELECT photographerId as id, username, businessName, deletedAt, scheduledDeletionDate, deletionReason
       FROM Photographer
       WHERE scheduledDeletionDate IS NOT NULL
       ORDER BY scheduledDeletionDate ASC`
    );

    const clients = await db.query(
      `SELECT clientId as id, username, clientName, deletedAt, scheduledDeletionDate, deletionReason
       FROM Client
       WHERE scheduledDeletionDate IS NOT NULL
       ORDER BY scheduledDeletionDate ASC`
    );

    const guests = await db.query(
      `SELECT guestId as id, username, guestName, deletedAt, scheduledDeletionDate, deletionReason
       FROM Guest
       WHERE scheduledDeletionDate IS NOT NULL
       ORDER BY scheduledDeletionDate ASC`
    );

    const photos = await db.query(
      `SELECT photoId as id, originalName, deletedAt, scheduledDeletionDate, deletionReason
       FROM Photo
       WHERE scheduledDeletionDate IS NOT NULL
       ORDER BY scheduledDeletionDate ASC`
    );

    const collections = await db.query(
      `SELECT collectionId as id, name, deletedAt, scheduledDeletionDate, deletionReason
       FROM PhotoCollection
       WHERE scheduledDeletionDate IS NOT NULL
       ORDER BY scheduledDeletionDate ASC`
    );

    return {
      photographers,
      clients,
      guests,
      photos,
      collections,
      total:
        photographers.length +
        clients.length +
        guests.length +
        photos.length +
        collections.length,
    };
  }
}

module.exports = SoftDeleteService;
