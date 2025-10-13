require("dotenv").config();
const EmailService = require("../services/emailService");

async function testZohoEmail() {
  console.log("📧 Testing Zoho Email Integration\n");

  if (!process.env.ZOHOPASS) {
    console.log("❌ ZOHOPASS not set in environment variables");
    console.log("💡 Please add ZOHOPASS=your_password to .env file");
    return;
  }

  const emailService = new EmailService();

  try {
    // Test client credentials email
    console.log("1️⃣ Testing Client Credentials Email...");
    const clientResult = await emailService.sendClientCredentials(
      "test.client@example.com", // Replace with a real email for testing
      {
        username: "TEST_USER_123",
        password: "SecurePass456!",
      },
      {
        businessName: "Test Photography Studio",
        username: "test_photographer",
      }
    );

    if (clientResult.success) {
      console.log("✅ Client credentials email sent successfully");
      console.log(`   Message ID: ${clientResult.messageId}`);
    } else {
      console.log("❌ Client email failed:", clientResult.error);
    }

    // Test guest credentials email
    console.log("\n2️⃣ Testing Guest Credentials Email...");
    const guestResult = await emailService.sendGuestCredentials(
      "test.guest@example.com", // Replace with a real email for testing
      {
        username: "GUEST_789",
        password: "TempPass123!",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        clientName: "Test Client",
      },
      5 // 5 photos shared
    );

    if (guestResult.success) {
      console.log("✅ Guest credentials email sent successfully");
      console.log(`   Message ID: ${guestResult.messageId}`);
    } else {
      console.log("❌ Guest email failed:", guestResult.error);
    }

    console.log("\n🎉 Zoho Email Integration Test Complete!");
    console.log("\n📝 Notes:");
    console.log(
      "• Replace test email addresses with real ones for actual testing"
    );
    console.log("• Emails are sent from: support@stoyanography.com");
    console.log("• Using Zoho SMTP: smtp.zoho.eu:465");
  } catch (error) {
    console.error("\n❌ Email test failed:", error.message);

    if (error.code === "EAUTH") {
      console.log("\n💡 Authentication failed. Please check:");
      console.log("• ZOHOPASS environment variable is correct");
      console.log("• support@stoyanography.com account credentials");
      console.log("• Zoho account has SMTP enabled");
    }
  }
}

if (require.main === module) {
  testZohoEmail();
}

module.exports = testZohoEmail;
