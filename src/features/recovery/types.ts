export interface RecoveryMetadata {
  version: number; // Version of recovery schema (starts at 1)
  mode: "standard" | "advanced"; // Recovery mode selected by user
  recoveryId?: string; // Set only in advanced mode
  saltAnswersHex: string; // 16-byte random salt for Argon2id (hex string)
  saltVerificationHex: string; // 16-byte random salt for HKDF (hex string)
  aesIvHex: string; // 12-byte initialization vector for AES-GCM
  aesAuthTagHex: string; // 16-byte authentication tag for AES-GCM
  encryptedVerificationTokenHex: string; // Encrypted 32-byte VerificationToken
  verificationTokenHashHex: string; // SHA-256 hash of the VerificationToken
  createdAt: number; // Timestamp
  questions?: string[]; // Configured recovery questions (minimum 2, maximum 5)
}

export interface RecoveryKeyFile {
  version: number;
  app: string;
  created_at: string;
  recovery_id: string;
  recovery_secret: string;
  checksum: string;
}
