require("dotenv").config();
const axios = require("axios");

const BASE_URL = `http://localhost:${process.env.PORT || 7000}/api`;

async function testAuthentication() {
  console.log("🧪 Testing Authentication Endpoints...\n");

  try {
    // Test health endpoint
    console.log("1. Testing health endpoint...");
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log("✅ Health check:", healthResponse.data.message);

    // Test user registration
    console.log("\n2. Testing user registration...");
    const testUser = {
      username: "testuser",
      email: "test@example.com",
      password: "TestPassword123",
    };

    try {
      const registerResponse = await axios.post(
        `${BASE_URL}/auth/register`,
        testUser
      );
      console.log("✅ Registration successful:", registerResponse.data.message);
      console.log(
        "🔑 Token received:",
        registerResponse.data.token ? "Yes" : "No"
      );

      const token = registerResponse.data.token;

      // Test login
      console.log("\n3. Testing user login...");
      const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
        username: testUser.username,
        password: testUser.password,
      });
      console.log("✅ Login successful:", loginResponse.data.message);
      console.log(
        "🔑 Token received:",
        loginResponse.data.token ? "Yes" : "No"
      );

      // Test protected route
      console.log("\n4. Testing protected route...");
      const protectedResponse = await axios.get(`${BASE_URL}/protected`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      console.log("✅ Protected route access:", protectedResponse.data.message);

      // Test profile endpoint
      console.log("\n5. Testing profile endpoint...");
      const profileResponse = await axios.get(`${BASE_URL}/auth/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      console.log(
        "✅ Profile access successful:",
        profileResponse.data.user.username
      );

      // Test token verification
      console.log("\n6. Testing token verification...");
      const verifyResponse = await axios.get(`${BASE_URL}/auth/verify`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      console.log("✅ Token verification:", verifyResponse.data.message);
    } catch (error) {
      if (
        error.response &&
        error.response.data.message.includes("already exists")
      ) {
        console.log("ℹ️ User already exists, testing login only...");

        const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
          username: testUser.username,
          password: testUser.password,
        });
        console.log("✅ Login successful:", loginResponse.data.message);
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error(
      "❌ Test failed:",
      error.response ? error.response.data : error.message
    );
  }
}

// Test validation errors
async function testValidationErrors() {
  console.log("\n🧪 Testing Validation Errors...\n");

  try {
    // Test registration with invalid data
    console.log("1. Testing registration with invalid email...");
    await axios.post(`${BASE_URL}/auth/register`, {
      username: "test",
      email: "invalid-email",
      password: "weak",
    });
  } catch (error) {
    console.log("✅ Validation error caught:", error.response.data.message);
  }

  try {
    // Test login with missing data
    console.log("2. Testing login with missing password...");
    await axios.post(`${BASE_URL}/auth/login`, {
      username: "testuser",
    });
  } catch (error) {
    console.log("✅ Validation error caught:", error.response.data.message);
  }

  try {
    // Test protected route without token
    console.log("3. Testing protected route without token...");
    await axios.get(`${BASE_URL}/protected`);
  } catch (error) {
    console.log("✅ Auth error caught:", error.response.data.message);
  }
}

if (require.main === module) {
  setTimeout(async () => {
    await testAuthentication();
    await testValidationErrors();
    console.log("\n🎉 All tests completed!");
  }, 2000); // Wait 2 seconds for server to start
}

module.exports = { testAuthentication, testValidationErrors };
