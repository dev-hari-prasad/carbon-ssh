const fs = require("fs");
const path = require("path");

const STORE_FILE = "secure-store.v1.json";

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

function ensureSafeStorageAvailable(safeStorage) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("Secure storage is unavailable on this system");
  }
}

function readStore(app) {
  const file = getStorePath(app);
  try {
    if (!fs.existsSync(file)) return defaultStore();
    const raw = fs.readFileSync(file, "utf8");
    const parsed = JSON.parse(raw);
    return {
      ...defaultStore(),
      ...parsed,
      connections: { ...(parsed?.connections || {}) },
      connectionMeta: { ...(parsed?.connectionMeta || {}) },
      aiKeys: { ...(parsed?.aiKeys || {}) },
      knownHosts: { ...(parsed?.knownHosts || {}) },
    };
  } catch {
    return defaultStore();
  }
}

function writeStore(app, store) {
  const file = getStorePath(app);
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
  fs.renameSync(tmp, file);
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

function knownHostKey(host, port, algorithm) {
  return `${normalizeHost(host)}:${Number(port) || 22}:${String(algorithm || "")}`;
}

function saveConnectionSecrets(app, safeStorage, connectionId, secrets) {
  const store = readStore(app);
  store.connections[connectionId] = encryptJson(safeStorage, secrets);
  writeStore(app, store);
}

function loadConnectionSecrets(app, safeStorage, connectionId) {
  const store = readStore(app);
  return decryptJson(safeStorage, store.connections[connectionId]);
}

function deleteConnectionSecrets(app, connectionId) {
  const store = readStore(app);
  if (store.connections[connectionId]) {
    delete store.connections[connectionId];
    writeStore(app, store);
  }
}

function saveConnectionMetadata(app, connectionId, metadata) {
  const store = readStore(app);
  store.connectionMeta[connectionId] = {
    id: String(metadata.id || connectionId),
    name: String(metadata.name || ""),
    host: String(metadata.host || ""),
    port: Number(metadata.port) || 22,
    username: String(metadata.username || ""),
    authType: metadata.authType === "privateKey" ? "privateKey" : "password",
    updatedAt: Date.now(),
  };
  writeStore(app, store);
}

function loadConnectionMetadata(app, connectionId) {
  const store = readStore(app);
  return store.connectionMeta[connectionId] || null;
}

function deleteConnectionMetadata(app, connectionId) {
  const store = readStore(app);
  if (store.connectionMeta[connectionId]) {
    delete store.connectionMeta[connectionId];
    writeStore(app, store);
  }
}

function saveAiApiKey(app, safeStorage, provider, apiKey, baseUrl) {
  const store = readStore(app);
  const providerKey = String(provider || "").trim();
  if (!providerKey) throw new Error("Provider is required");
  if (!apiKey) {
    delete store.aiKeys[providerKey];
    writeStore(app, store);
    return;
  }
  store.aiKeys[providerKey] = encryptJson(safeStorage, { 
    apiKey: String(apiKey),
    baseUrl: typeof baseUrl === "string" ? baseUrl : undefined
  });
  writeStore(app, store);
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

function trustKnownHost(app, host, port, algorithm, fingerprint) {
  const store = readStore(app);
  const key = knownHostKey(host, port, algorithm);
  store.knownHosts[key] = {
    fingerprint,
    trustedAt: Date.now(),
  };
  writeStore(app, store);
}

function readKnownHost(app, host, port, algorithm) {
  const store = readStore(app);
  return store.knownHosts[knownHostKey(host, port, algorithm)] || null;
}

module.exports = {
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
};
