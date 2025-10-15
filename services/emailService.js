const nodemailer = require("nodemailer");

class EmailService {
  constructor() {
    // Log email configuration for development
    console.log("📧 Email Service Configuration:");
    console.log("   SMTP Host:", "smtp.zoho.eu");
    console.log("   SMTP Port:", 465);
    console.log("   User:", "support@stoyanography.com");
    console.log("   Password configured:", !!process.env.ZOHOPASS);
    console.log(
      "   Password length:",
      process.env.ZOHOPASS ? process.env.ZOHOPASS.length : 0
    );

    // Development mode - show actual password for debugging
    if (process.env.NODE_ENV === "development") {
      console.log("   Password (DEV):", process.env.ZOHOPASS);
    }

    // Zoho SMTP configuration
    this.transporter = nodemailer.createTransport({
      host: "smtp.zoho.eu",
      port: 465,
      secure: true,
      auth: {
        user: "support@stoyanography.com",
        pass: process.env.ZOHOPASS,
      },
    });

    // Verify connection configuration
    this.transporter.verify(function (error, success) {
      if (error) {
        console.error("❌ Email server connection error:", error.message);
      } else {
        console.log("✅ Email server is ready to send messages");
      }
    });
  }

  async sendEmail(from, to, subject, text, html = null) {
    const mailOptions = {
      from: from,
      to: to,
      subject: subject,
      text: text,
      ...(html && { html: html }),
    };

    return new Promise((resolve, reject) => {
      this.transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
          console.log(error);
          return reject(error);
        } else {
          console.log("Email sent to: " + info.response);
          return resolve(info);
        }
      });
    });
  }

  async sendClientCredentials(clientEmail, credentials, photographerInfo) {
    const emailTemplate = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Welcome to Stoyanography Share</h2>
        
        <p>Hello,</p>
        
        <p>You have been invited by <strong>${
          photographerInfo.businessName || photographerInfo.username
        }</strong> to access your photos on our secure platform.</p>
        
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Your Login Credentials:</h3>
          <p><strong>Username:</strong> ${credentials.username}</p>
          <p><strong>Password:</strong> ${credentials.password}</p>
          <p><strong>Login URL:</strong> ${
            process.env.FRONTEND_URL || "http://localhost:3001"
          }/login</p>
        </div>
        
        <p><strong>Important Security Notes:</strong></p>
        <ul>
          <li>Please change your password after your first login</li>
          <li>Keep your credentials secure and don't share them</li>
          <li>Your email address is not stored on our servers for privacy</li>
        </ul>
        
        <p>If you have any questions, please contact your photographer directly.</p>
        
        <p>Best regards,<br>Stoyanography Share Team</p>
      </div>
    `;

    const textVersion = `
Welcome to Stoyanography Share

You have been invited by ${
      photographerInfo.businessName || photographerInfo.username
    } to access your photos on our secure platform.

Your Login Credentials:
Username: ${credentials.username}
Password: ${credentials.password}
Login URL: ${process.env.FRONTEND_URL || "http://localhost:3001"}/login

Important Security Notes:
- Please change your password after your first login
- Keep your credentials secure and don't share them
- Your email address is not stored on our servers for privacy

If you have any questions, please contact your photographer directly.

Best regards,
Stoyanography Share Team
    `;

    try {
      const info = await this.sendEmail(
        "Stoyanography Share <support@stoyanography.com>",
        clientEmail,
        "Your Photo Access Credentials",
        textVersion,
        emailTemplate
      );
      console.log("Client credentials email sent:", info.response);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error("Email sending failed:", error);
      return { success: false, error: error.message };
    }
  }

  async sendGuestCredentials(guestEmail, credentials, clientInfo, photoCount) {
    const emailTemplate = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Photo Access Invitation</h2>
        
        <p>Hello,</p>
        
        <p>You have been invited by <strong>${
          clientInfo.clientName
        }</strong> to view ${photoCount} photo(s) on our secure platform.</p>
        
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Your Temporary Access Credentials:</h3>
          <p><strong>Username:</strong> ${credentials.username}</p>
          <p><strong>Password:</strong> ${credentials.password}</p>
          <p><strong>Login URL:</strong> ${
            process.env.FRONTEND_URL || "http://localhost:3001"
          }/login</p>
          <p><strong>Access Expires:</strong> ${new Date(
            credentials.expiresAt
          ).toLocaleDateString()}</p>
        </div>
        
        <p><strong>Important Notes:</strong></p>
        <ul>
          <li>This is temporary access that will expire on the date shown above</li>
          <li>Your email address is not stored on our servers for privacy</li>
          <li>You can view and download the shared photos during the access period</li>
        </ul>
        
        <p>Best regards,<br>Stoyanography Share Team</p>
      </div>
    `;

    const textVersion = `
Photo Access Invitation

You have been invited by ${
      clientInfo.clientName
    } to view ${photoCount} photo(s) on our secure platform.

Your Temporary Access Credentials:
Username: ${credentials.username}
Password: ${credentials.password}
Login URL: ${process.env.FRONTEND_URL || "http://localhost:3001"}/login
Access Expires: ${new Date(credentials.expiresAt).toLocaleDateString()}

Important Notes:
- This is temporary access that will expire on the date shown above
- Your email address is not stored on our servers for privacy
- You can view and download the shared photos during the access period

Best regards,
Stoyanography Share Team
    `;

    try {
      const info = await this.sendEmail(
        "Stoyanography Share <support@stoyanography.com>",
        guestEmail,
        "Photo Viewing Access - Temporary Credentials",
        textVersion,
        emailTemplate
      );
      console.log("Guest credentials email sent:", info.response);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error("Email sending failed:", error);
      return { success: false, error: error.message };
    }
  }

  async sendPhotographerCredentials(
    photographerEmail,
    credentials,
    adminInfo = null
  ) {
    console.log("📧 Attempting to send photographer credentials email...");
    console.log("   To:", photographerEmail);
    console.log("   Username:", credentials.username);
    console.log("   Business:", credentials.businessName);

    const emailTemplate = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Welcome to Stoyanography Share - Photographer Account</h2>
        
        <p>Hello,</p>
        
        <p>An administrator has created a photographer account for you on Stoyanography Share.</p>
        
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Your Login Credentials:</h3>
          <p><strong>Business Name:</strong> ${credentials.businessName}</p>
          <p><strong>Username:</strong> ${credentials.username}</p>
          <p><strong>Password:</strong> ${credentials.password}</p>
          <p><strong>Login URL:</strong> ${
            process.env.FRONTEND_URL || "http://localhost:3001"
          }</p>
        </div>
        
        <p><strong>What you can do:</strong></p>
        <ul>
          <li>Upload and manage photos</li>
          <li>Create client accounts</li>
          <li>Share photos with clients</li>
          <li>Manage client access to photos</li>
        </ul>
        
        <p><strong>Important Security Notes:</strong></p>
        <ul>
          <li>Please change your password after your first login</li>
          <li>Keep your credentials secure and don't share them</li>
          <li>Your email address is not stored on our servers for privacy</li>
        </ul>
        
        <p>If you have any questions, please contact the administrator.</p>
        
        <p>Best regards,<br>Stoyanography Share Team</p>
      </div>
    `;

    const textVersion = `
Welcome to Stoyanography Share - Photographer Account

An administrator has created a photographer account for you on Stoyanography Share.

Your Login Credentials:
Business Name: ${credentials.businessName}
Username: ${credentials.username}
Password: ${credentials.password}
Login URL: ${process.env.FRONTEND_URL || "http://localhost:3001"}

What you can do:
- Upload and manage photos
- Create client accounts
- Share photos with clients
- Manage client access to photos

Important Security Notes:
- Please change your password after your first login
- Keep your credentials secure and don't share them
- Your email address is not stored on our servers for privacy

If you have any questions, please contact the administrator.

Best regards,
Stoyanography Share Team
    `;

    try {
      console.log("📤 Sending email via Zoho SMTP...");
      const info = await this.sendEmail(
        "Stoyanography Share <support@stoyanography.com>",
        photographerEmail,
        "Your Photographer Account Credentials",
        textVersion,
        emailTemplate
      );

      console.log(
        `✅ Photographer credentials email sent successfully to ${photographerEmail}`
      );
      console.log("   Message ID:", info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error("❌ Failed to send photographer credentials email:");
      console.error("   Error:", error.message);
      console.error("   Full error:", error);
      throw error;
    }
  }

  async sendCollectionSharedNotification(
    clientEmail,
    collectionInfo,
    photographerInfo
  ) {
    const emailTemplate = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0ea5a4;">📁 New Photo Collection Shared!</h2>
        
        <p>Hello,</p>
        
        <p><strong>${
          photographerInfo.businessName || photographerInfo.username
        }</strong> has shared a new photo collection with you.</p>
        
        <div style="background-color: #f0fffe; border-left: 4px solid #0ea5a4; padding: 20px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #0ea5a4;">📸 ${
            collectionInfo.name
          }</h3>
          ${
            collectionInfo.description
              ? `<p style="color: #555;">${collectionInfo.description}</p>`
              : ""
          }
          <p><strong>Photos:</strong> ${collectionInfo.photoCount || 0}</p>
          <p><strong>Auto-deletes in:</strong> ${
            collectionInfo.daysRemaining || 14
          } days</p>
        </div>
        
        <p style="margin: 30px 0;">
          <a href="${
            process.env.FRONTEND_URL || "http://localhost:3001"
          }/login" 
             style="background-color: #0ea5a4; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            View Collection
          </a>
        </p>
        
        <p><strong>What you can do:</strong></p>
        <ul>
          <li>View all photos in this collection</li>
          <li>Download individual photos or the entire collection</li>
          <li>Share selected photos with guests (coming soon)</li>
        </ul>
        
        <p style="color: #888; font-size: 13px; margin-top: 30px;">
          <strong>Privacy Notice:</strong> Collections automatically delete after 14 days. 
          Your email is encrypted and stored securely.
        </p>
        
        <p>Best regards,<br>Stoyanography Share Team</p>
      </div>
    `;

    const textVersion = `
📁 New Photo Collection Shared!

Hello,

${
  photographerInfo.businessName || photographerInfo.username
} has shared a new photo collection with you.

Collection Details:
- Name: ${collectionInfo.name}
${
  collectionInfo.description
    ? `- Description: ${collectionInfo.description}`
    : ""
}
- Photos: ${collectionInfo.photoCount || 0}
- Auto-deletes in: ${collectionInfo.daysRemaining || 14} days

Login to view: ${process.env.FRONTEND_URL || "http://localhost:3001"}/login

What you can do:
- View all photos in this collection
- Download individual photos or the entire collection
- Share selected photos with guests (coming soon)

Privacy Notice: Collections automatically delete after 14 days. 
Your email is encrypted and stored securely.

Best regards,
Stoyanography Share Team
    `;

    try {
      const info = await this.sendEmail(
        "Stoyanography Share <support@stoyanography.com>",
        clientEmail,
        `📁 New Collection: ${collectionInfo.name}`,
        textVersion,
        emailTemplate
      );
      console.log("Collection shared notification sent:", info.response);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error("Email sending failed:", error);
      return { success: false, error: error.message };
    }
  }

  // For development/testing - log email instead of sending
  async logEmailInstead(type, recipient, credentials) {
    console.log("\n🔔 EMAIL NOTIFICATION (Development Mode)");
    console.log("=====================================");
    console.log(`Type: ${type}`);
    console.log(`To: ${recipient}`);
    console.log(`Username: ${credentials.username}`);
    console.log(`Password: ${credentials.password}`);
    if (credentials.expiresAt) {
      console.log(`Expires: ${credentials.expiresAt}`);
    }
    console.log("=====================================\n");

    return { success: true, messageId: "dev-mode-logged" };
  }
}

module.exports = EmailService;
