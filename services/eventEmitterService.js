/**
 * EventEmitter Service - Sends real-time updates to connected clients
 * Uses Server-Sent Events (SSE) for one-way server-to-client communication
 */

class EventEmitterService {
  constructor() {
    // Store active SSE connections by user role
    this.clients = {
      admin: [],
      photographer: [],
      client: [],
      guest: [],
    };
  }

  /**
   * Add a new SSE client connection
   */
  addClient(res, role, userId) {
    const client = {
      id: `${role}-${userId}-${Date.now()}`,
      res,
      role,
      userId,
      lastPing: Date.now(),
    };

    if (!this.clients[role]) {
      this.clients[role] = [];
    }

    this.clients[role].push(client);
    console.log(`📡 SSE client connected: ${client.id} (${role})`);

    // Send initial connection success
    this.sendToClient(client, {
      type: "connected",
      message: "SSE connection established",
    });

    // Keep connection alive with periodic pings
    // NOTE: 30-45 seconds is optimal - browsers timeout SSE after ~60s of inactivity
    const pingInterval = setInterval(() => {
      if (!client.res.writableEnded) {
        client.lastPing = Date.now();
        this.sendToClient(client, { type: "ping" });
      } else {
        clearInterval(pingInterval);
      }
    }, 45 * 1000); // Ping every 45 seconds (safe margin before 60s browser timeout)

    // Clean up on disconnect
    res.on("close", () => {
      clearInterval(pingInterval);
      this.removeClient(client.id, role);
      console.log(`📡 SSE client disconnected: ${client.id}`);
    });

    return client;
  }

  /**
   * Remove a client connection
   */
  removeClient(clientId, role) {
    if (this.clients[role]) {
      this.clients[role] = this.clients[role].filter((c) => c.id !== clientId);
    }
  }

  /**
   * Send event to a specific client
   */
  sendToClient(client, data) {
    if (!client.res.writableEnded) {
      try {
        client.res.write(`data: ${JSON.stringify(data)}\n\n`);
        // CRITICAL: Flush the response to ensure data is sent immediately
        // Without this, the connection may appear idle and close
        if (typeof client.res.flush === "function") {
          client.res.flush();
        }
      } catch (error) {
        console.error(`Failed to send to client ${client.id}:`, error.message);
      }
    }
  }

  /**
   * Broadcast event to all clients of a specific role
   */
  broadcastToRole(role, event) {
    const clients = this.clients[role] || [];
    console.log(
      `📡 Broadcasting to ${clients.length} ${role} clients:`,
      event.type
    );

    clients.forEach((client) => {
      this.sendToClient(client, event);
    });
  }

  /**
   * Broadcast to specific user
   */
  broadcastToUser(role, userId, event) {
    const clients = this.clients[role] || [];
    const userClients = clients.filter((c) => c.userId === userId);

    console.log(`📡 Broadcasting to user ${userId}:`, event.type);

    userClients.forEach((client) => {
      this.sendToClient(client, event);
    });
  }

  /**
   * Broadcast to all connected clients
   */
  broadcastToAll(event) {
    Object.keys(this.clients).forEach((role) => {
      this.broadcastToRole(role, event);
    });
  }

  /**
   * Emit photo-related events
   */
  emitPhotoEvent(type, data) {
    const event = { type: `photo.${type}`, data, timestamp: Date.now() };

    // Notify photographer who uploaded
    if (data.photographerId) {
      this.broadcastToUser("photographer", data.photographerId, event);
    }

    // Notify admin
    this.broadcastToRole("admin", event);
  }

  /**
   * Emit collection-related events
   */
  emitCollectionEvent(type, data) {
    const event = { type: `collection.${type}`, data, timestamp: Date.now() };

    // Notify photographer who owns the collection
    if (data.photographerId) {
      this.broadcastToUser("photographer", data.photographerId, event);
    }

    // Notify clients who have access to the collection
    if (data.clientIds && data.clientIds.length > 0) {
      data.clientIds.forEach((clientId) => {
        this.broadcastToUser("client", clientId, event);
      });
    }

    // Notify admin
    this.broadcastToRole("admin", event);
  }

  /**
   * Emit client-related events
   */
  emitClientEvent(type, data) {
    const event = { type: `client.${type}`, data, timestamp: Date.now() };

    // Notify the photographer who manages this client
    if (data.photographerId) {
      this.broadcastToUser("photographer", data.photographerId, event);
    }

    // Notify the client themselves
    if (data.clientId) {
      this.broadcastToUser("client", data.clientId, event);
    }

    // Notify admin
    this.broadcastToRole("admin", event);
  }

  /**
   * Emit guest-related events
   */
  emitGuestEvent(type, data) {
    const event = { type: `guest.${type}`, data, timestamp: Date.now() };

    // Notify the client who manages this guest
    if (data.clientId) {
      this.broadcastToUser("client", data.clientId, event);
    }

    // Notify the guest themselves
    if (data.guestId) {
      this.broadcastToUser("guest", data.guestId, event);
    }

    // Notify admin
    this.broadcastToRole("admin", event);
  }

  /**
   * Get connection stats
   */
  getStats() {
    return {
      total: Object.values(this.clients).reduce(
        (sum, arr) => sum + arr.length,
        0
      ),
      byRole: Object.fromEntries(
        Object.entries(this.clients).map(([role, clients]) => [
          role,
          clients.length,
        ])
      ),
    };
  }
}

// Export singleton instance
module.exports = new EventEmitterService();
