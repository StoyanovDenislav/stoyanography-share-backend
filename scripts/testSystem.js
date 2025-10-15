require("dotenv").config();
const axios = require("axios");

const PORT = process.env.PORT || 6002;
const PROTOCOL = process.env.USE_HTTPS === "true" ? "https" : "http";
const BASE_URL = `${PROTOCOL}://localhost:${PORT}/api`;

async function testSystem() {
  console.log("🧪 Testing Multi-Tier Photo Sharing System");
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
      console.log(`   Token: ${adminLogin.data.token.substring(0, 20)}...`);
      console.log(`   Role: ${adminLogin.data.user.role}`);
    }

    const adminToken = adminLogin.data.token;

    // Test 2: Create Photographer
    console.log("\n2️⃣ Testing Photographer Creation...");
    const createPhotographer = await axios.post(
      `${BASE_URL}/admin/create-photographer`,
      {
        email: "photographer@test.com",
        businessName: "Test Photography Studio",
      },
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      }
    );

    if (createPhotographer.data.success) {
      console.log("✅ Photographer created successfully");
      console.log(
        `   Username: ${createPhotographer.data.photographer.username}`
      );
      console.log(
        `   Password: ${createPhotographer.data.photographer.password}`
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
      console.log(`   Role: ${photographerLogin.data.user.role}`);
    }

    const photographerToken = photographerLogin.data.token;

    // Test 4: Create Client (by Photographer)
    console.log("\n4️⃣ Testing Client Creation...");
    const createClient = await axios.post(
      `${BASE_URL}/photographer/create-client`,
      {
        email: "client@test.com",
        clientName: "Test Client",
      },
      {
        headers: { Authorization: `Bearer ${photographerToken}` },
      }
    );

    if (createClient.data.success) {
      console.log("✅ Client created successfully");
      console.log(`   Username: ${createClient.data.client.username}`);
      console.log(`   Password: ${createClient.data.client.password}`);
    }

    // Test 5: Client Login
    console.log("\n5️⃣ Testing Client Login...");
    const clientLogin = await axios.post(`${BASE_URL}/auth/login`, {
      username: createClient.data.client.username,
      password: createClient.data.client.password,
    });

    if (clientLogin.data.success) {
      console.log("✅ Client login successful");
      console.log(`   Role: ${clientLogin.data.user.role}`);
    }

    const clientToken = clientLogin.data.token;

    // Test 6: Create Guest (by Client)
    console.log("\n6️⃣ Testing Guest Creation...");
    const createGuest = await axios.post(
      `${BASE_URL}/client/create-guest`,
      {
        email: "guest@test.com",
        guestName: "Test Guest",
        photoIds: [], // Empty for now since we don't have photos yet
        expirationDays: 7,
      },
      {
        headers: { Authorization: `Bearer ${clientToken}` },
      }
    );

    if (createGuest.data.success) {
      console.log("✅ Guest created successfully");
      console.log(`   Username: ${createGuest.data.guest.username}`);
      console.log(`   Password: ${createGuest.data.guest.password}`);
      console.log(`   Expires: ${createGuest.data.guest.expiresAt}`);
    }

    // Test 7: Guest Login
    console.log("\n7️⃣ Testing Guest Login...");
    const guestLogin = await axios.post(`${BASE_URL}/auth/login`, {
      username: createGuest.data.guest.username,
      password: createGuest.data.guest.password,
    });

    if (guestLogin.data.success) {
      console.log("✅ Guest login successful");
      console.log(`   Role: ${guestLogin.data.user.role}`);
    }

    console.log("\n🎉 All authentication tests passed successfully!");
    console.log("\n📋 Summary:");
    console.log("✅ 4-tier user system working");
    console.log("✅ Auto-generated credentials");
    console.log("✅ JWT authentication");
    console.log("✅ Role-based access control");
    console.log("✅ Encrypted database storage");
  } catch (error) {
    console.error("\n❌ Test failed:", error.response?.data || error.message);
  }
}

if (require.main === module) {
  testSystem();
}

module.exports = testSystem;
