var OrientDB = require("orientjs");

class Database {
  constructor(host, port, username, password) {
    this.host = host;
    this.port = port;
    this.username = username;
    this.password = password;
  }

  getConnection() {
    return OrientDB({
      host: this.host,
      port: this.port,
      username: this.username,
      password: this.password,
      useToken: true,
    });
  }
  useDatabase(name, username, password) {
    const server = this.getConnection();
    return server.use({
      name: name,
      username: username,
      password: password,
    });
  }
  closeConnection() {
    const connection = this.getConnection();
    connection.close();
  }
}

module.exports = Database;

/**
 * Example Usage:
 *
 * const Database = require('./databaseClass');
 * const dbInstance = new Database(ip, port, user, passwd);
 *
 * try {
 *   // Establish server connection
 *   const server = dbInstance.getConnection();
 *
 *   // Connect to a specific database
 *   const db = dbInstance.useDatabase(dbName, user, passwd);
 *
 *   // Example query
 *   db.query(
 *     'SELECT name, ba FROM Player WHERE ba >= 0.3 AND team = "Red Sox"'
 *   ).then(function(hitters) {
 *     console.log(hitters);
 *   }).catch(function(err) {
 *     // Handle query error
 *     console.error(err);
 *   });
 *
 *   // Close the server connection
 *   dbInstance.closeConnection();
 * } catch (err) {
 *   // Handle connection errors
 *   console.error(err);
 * }
 */
