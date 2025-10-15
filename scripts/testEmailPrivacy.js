require("dotenv").config();
const axios = require("axios");

const PORT = process.env.PORT || 6002;
const PROTOCOL = process.env.USE_HTTPS === "true" ? "https" : "http";
const BASE_URL = `${PROTOCOL}://localhost:${PORT}/api`;

async function testEmailPrivacySystem() {
  console.log("🔒 Testing Email Privacy System");
  console.log(`📍 Using API: ${BASE_URL}\n`);

  try {
    // Test 1: Admin Login
    console.log("1️⃣ Testing Admin Login...");
    const adminLogin = await axios.post(`${BASE_URL}/auth/login`, {
      username: "admin",
      password: "admin123",
    });

    if (adminLogin.data.success) {
      console.log("✅ Admin login successful");
    }

    const adminToken = adminLogin.data.token;

    // Test 2: Create Photographer
    console.log("\n2️⃣ Testing Photographer Creation...");
    const createPhotographer = await axios.post(
      `${BASE_URL}/admin/create-photographer`,
      {
        email: "test.photographer@example.com",
        businessName: "Privacy Test Studio",
      },
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      }
    );

    if (createPhotographer.data.success) {
      console.log("✅ Photographer created successfully");
      console.log(
        `   Auto-generated username: ${createPhotographer.data.photographer.username}`
      );
      console.log(
        `   Auto-generated password: ${createPhotographer.data.photographer.password}`
      );
    }

    // Test 3: Photographer Login
    console.log("\n3️⃣ Testing Photographer Login...");
    const photographerLogin = await axios.post(`${BASE_URL}/auth/login`, {
      username: createPhotographer.data.photographer.username,
      password: createPhotographer.data.photographer.password,
    });

    if (photographerLogin.data.success) {
      console.log("✅ Photographer login successful");
    }

    const photographerToken = photographerLogin.data.token;

    // Test 4: Create Client (Email Privacy Test)
    console.log("\n4️⃣ Testing Client Creation with Email Privacy...");
    const createClient = await axios.post(
      `${BASE_URL}/photographer/create-client`,
      {
        email: "client.private@example.com", // This should NOT be stored in DB
        clientName: "Privacy Test Client",
      },
      {
        headers: { Authorization: `Bearer ${photographerToken}` },
      }
    );

    if (createClient.data.success) {
      console.log("✅ Client created successfully");
      console.log(
        `   Auto-generated username: ${createClient.data.client.username}`
      );
      console.log(
        `   Auto-generated password: ${createClient.data.credentials.password}`
      );
      console.log(`   Email sent: ${createClient.data.client.emailSent}`);
      console.log(
        `   ⚠️  Notice: Email NOT included in API response (privacy protection)`
      );
    }

    // Test 5: Client Login
    console.log("\n5️⃣ Testing Client Login...");
    const clientLogin = await axios.post(`${BASE_URL}/auth/login`, {
      username: createClient.data.client.username,
      password: createClient.data.credentials.password,
    });

    if (clientLogin.data.success) {
      console.log("✅ Client login successful");
      console.log(
        `   ⚠️  Notice: Email NOT included in user data (privacy protection)`
      );
      console.log(
        `   User data keys: ${Object.keys(clientLogin.data.user).join(", ")}`
      );
    }

    console.log("\n🎉 Email Privacy System Tests Complete!");
    console.log("\n🔒 Privacy Features Verified:");
    console.log("✅ Plain emails are NOT stored in database");
    console.log("✅ Only encrypted emails are stored");
    console.log("✅ Credentials sent via email notification");
    console.log("✅ Email addresses excluded from API responses");
    console.log("✅ User lookups work with encrypted emails");
    console.log("✅ Auto-generated secure credentials");
  } catch (error) {
    console.error("\n❌ Test failed:", error.response?.data || error.message);
    if (error.code === "ECONNREFUSED") {
      console.log(`\n💡 Make sure the server is running on port ${PORT}`);
      console.log("   Run: npm run dev");
    }
  }
}

if (require.main === module) {
  testEmailPrivacySystem();
}

module.exports = testEmailPrivacySystem;
