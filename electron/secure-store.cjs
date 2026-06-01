const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const STORE_FILE = "secure-store.v1.json";
const storeCache = new Map();
const storeWriteQueues = new Map();

function defaultStore() {
  return {
    version: 1,
    connections: {},
    connectionMeta: {},
    aiKeys: {},
    knownHosts: {},
  };
}

function getStorePath(app) {
  return path.join(app.getPath("userData"), STORE_FILE);
}

function normalizeStore(parsed) {
  return {
    ...defaultStore(),
    ...(parsed || {}),
    connections: { ...(parsed?.connections || {}) },
    connectionMeta: { ...(parsed?.connectionMeta || {}) },
    aiKeys: { ...(parsed?.aiKeys || {}) },
    knownHosts: { ...(parsed?.knownHosts || {}) },
  };
}

function cloneStore(store) {
  return normalizeStore(JSON.parse(JSON.stringify(store || defaultStore())));
}

function ensureSafeStorageAvailable(safeStorage) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("Secure storage is unavailable on this system");
  }
}

function readStore(app) {
  const file = getStorePath(app);
  const cached = storeCache.get(file);
  if (cached) return cloneStore(cached);

  try {
    if (!fs.existsSync(file)) {
      const fresh = defaultStore();
      storeCache.set(file, cloneStore(fresh));
      return fresh;
    }
    const raw = fs.readFileSync(file, "utf8");
    const parsed = JSON.parse(raw);
    const normalized = normalizeStore(parsed);
    storeCache.set(file, cloneStore(normalized));
    return normalized;
  } catch {
    const fresh = defaultStore();
    storeCache.set(file, cloneStore(fresh));
    return fresh;
  }
}

function writeStore(app, store) {
  const file = getStorePath(app);
  const dir = path.dirname(file);
  const tmp = `${file}.tmp`;
  const normalized = normalizeStore(store);
  const serialized = JSON.stringify(normalized, null, 2);

  storeCache.set(file, cloneStore(normalized));

  const previous = storeWriteQueues.get(file) || Promise.resolve();
  const next = previous
    .catch(() => {})
    .then(async () => {
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.writeFile(tmp, serialized, "utf8");
      await fs.promises.rename(tmp, file);
    })
    .catch((error) => {
      console.error("[secure-store] Failed to persist secure store", error);
      throw error;
    });
  storeWriteQueues.set(file, next.catch(() => {}));
  return next;
}

function encryptJson(safeStorage, value) {
  ensureSafeStorageAvailable(safeStorage);
  const text = JSON.stringify(value);
  return safeStorage.encryptString(text).toString("base64");
}

