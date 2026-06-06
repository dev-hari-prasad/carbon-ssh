import { argon2id } from "hash-wasm";

/**
 * Converts a Uint8Array to a hex string.
 */
export function hexFromBytes(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Converts a hex string to a Uint8Array.
 */
export function hexToBytes(hex: string): Uint8Array {
  if (typeof hex !== "string" || !/^[0-9a-fA-F]+$/.test(hex) || hex.length % 2 !== 0) {
    throw new Error("Invalid hex string");
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/**
 * Returns a cryptographically secure random Uint8Array of the specified length.
 */
export function generateRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

/**
 * Computes SHA-256 hash of a Uint8Array.
 */
export async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", data as any);
  return new Uint8Array(hashBuffer);
}

/**
 * Derives a 256-bit key from combined passphrases using Argon2id.
 * Parameters: Memory 64MB, Iterations 3, Parallelism 4, Hash length 32 bytes.
 */
export async function derivePassphraseKey(
  combinedPassphrases: string,
  salt: Uint8Array
): Promise<Uint8Array> {
  return await argon2id({
    password: combinedPassphrases,
    salt: salt as any,
    parallelism: 4,
    iterations: 3,
    memorySize: 65536, // 64 MB in KB
    hashLength: 32,
    outputType: "binary",
  });
}

/**
 * Derives verification key in Standard Mode (passphrases only) using HKDF-SHA256.
 * Salt: HKDF salt
 * Info: "carbon-standard-recovery-v1"
 */
export async function deriveVerificationKeyStandard(
  passphraseKey: Uint8Array,
  salt: Uint8Array
): Promise<Uint8Array> {
  const ikmKey = await globalThis.crypto.subtle.importKey(
    "raw",
    passphraseKey as any,
    "HKDF",
    false,
    ["deriveBits"]
  );

  const derivedBuffer = await globalThis.crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: salt as any,
      info: new TextEncoder().encode("carbon-standard-recovery-v1"),
    },
    ikmKey,
    256 // 256 bits = 32 bytes
  );

  return new Uint8Array(derivedBuffer);
}

/**
 * Derives verification key in Advanced Mode (passphrases + recovery secret) using HKDF-SHA256.
 * IKM: Concatenation of RecoverySecret (32 bytes) and passphraseKey (32 bytes)
 * Salt: HKDF salt
 * Info: "carbon-advanced-recovery-v1"
 */
export async function deriveVerificationKeyAdvanced(
  recoverySecret: Uint8Array,
  passphraseKey: Uint8Array,
  salt: Uint8Array
): Promise<Uint8Array> {
  const ikm = new Uint8Array(recoverySecret.length + passphraseKey.length);
  ikm.set(recoverySecret, 0);
  ikm.set(passphraseKey, recoverySecret.length);

  const ikmKey = await globalThis.crypto.subtle.importKey(
    "raw",
    ikm as any,
    "HKDF",
    false,
    ["deriveBits"]
  );

  const derivedBuffer = await globalThis.crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: salt as any,
      info: new TextEncoder().encode("carbon-advanced-recovery-v1"),
    },
    ikmKey,
    256 // 256 bits = 32 bytes
  );

  return new Uint8Array(derivedBuffer);
}

/**
 * Encrypts a 32-byte VerificationToken using AES-256-GCM.
 * Separates ciphertext and auth tag for database storage compatibility.
 */
export async function encryptVerificationToken(
  verificationKey: Uint8Array,
  token: Uint8Array,
  iv: Uint8Array
): Promise<{ ciphertext: Uint8Array; authTag: Uint8Array }> {
  const aesKey = await globalThis.crypto.subtle.importKey(
    "raw",
    verificationKey as any,
    "AES-GCM",
    false,
    ["encrypt"]
  );

  const encryptedBuffer = await globalThis.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv as any,
      tagLength: 128, // 16 bytes auth tag
    },
    aesKey,
    token as any
  );

  const encryptedArray = new Uint8Array(encryptedBuffer);
  const ciphertext = encryptedArray.slice(0, encryptedArray.length - 16);
  const authTag = encryptedArray.slice(encryptedArray.length - 16);

  return { ciphertext, authTag };
}

/**
 * Decrypts VerificationToken using AES-256-GCM.
 */
export async function decryptVerificationToken(
  verificationKey: Uint8Array,
  ciphertext: Uint8Array,
  authTag: Uint8Array,
  iv: Uint8Array
): Promise<Uint8Array> {
  const aesKey = await globalThis.crypto.subtle.importKey(
    "raw",
    verificationKey as any,
    "AES-GCM",
    false,
    ["decrypt"]
  );

  const cipherWithTag = new Uint8Array(ciphertext.length + authTag.length);
  cipherWithTag.set(ciphertext, 0);
  cipherWithTag.set(authTag, ciphertext.length);

  const decryptedBuffer = await globalThis.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv as any,
      tagLength: 128,
    },
    aesKey,
    cipherWithTag as any
  );

  return new Uint8Array(decryptedBuffer);
}

/**
 * Calculates SHA-256 checksum for the carbon-recovery.key file.
 */
export async function calculateChecksum(
  version: number,
  recoveryId: string,
  recoverySecretHex: string
): Promise<string> {
  const payload = `${version}:${recoveryId}:${recoverySecretHex}`;
  const data = new TextEncoder().encode(payload);
  const hash = await sha256(data);
  return hexFromBytes(hash);
}
