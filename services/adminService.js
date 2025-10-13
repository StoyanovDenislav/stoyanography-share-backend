const Database = require("../Database/databaseClass");

class AdminService {
  constructor() {
    this.dbInstance = new Database(
      process.env.DB_HOST,
      process.env.DB_PORT,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );
  }

  // Get all photographers with their stats
  async getAllPhotographers(req, res) {
    try {
      const db = this.dbInstance.useDatabase(
        process.env.DB_NAME,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD
      );

      const photographers = await db.query(
        `SELECT photographerId as id, username, businessName, email, isActive, createdAt
         FROM Photographer
         WHERE scheduledDeletionDate IS NULL
         ORDER BY createdAt DESC`
      );

      // Add counts separately
      const photographersWithCounts = await Promise.all(
        photographers.map(async (photographer) => {
          const clientCount = await db.query(
            `SELECT COUNT(*) as count FROM Client WHERE photographerId = :photogId AND scheduledDeletionDate IS NULL`,
            { params: { photogId: photographer.id } }
          );
          const collectionCount = await db.query(
            `SELECT COUNT(*) as count FROM PhotoCollection WHERE photographerId = :photogId AND scheduledDeletionDate IS NULL`,
            { params: { photogId: photographer.id } }
          );
          const photoCount = await db.query(
            `SELECT COUNT(*) as count FROM Photo WHERE photographerId = :photogId AND scheduledDeletionDate IS NULL`,
            { params: { photogId: photographer.id } }
          );

          return {
            ...photographer,
            clientCount: clientCount[0]?.count || 0,
            collectionCount: collectionCount[0]?.count || 0,
            photoCount: photoCount[0]?.count || 0,
          };
        })
      );

      res.json({
        success: true,
        photographers: photographersWithCounts,
      });
    } catch (error) {
      console.error("Get photographers error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch photographers",
        error: error.message,
      });
    }
  }

  // Get all clients with photographer info
  async getAllClients(req, res) {
    try {
      const db = this.dbInstance.useDatabase(
        process.env.DB_NAME,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD
      );

      const clients = await db.query(
        `SELECT clientId as id, username, clientName, encryptedEmail, isActive, createdAt, photographerId
         FROM Client
         WHERE scheduledDeletionDate IS NULL
         ORDER BY createdAt DESC`
      );

      // Add photographer name and counts separately
      const clientsWithDetails = await Promise.all(
        clients.map(async (client) => {
          let photographerName = "Unknown";

          if (client.photographerId) {
            const photographer = await db.query(
              `SELECT businessName FROM Photographer WHERE photographerId = :photogId AND scheduledDeletionDate IS NULL`,
              { params: { photogId: client.photographerId } }
            );
            photographerName = photographer[0]?.businessName || "Unknown";
          }

          const guestCount = await db.query(
            `SELECT COUNT(*) as count FROM Guest WHERE clientId = :clientId AND scheduledDeletionDate IS NULL`,
            { params: { clientId: client.id } }
          );
          const collectionCount = await db.query(
            `SELECT COUNT(*) as count FROM (
              SELECT expand(in) FROM CollectionAccess WHERE out = :clientId
            )`,
            { params: { clientId: client.id } }
          );

          return {
            ...client,
            photographerName,
            guestCount: guestCount[0]?.count || 0,
            collectionCount: collectionCount[0]?.count || 0,
          };
        })
      );

      res.json({
        success: true,
        clients: clientsWithDetails,
      });
    } catch (error) {
      console.error("Get clients error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch clients",
        error: error.message,
      });
    }
  }

  // Get all guests with client and photographer info
  async getAllGuests(req, res) {
    try {
      const db = this.dbInstance.useDatabase(
        process.env.DB_NAME,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD
      );

      const guests = await db.query(
        `SELECT guestId as id, username, guestName, email, isActive, createdAt, expiresAt, clientId
         FROM Guest
         WHERE scheduledDeletionDate IS NULL
         ORDER BY createdAt DESC`
      );

      // Add client and photographer details separately
      const guestsWithDetails = await Promise.all(
        guests.map(async (guest) => {
          const client = await db.query(
            `SELECT clientName, photographerId FROM Client WHERE clientId = :clientId`,
            { params: { clientId: guest.clientId } }
          );

          let photographerName = "Unknown";
          let photographerId = null;

          if (client.length > 0 && client[0].photographerId) {
            photographerId = client[0].photographerId;
            const photographer = await db.query(
              `SELECT businessName FROM Photographer WHERE photographerId = :photogId`,
              { params: { photogId: client[0].photographerId } }
            );
            photographerName = photographer[0]?.businessName || "Unknown";
          }

          const photoAccessCount = await db.query(
            `SELECT COUNT(*) as count FROM (
              SELECT expand(in) FROM PhotoAccess WHERE out = :guestId
            )`,
            { params: { guestId: guest.id } }
          );

          return {
            ...guest,
            clientName: client[0]?.clientName || "Unknown",
            photographerId: photographerId,
            photographerName: photographerName,
            photoAccessCount: photoAccessCount[0]?.count || 0,
          };
        })
      );

      res.json({
        success: true,
        guests: guestsWithDetails,
      });
    } catch (error) {
      console.error("Get guests error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch guests",
        error: error.message,
      });
    }
  }

  // Get all collections with photographer info
  async getAllCollections(req, res) {
    try {
      const db = this.dbInstance.useDatabase(
        process.env.DB_NAME,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD
      );

      const collections = await db.query(
        `SELECT collectionId as id, name, description, createdAt, photographerId
         FROM PhotoCollection
         WHERE scheduledDeletionDate IS NULL
         ORDER BY createdAt DESC`
      );

      // Add photographer details and counts separately
      const collectionsWithDetails = await Promise.all(
        collections.map(async (collection) => {
          const photographer = await db.query(
            `SELECT businessName FROM Photographer WHERE photographerId = :photogId`,
            { params: { photogId: collection.photographerId } }
          );

          const photoCount = await db.query(
            `SELECT COUNT(*) as count FROM CollectionPhoto 
             WHERE out IN (SELECT FROM PhotoCollection WHERE collectionId = :collectionId)`,
            { params: { collectionId: collection.id } }
          );

          const clientCount = await db.query(
            `SELECT COUNT(*) as count FROM CollectionAccess 
             WHERE out IN (SELECT FROM PhotoCollection WHERE collectionId = :collectionId)`,
            { params: { collectionId: collection.id } }
          );

          const thumbnail = await db.query(
            `SELECT thumbnailDataB64 FROM Photo 
             WHERE @rid IN (
               SELECT in FROM CollectionPhoto 
               WHERE out IN (SELECT FROM PhotoCollection WHERE collectionId = :collectionId)
             )
             ORDER BY createdAt ASC LIMIT 1`,
            { params: { collectionId: collection.id } }
          );

          return {
            ...collection,
            photographerName: photographer[0]?.businessName || "Unknown",
            photoCount: photoCount[0]?.count || 0,
            clientCount: clientCount[0]?.count || 0,
            thumbnailDataB64: thumbnail[0]?.thumbnailDataB64 || null,
          };
        })
      );

      res.json({
        success: true,
        collections: collectionsWithDetails,
      });
    } catch (error) {
      console.error("Get collections error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch collections",
        error: error.message,
      });
    }
  }

  // Get all photos with photographer info
  async getAllPhotos(req, res) {
    try {
      const db = this.dbInstance.useDatabase(
        process.env.DB_NAME,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD
      );

      const photos = await db.query(
        `SELECT photoId as id, originalName, thumbnailDataB64, size, createdAt, photographerId
         FROM Photo
         WHERE scheduledDeletionDate IS NULL
         ORDER BY createdAt DESC
         LIMIT 1000`
      );

      // Add photographer details
      const photosWithDetails = await Promise.all(
        photos.map(async (photo) => {
          const photographer = await db.query(
            `SELECT businessName FROM Photographer WHERE photographerId = :photogId`,
            { params: { photogId: photo.photographerId } }
          );

          return {
            ...photo,
            photographerName: photographer[0]?.businessName || "Unknown",
          };
        })
      );

      res.json({
        success: true,
        photos: photosWithDetails,
      });
    } catch (error) {
      console.error("Get photos error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch photos",
        error: error.message,
      });
    }
  }

  // Get system statistics
  async getSystemStats(req, res) {
    try {
      const db = this.dbInstance.useDatabase(
        process.env.DB_NAME,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD
      );

      // Get all counts separately for simplicity (excluding soft-deleted)
      const totalPhotographers = await db.query(
        `SELECT COUNT(*) as count FROM Photographer WHERE scheduledDeletionDate IS NULL`
      );
      const activePhotographers = await db.query(
        `SELECT COUNT(*) as count FROM Photographer WHERE isActive = true AND scheduledDeletionDate IS NULL`
      );
      const totalClients = await db.query(
        `SELECT COUNT(*) as count FROM Client WHERE scheduledDeletionDate IS NULL`
      );
      const activeClients = await db.query(
        `SELECT COUNT(*) as count FROM Client WHERE isActive = true AND scheduledDeletionDate IS NULL`
      );
      const totalGuests = await db.query(
        `SELECT COUNT(*) as count FROM Guest WHERE scheduledDeletionDate IS NULL`
      );
      const activeGuests = await db.query(
        `SELECT COUNT(*) as count FROM Guest WHERE isActive = true AND scheduledDeletionDate IS NULL`
      );
      const totalCollections = await db.query(
        `SELECT COUNT(*) as count FROM PhotoCollection WHERE deletedAt IS NULL`
      );
      const totalPhotos = await db.query(
        `SELECT COUNT(*) as count FROM Photo WHERE deletedAt IS NULL`
      );
      const totalStorage = await db.query(
        `SELECT SUM(size) as total FROM Photo WHERE deletedAt IS NULL`
      );

      const stats = {
        totalPhotographers: totalPhotographers[0]?.count || 0,
        activePhotographers: activePhotographers[0]?.count || 0,
        totalClients: totalClients[0]?.count || 0,
        activeClients: activeClients[0]?.count || 0,
        totalGuests: totalGuests[0]?.count || 0,
        activeGuests: activeGuests[0]?.count || 0,
        totalCollections: totalCollections[0]?.count || 0,
        totalPhotos: totalPhotos[0]?.count || 0,
        totalStorageBytes: totalStorage[0]?.total || 0,
      };

      res.json({
        success: true,
        stats: stats,
      });
    } catch (error) {
      console.error("Get system stats error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch system statistics",
        error: error.message,
      });
    }
  }
}

module.exports = AdminService;
