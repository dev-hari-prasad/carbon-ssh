import { describe, it, expect } from "vitest";
import { normalizePassphrase, combinePassphrases, combineAnswers } from "../normalization";
import {
  hexFromBytes,
  hexToBytes,
  generateRandomBytes,
  sha256,
  derivePassphraseKey,
  deriveVerificationKeyStandard,
  deriveVerificationKeyAdvanced,
  encryptVerificationToken,
  decryptVerificationToken,
  calculateChecksum,
} from "../crypto";

describe("Recovery Normalization Pipeline", () => {
  it("should normalize passphrases correctly", () => {
    // 1. Casing, trimming, and punctuation
    const p1 = "  Coffee tastes BETTER during thunderstorms!!!  ";
    expect(normalizePassphrase(p1)).toBe("coffee tastes better during thunderstorms");

    // 2. Non-alphanumeric unicode character class stripping
    const p2 = "Purple, Tiger: rides a bicycle? 🚀";
    expect(normalizePassphrase(p2)).toBe("purple tiger rides a bicycle");

    // 3. Multi-spaces collapse
    const p3 = "word1     word2\tword3\nword4";
    expect(normalizePassphrase(p3)).toBe("word1 word2 word3 word4");

    // 4. Unicode NFC normalization (represented as NFC)
    const p4 = "M\u00fcnchen"; // München with precomposed ü
    const p5 = "Mu\u0308nchen"; // München with combining diaeresis
    expect(normalizePassphrase(p4)).toBe("münchen");
    expect(normalizePassphrase(p5)).toBe("münchen");
  });

  it("should combine three passphrases with a strict colon delimiter", () => {
    const combined = combinePassphrases(
      "  Coffee tastes BETTER during thunderstorms!!!  ",
      "Purple, Tiger: rides a bicycle? 🚀",
      "M\u00fcnchen",
    );
    expect(combined).toBe(
      "coffee tastes better during thunderstorms:purple tiger rides a bicycle:münchen",
    );
  });

  it("should combine any number of answers with a strict colon delimiter", () => {
    const combined = combineAnswers([
      "  Coffee tastes BETTER during thunderstorms!!!  ",
      "Purple, Tiger: rides a bicycle? 🚀",
    ]);
    expect(combined).toBe("coffee tastes better during thunderstorms:purple tiger rides a bicycle");
  });
});

describe("Recovery Cryptography operations", () => {
  const pass1 = "coffee tastes better during thunderstorms";
  const pass2 = "purple tiger rides a bicycle";
  const pass3 = "munich is a great city";
  const combined = combinePassphrases(pass1, pass2, pass3);

  it("should complete standard recovery flow successfully", async () => {
    const saltAnswers = generateRandomBytes(16);
    const saltVerification = generateRandomBytes(16);
    const iv = generateRandomBytes(12);

    // Derive K_questions (Argon2id)
    const kQuestions = await derivePassphraseKey(combined, saltAnswers);
    expect(kQuestions.length).toBe(32);

    // Derive K_standard_verification (HKDF)
    const kStandardVerification = await deriveVerificationKeyStandard(kQuestions, saltVerification);
    expect(kStandardVerification.length).toBe(32);

    // Encrypt Verification Token
    const verificationToken = generateRandomBytes(32);
    const verificationTokenHash = await sha256(verificationToken);

    const { ciphertext, authTag } = await encryptVerificationToken(
      kStandardVerification,
      verificationToken,
      iv,
    );

    expect(ciphertext.length).toBe(32);
    expect(authTag.length).toBe(16);

    // Decrypt Verification Token
    const decryptedToken = await decryptVerificationToken(
      kStandardVerification,
      ciphertext,
      authTag,
      iv,
    );

    expect(hexFromBytes(decryptedToken)).toBe(hexFromBytes(verificationToken));

    // Verify Hash match
    const decryptedHash = await sha256(decryptedToken);
    expect(hexFromBytes(decryptedHash)).toBe(hexFromBytes(verificationTokenHash));

    // Fail decryption with wrong passphrases
    const wrongCombined = combinePassphrases(pass1, pass2, "wrong passphrase");
    const wrongKQuestions = await derivePassphraseKey(wrongCombined, saltAnswers);
    const wrongKStandardVerification = await deriveVerificationKeyStandard(
      wrongKQuestions,
      saltVerification,
    );

    await expect(
      decryptVerificationToken(wrongKStandardVerification, ciphertext, authTag, iv),
    ).rejects.toThrow();
  });

  it("should complete advanced recovery flow successfully", async () => {
    const saltAnswers = generateRandomBytes(16);
    const saltVerification = generateRandomBytes(16);
    const iv = generateRandomBytes(12);
    const recoverySecret = generateRandomBytes(32);

    // Derive K_questions (Argon2id)
    const kQuestions = await derivePassphraseKey(combined, saltAnswers);

    // Derive K_advanced_verification (HKDF)
    const kAdvancedVerification = await deriveVerificationKeyAdvanced(
      recoverySecret,
      kQuestions,
      saltVerification,
    );
    expect(kAdvancedVerification.length).toBe(32);

    // Encrypt Verification Token
    const verificationToken = generateRandomBytes(32);
    const verificationTokenHash = await sha256(verificationToken);

    const { ciphertext, authTag } = await encryptVerificationToken(
      kAdvancedVerification,
      verificationToken,
      iv,
    );

    // Decrypt Verification Token
    const decryptedToken = await decryptVerificationToken(
      kAdvancedVerification,
      ciphertext,
      authTag,
      iv,
    );
    expect(hexFromBytes(decryptedToken)).toBe(hexFromBytes(verificationToken));

    const decryptedHash = await sha256(decryptedToken);
    expect(hexFromBytes(decryptedHash)).toBe(hexFromBytes(verificationTokenHash));

    // Fail decryption if wrong secret uploaded
    const wrongSecret = generateRandomBytes(32);
    const wrongKAdvancedVerification = await deriveVerificationKeyAdvanced(
      wrongSecret,
      kQuestions,
      saltVerification,
    );
    await expect(
      decryptVerificationToken(wrongKAdvancedVerification, ciphertext, authTag, iv),
    ).rejects.toThrow();

    // Fail decryption if wrong answers entered
    const wrongCombined = combinePassphrases(pass1, pass2, "wrong passphrase");
    const wrongKQuestions = await derivePassphraseKey(wrongCombined, saltAnswers);
    const wrongKAdvancedVerificationAnswers = await deriveVerificationKeyAdvanced(
      recoverySecret,
      wrongKQuestions,
      saltVerification,
    );
    await expect(
      decryptVerificationToken(wrongKAdvancedVerificationAnswers, ciphertext, authTag, iv),
    ).rejects.toThrow();
  });

  it("should calculate checksum correctly and reject modifications", async () => {
    const version = 1;
    const recoveryId = "rec_test_123456789";
    const secret = hexFromBytes(generateRandomBytes(32));

    const checksum = await calculateChecksum(version, recoveryId, secret);
    expect(checksum.length).toBe(64); // SHA-256 hex length

    const match = await calculateChecksum(version, recoveryId, secret);
    expect(match).toBe(checksum);

    // Check modification changes checksum
    const modifiedId = "rec_test_123456780";
    const modifiedChecksum = await calculateChecksum(version, modifiedId, secret);
    expect(modifiedChecksum).not.toBe(checksum);
  });
});
