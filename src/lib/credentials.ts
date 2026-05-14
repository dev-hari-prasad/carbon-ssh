import type { AuthType, Connection } from "./types";

type LegacyAuthType = AuthType | "key" | undefined;

export interface ConnectionSecrets {
  authType: AuthType;
  password?: string;
  privateKey?: string;
  passphrase?: string;
}

export interface CredentialStorageAdapter {
  kind: "local-development" | "os-secure-storage";
  loadConnectionSecrets(connection: Connection): Promise<ConnectionSecrets>;
  saveConnectionSecrets(connectionId: string, secrets: ConnectionSecrets): Promise<void>;
  deleteConnectionSecrets(connectionId: string): Promise<void>;
}

export const localCredentialStorage: CredentialStorageAdapter = {
  kind: "local-development",
  async loadConnectionSecrets(connection) {
    return pickConnectionSecrets(connection);
  },
  async saveConnectionSecrets() {
    // Credentials are currently persisted with the connection payload.
    // Keep this adapter boundary so a keytar-backed implementation can replace it cleanly.
  },
  async deleteConnectionSecrets() {
    // No-op for the development local-storage adapter.
  },
};

function getElectronBridge() {
  if (typeof window === "undefined") return null;
  return window.electron;
}

export const osSecureCredentialStorage: CredentialStorageAdapter = {
  kind: "os-secure-storage",
  async loadConnectionSecrets(connection) {
    const bridge = getElectronBridge();
    if (!bridge?.loadConnectionSecret) {
      return pickConnectionSecrets(connection);
    }
    const stored = await bridge.loadConnectionSecret(connection.id);
    if (!stored) {
      return {
        authType: normalizeAuthType(connection.authType as LegacyAuthType),
      };
    }
    return {
      authType: normalizeAuthType(stored.authType as LegacyAuthType),
      password: typeof stored.password === "string" ? stored.password : undefined,
      privateKey: normalizePrivateKeyForSsh(stored.privateKey),
      passphrase: typeof stored.passphrase === "string" ? stored.passphrase : undefined,
    };
  },
  async saveConnectionSecrets(connectionId, secrets) {
    const bridge = getElectronBridge();
    if (!bridge?.saveConnectionSecret) return;
    await bridge.saveConnectionSecret(connectionId, {
      authType: normalizeAuthType(secrets.authType as LegacyAuthType),
      password: secrets.password,
      privateKey: secrets.privateKey,
      passphrase: secrets.passphrase,
    });
  },
  async deleteConnectionSecrets(connectionId) {
    const bridge = getElectronBridge();
    if (!bridge?.deleteConnectionSecret) return;
    await bridge.deleteConnectionSecret(connectionId);
  },
};

export function getCredentialStorageAdapter(): CredentialStorageAdapter {
  const bridge = getElectronBridge();
  if (bridge?.saveConnectionSecret && bridge?.loadConnectionSecret) {
    return osSecureCredentialStorage;
  }
  return localCredentialStorage;
}

export function normalizeAuthType(authType: LegacyAuthType): AuthType {
  return authType === "key" || authType === "privateKey" ? "privateKey" : "password";
}

export function normalizePrivateKeyForSsh(privateKey?: string): string {
  return (privateKey ?? "")
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

export function pickConnectionSecrets(
  connection: Pick<Connection, "authType" | "password" | "privateKey" | "passphrase">,
): ConnectionSecrets {
  const authType = normalizeAuthType(connection.authType as LegacyAuthType);

  if (authType === "password") {
    return {
      authType,
      password: connection.password,
    };
  }

  return {
    authType,
    privateKey: normalizePrivateKeyForSsh(connection.privateKey),
    passphrase: connection.passphrase,
  };
}

export function normalizeConnectionCredentials<
  T extends {
    authType?: LegacyAuthType;
    password?: string;
    privateKey?: string;
    passphrase?: string;
  },
>(connection: T): T & ConnectionSecrets {
  const secrets = pickConnectionSecrets({
    authType: connection.authType ?? "password",
    password: connection.password,
    privateKey: connection.privateKey,
    passphrase: connection.passphrase,
  } as Connection);

  return {
    ...connection,
    authType: secrets.authType,
    password: secrets.authType === "password" ? secrets.password : undefined,
    privateKey: secrets.authType === "privateKey" ? secrets.privateKey : undefined,
    passphrase: secrets.authType === "privateKey" ? secrets.passphrase : undefined,
  };
}

export function buildSshAuthPayload(
  connection: Pick<Connection, "authType" | "username" | "password" | "privateKey" | "passphrase">,
):
  | { authMethod: "password"; username: string; password?: string }
  | { authMethod: "privateKey"; username: string; privateKey?: string; passphrase?: string } {
  const secrets = pickConnectionSecrets(connection);

  if (secrets.authType === "password") {
    return {
      authMethod: "password",
      username: connection.username,
      password: secrets.password,
    };
  }

  return {
    authMethod: "privateKey",
    username: connection.username,
    privateKey: secrets.privateKey,
    passphrase: secrets.passphrase || undefined,
  };
}
