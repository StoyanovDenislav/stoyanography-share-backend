#!/usr/bin/env node

/**
 * Generate self-signed SSL certificates for local development
 * DO NOT use these certificates in production!
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const sslDir = path.join(__dirname, "..", "ssl");
const keyPath = path.join(sslDir, "key.pem");
const certPath = path.join(sslDir, "cert.pem");

console.log("🔒 Generating self-signed SSL certificates for development...");

// Create ssl directory if it doesn't exist
if (!fs.existsSync(sslDir)) {
  fs.mkdirSync(sslDir, { recursive: true });
  console.log("✅ Created ssl directory");
}

// Check if certificates already exist
if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
  console.log(
    "⚠️  SSL certificates already exist. Delete them first if you want to regenerate."
  );
  console.log(`   Key:  ${keyPath}`);
  console.log(`   Cert: ${certPath}`);
  process.exit(0);
}

try {
  // Generate self-signed certificate valid for 365 days
  execSync(
    `openssl req -x509 -newkey rsa:4096 -keyout "${keyPath}" -out "${certPath}" -days 365 -nodes -subj "/CN=localhost/O=Stoyanography Development/C=US"`,
    { stdio: "inherit" }
  );

  console.log("\n✅ Self-signed SSL certificates generated successfully!");
  console.log(`   Key:  ${keyPath}`);
  console.log(`   Cert: ${certPath}`);
  console.log(
    "\n⚠️  WARNING: These are self-signed certificates for DEVELOPMENT ONLY!"
  );
  console.log(
    "   Your browser will show a security warning. This is expected."
  );
  console.log(
    "   For production, use proper SSL certificates from a trusted CA.\n"
  );
  console.log('💡 To enable HTTPS, set USE_HTTPS=true in your .env file\n');
} catch (error) {
  console.error("❌ Error generating SSL certificates:", error.message);
  console.error(
    "\n💡 Make sure OpenSSL is installed on your system:"
  );
  console.error("   - macOS: should be pre-installed");
  console.error("   - Linux: apt-get install openssl or yum install openssl");
  console.error("   - Windows: install from https://slproweb.com/products/Win32OpenSSL.html");
  process.exit(1);
}
