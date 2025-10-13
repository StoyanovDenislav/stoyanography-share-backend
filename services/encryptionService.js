const crypto = require("crypto");

class EncryptionService {
  constructor() {
    this.algorithm = "aes-256-gcm";
    this.key = crypto.scryptSync(
      process.env.ENCRYPTION_KEY || "default-key",
      "salt",
      32
    );
  }

  encrypt(text) {
    if (!text) return null;

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    cipher.setAAD(Buffer.from("additional-data"));

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();

    return {
      iv: iv.toString("hex"),
      authTag: authTag.toString("hex"),
      encrypted: encrypted,
    };
  }

  decrypt(encryptedData) {
    if (!encryptedData) return null;

    try {
      const { iv, authTag, encrypted } = encryptedData;

      const decipher = crypto.createDecipheriv(
        this.algorithm,
        this.key,
        Buffer.from(iv, "hex")
      );
      decipher.setAAD(Buffer.from("additional-data"));
      decipher.setAuthTag(Buffer.from(authTag, "hex"));

      let decrypted = decipher.update(encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } catch (error) {
      console.error("Decryption error:", error);
      return null;
    }
  }

  // Simpler encryption for basic use cases
  encryptSimple(text) {
    if (!text) return null;

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-cbc", this.key, iv);

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    return iv.toString("hex") + ":" + encrypted;
  }

  decryptSimple(encryptedText) {
    if (!encryptedText) return null;

    try {
      const parts = encryptedText.split(":");
      const iv = Buffer.from(parts[0], "hex");
      const encrypted = parts[1];

      const decipher = crypto.createDecipheriv("aes-256-cbc", this.key, iv);

      let decrypted = decipher.update(encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } catch (error) {
      console.error("Simple decryption error:", error);
      return null;
    }
  }

  hashData(data) {
    return crypto.createHash("sha256").update(data).digest("hex");
  }
}

module.exports = EncryptionService;
