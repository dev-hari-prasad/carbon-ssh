/**
 * Secret stripping utilities for the renderer process (D10.1 partial).
 *
 * Connection objects in the renderer should never contain raw secrets.
 * These helpers strip secrets from Connection objects and clear form state.
 */
import type { Connection } from "./types";

/**
 * Strip secrets (password, privateKey, passphrase) from a connection object.
 * Use this before persisting connections to renderer state.
 */
export function stripConnectionSecrets(
  conn: Connection,
): Connection {
  return {
    ...conn,
    password: undefined,
    privateKey: undefined,
    passphrase: undefined,
  };
}

/**
 * Strip secrets from an array of connections.
 */
export function stripConnectionsSecrets(
  connections: Connection[],
): Connection[] {
  return connections.map(stripConnectionSecrets);
}

/**
 * Clear secrets from a mutable form data object.
 * Call this after form submission or on component unmount.
 */
export function clearFormSecrets<T extends Record<string, unknown>>(formData: T): void {
  const secretKeys = ["password", "privateKey", "passphrase", "apiKey", "secret", "token"];
  for (const key of secretKeys) {
    if (key in formData) {
      (formData as Record<string, unknown>)[key] = "";
    }
  }
}