function decryptJson(safeStorage, encryptedBase64) {
  if (!encryptedBase64) return null;
  ensureSafeStorageAvailable(safeStorage);
  try {
    const buffer = Buffer.from(encryptedBase64, "base64");
    const text = safeStorage.decryptString(buffer);
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalizeHost(host) {
  return String(host || "").trim().toLowerCase();
}

function normalizePort(port) {
  const parsed = Number(port);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) return 22;
  return parsed;
}

function normalizeFingerprint(fingerprint) {
  return String(fingerprint || "").trim().replace(/^SHA256:/i, "");
}

function knownHostKey(host, port, algorithm) {
  return `${normalizeHost(host)}:${normalizePort(port)}:${String(algorithm || "")}`;
}

function saveConnectionSecrets(app, safeStorage, connectionId, secrets) {
  const store = readStore(app);
  store.connections[connectionId] = encryptJson(safeStorage, secrets);
  return writeStore(app, store);
}

function loadConnectionSecrets(app, safeStorage, connectionId) {
  const store = readStore(app);
  return decryptJson(safeStorage, store.connections[connectionId]);
}

function deleteConnectionSecrets(app, connectionId) {
  const store = readStore(app);
  if (store.connections[connectionId]) {
    delete store.connections[connectionId];
    return writeStore(app, store);
  }
  return Promise.resolve();
}

function saveConnectionMetadata(app, connectionId, metadata) {
  const store = readStore(app);
  store.connectionMeta[connectionId] = {
    id: String(metadata.id || connectionId),
    name: String(metadata.name || ""),
    host: String(metadata.host || ""),
    port: normalizePort(metadata.port),
    username: String(metadata.username || ""),
    authType: metadata.authType === "privateKey" ? "privateKey" : "password",
    updatedAt: Date.now(),
  };
  return writeStore(app, store);
}

function loadConnectionMetadata(app, connectionId) {
  const store = readStore(app);
  return store.connectionMeta[connectionId] || null;
}

function deleteConnectionMetadata(app, connectionId) {
  const store = readStore(app);
  if (store.connectionMeta[connectionId]) {
    delete store.connectionMeta[connectionId];
    return writeStore(app, store);
  }
  return Promise.resolve();
}

function saveAiApiKey(app, safeStorage, provider, apiKey, baseUrl) {
  const store = readStore(app);
  const providerKey = String(provider || "").trim();
  if (!providerKey) throw new Error("Provider is required");
  if (!apiKey) {
    delete store.aiKeys[providerKey];
    return writeStore(app, store);
  }
  store.aiKeys[providerKey] = encryptJson(safeStorage, { 
    apiKey: String(apiKey),
    baseUrl: typeof baseUrl === "string" ? baseUrl : undefined
  });
  return writeStore(app, store);
}

function loadAiApiKey(app, safeStorage, provider) {
  const store = readStore(app);
  const providerKey = String(provider || "").trim();
  const parsed = decryptJson(safeStorage, store.aiKeys[providerKey]);
  return {
    apiKey: typeof parsed?.apiKey === "string" ? parsed.apiKey : "",
    baseUrl: typeof parsed?.baseUrl === "string" ? parsed.baseUrl : ""
  };
}

function hasAiApiKey(app, safeStorage, provider) {
  return loadAiApiKey(app, safeStorage, provider).apiKey.length > 0;
}

// ─── Known-host MAC helpers ────────────────────────────────────────────────
//
// Each known-host entry is protected by HMAC-SHA256 keyed with a per-install
// secret that is itself encrypted by safeStorage.  This makes it impossible to
// forge or silently tamper with stored fingerprints without also compromising
// safeStorage (which requires OS-level credential access).

const KNOWN_HOST_MAC_ALG = "sha256";

/**
 * Retrieve (or lazily generate) the HMAC key used to authenticate known-host
 * entries.  The raw key is stored encrypted; only the hex plaintext is returned
 * for in-process use.
 */
function getOrCreateKnownHostMacKey(app, safeStorage) {
  ensureSafeStorageAvailable(safeStorage);

  const store = readStore(app);
  if (store.knownHostMacKey && typeof store.knownHostMacKey === "string") {
    try {
      const buf = Buffer.from(store.knownHostMacKey, "base64");
      return safeStorage.decryptString(buf);
    } catch {
      // Key blob is corrupt — fall through to regenerate.
      console.warn("[security] Known-host MAC key was corrupt; regenerating");
    }
  }

  // First run (or after corruption): generate a fresh key, encrypt it, and
  // persist.  Re-read the store before writing to minimise TOCTOU races.
  const keyHex = crypto.randomBytes(32).toString("hex");
  const fresh = readStore(app);
  fresh.knownHostMacKey = safeStorage.encryptString(keyHex).toString("base64");
  void writeStore(app, fresh).catch(() => {});
  return keyHex;
}

/**
 * Compute a deterministic HMAC over all fields that make a known-host entry
 * meaningful.  Including `trustedAt` prevents replay of older entries whose
 * fingerprint may have since been rotated.
 */
function computeKnownHostMac(keyHex, host, port, algorithm, fingerprint, trustedAt) {
  const canonical = JSON.stringify({
    host: String(host).trim().toLowerCase(),
    port: Number(port) || 22,
    algorithm: String(algorithm || ""),
    fingerprint: String(fingerprint),
    trustedAt: Number(trustedAt),
  });
  return crypto
    .createHmac(KNOWN_HOST_MAC_ALG, Buffer.from(keyHex, "hex"))
    .update(canonical, "utf8")
    .digest("hex");
}

// ─── End known-host MAC helpers ─────────────────────────────────────────────

function trustKnownHost(app, safeStorage, host, port, algorithm, fingerprint) {
  const macKey = getOrCreateKnownHostMacKey(app, safeStorage);
  // Re-read immediately before writing to avoid clobbering concurrent changes.
  const store = readStore(app);
  const normalizedFingerprint = normalizeFingerprint(fingerprint);
  if (!normalizedFingerprint) {
    throw new Error("Fingerprint is required");
  }
  const key = knownHostKey(host, normalizePort(port), algorithm);
  const trustedAt = Date.now();
  const mac = computeKnownHostMac(
    macKey,
    host,
    normalizePort(port),
    algorithm,
    normalizedFingerprint,
    trustedAt,
  );
  store.knownHosts[key] = { fingerprint: normalizedFingerprint, trustedAt, mac };
  return writeStore(app, store);
}

function readKnownHost(app, safeStorage, host, port, algorithm) {
  const store = readStore(app);
  const entry = store.knownHosts[knownHostKey(host, port, algorithm)];
  if (!entry) return null;

  // Entries written before MAC support have no `mac` field.  Treat them as
  // untrusted so the user is prompted to re-confirm the host key once, after
  // which the fresh entry will carry a valid MAC.
  if (!entry.mac || typeof entry.mac !== "string") {
    console.warn(
      `[security] Known-host entry for ${host}:${port} missing MAC — treating as untrusted (migration)`,
    );
    return null;
  }

  try {
    const macKey = getOrCreateKnownHostMacKey(app, safeStorage);
    const expectedMac = computeKnownHostMac(
      macKey,
      host,
      normalizePort(port),
      algorithm,
      normalizeFingerprint(entry.fingerprint),
      entry.trustedAt,
    );
    const entryBuf    = Buffer.from(entry.mac,   "hex");
    const expectedBuf = Buffer.from(expectedMac, "hex");
    // Guard against length mismatch before calling timingSafeEqual.
    if (entryBuf.length !== expectedBuf.length) {
      console.warn(
        `[security] Known-host MAC length mismatch for ${host}:${port} — treating as tampered`,
      );
      return null;
    }
    if (!crypto.timingSafeEqual(entryBuf, expectedBuf)) {
      console.warn(
        `[security] Known-host MAC verification FAILED for ${host}:${port} — possible store tampering`,
      );
      return null;
    }
  } catch (err) {
    console.error("[security] Known-host MAC verification error", err);
    return null;
  }

  return entry;
}

const SCRYPT_APP_LOCK_OPTS = { N: 16384, r: 8, p: 1 };

function scryptAsync(password, salt, keylen, options) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keylen, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

async function saveAppLockHash(app, safeStorage, password) {
  ensureSafeStorageAvailable(safeStorage);
  const saltBuf = crypto.randomBytes(16);
  const hashBuf = await scryptAsync(password, saltBuf, 32, SCRYPT_APP_LOCK_OPTS);
  const inner = JSON.stringify({
    alg: "scrypt-N16384-r8-p1",
    saltHex: saltBuf.toString("hex"),
    hashHex: hashBuf.toString("hex"),
  });
  const store = readStore(app);
  store.appLockHash = safeStorage.encryptString(inner).toString("base64");
  await writeStore(app, store);
}

async function verifyAppLockPassword(app, safeStorage, candidatePassword) {
  const store = readStore(app);
  const encryptedBase64 = store.appLockHash;
  if (!encryptedBase64 || typeof encryptedBase64 !== "string") return false;

  try {
    ensureSafeStorageAvailable(safeStorage);
    const decrypted = safeStorage.decryptString(Buffer.from(encryptedBase64, "base64"));
    const payload = JSON.parse(decrypted);
    if (payload.alg !== "scrypt-N16384-r8-p1") return false;
    const saltHex = typeof payload.saltHex === "string" ? payload.saltHex : "";
    const storedHashHex = typeof payload.hashHex === "string" ? payload.hashHex : "";
    if (!/^[0-9a-fA-F]+$/.test(saltHex) || !/^[0-9a-fA-F]+$/.test(storedHashHex))
      return false;
    const salt = Buffer.from(saltHex, "hex");
    const storedHash = Buffer.from(storedHashHex, "hex");
    const candidateBuf = await scryptAsync(candidatePassword, salt, 32, SCRYPT_APP_LOCK_OPTS);
    if (candidateBuf.length !== storedHash.length) return false;
    return crypto.timingSafeEqual(candidateBuf, storedHash);
  } catch {
    return false;
  }
}

function clearAppLockHash(app) {
  const store = readStore(app);
  if (!store.appLockHash) return Promise.resolve();
  delete store.appLockHash;
  return writeStore(app, store);
}

function factoryReset(app) {
  try {
    const f = getStorePath(app);
    if (fs.existsSync(f)) {
      fs.unlinkSync(f);
    }
  } catch {
    // ignore
  }
}

module.exports = {
  factoryReset,
  saveConnectionSecrets,
  loadConnectionSecrets,
  deleteConnectionSecrets,
  saveConnectionMetadata,
  loadConnectionMetadata,
  deleteConnectionMetadata,
  saveAiApiKey,
  loadAiApiKey,
  hasAiApiKey,
  trustKnownHost,
  readKnownHost,
  saveAppLockHash,
  verifyAppLockPassword,
  clearAppLockHash,
};
