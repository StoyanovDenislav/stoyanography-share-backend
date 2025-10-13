const Database = require("../Database/databaseClass");
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();

class CreateAdmin {
  constructor() {
    this.dbInstance = new Database(
      process.env.DB_HOST,
      process.env.DB_PORT,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );
  }

  async run(username, email, password) {
    console.log("👤 Creating Admin Account...\n");

    const db = this.dbInstance.useDatabase(
      process.env.DB_NAME,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD
    );

    try {
      // Check if admin already exists
      const existing = await db.query(
        `SELECT username FROM User WHERE username = :username OR email = :email`,
        { params: { username, email } }
      );

      if (existing.length > 0) {
        console.log("⚠️  Admin user already exists!");
        return;
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);
      const userId = uuidv4();

      // Create admin user
      await db.query(
        `INSERT INTO User SET 
         userId = :userId,
         username = :username,
         email = :email,
         password = :password,
         role = 'admin',
         isActive = true,
         createdAt = sysdate()`,
        {
          params: {
            userId,
            username,
            email,
            password: hashedPassword,
          },
        }
      );

      console.log("✅ Admin account created successfully!");
      console.log(`\n📧 Email: ${email}`);
      console.log(`👤 Username: ${username}`);
      console.log(`🔑 Password: ${password}`);
      console.log(`🆔 User ID: ${userId}`);
      console.log("\n⚠️  IMPORTANT: Save these credentials securely!");
    } catch (error) {
      console.error("\n❌ Failed to create admin:", error);
      throw error;
    } finally {
      this.dbInstance.closeConnection();
    }
  }
}

// Run if called directly
if (require.main === module) {
  const readline = require("readline").createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let username, email, password;

  readline.question("Enter admin username: ", (user) => {
    username = user;
    readline.question("Enter admin email: ", (mail) => {
      email = mail;
      readline.question("Enter admin password: ", (pass) => {
        password = pass;
        readline.close();

        const creator = new CreateAdmin();
        creator
          .run(username, email, password)
          .then(() => process.exit(0))
          .catch((err) => {
            console.error(err);
            process.exit(1);
          });
      });
    });
  });
}

module.exports = CreateAdmin;
