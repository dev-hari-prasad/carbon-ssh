import { savePasskeyAccess } from "./storage";

const PASSKEY_ID_KEY = "ssh.vault-passkey-id";
const PASSKEY_PROVIDER_KEY = "ssh.vault-passkey-provider";

export type PasskeyProvider = "electron" | "webauthn";

export function getSavedPasskeyProvider(): PasskeyProvider | null {
  if (typeof window === "undefined") return null;
  const provider = window.localStorage.getItem(PASSKEY_PROVIDER_KEY);
  return provider === "electron" || provider === "webauthn" ? provider : null;
}

export function getSavedPasskeyId() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(PASSKEY_ID_KEY);
}

export function canUseElectronTouchId() {
  return (
    typeof window !== "undefined" &&
    Boolean(window.electron?.biometricUnlock) &&
    window.electron?.platform === "darwin"
  );
}

export function canUseWebAuthnPasskeys() {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    Boolean(navigator.credentials) &&
    typeof PublicKeyCredential !== "undefined"
  );
}

export async function promptElectronTouchId(reason: string) {
  if (!canUseElectronTouchId()) {
    throw new Error("Touch ID unlock is only available on macOS with Touch ID.");
  }

  const ok = await window.electron?.biometricUnlock(reason);
  if (!ok) {
    throw new Error("Biometric verification failed or was canceled.");
  }
}

export async function setUpBestAvailablePasskey() {
  if (canUseElectronTouchId()) {
    await promptElectronTouchId("Set up Carbon biometric unlock");
    savePasskeyAccess("electron");
    return "electron" satisfies PasskeyProvider;
  }

  await createWebAuthnPasskey();
  return "webauthn" satisfies PasskeyProvider;
}

export async function createWebAuthnPasskey() {
  if (!canUseWebAuthnPasskeys()) {
    throw new Error("Passkeys are not available in this app window.");
  }

  const rp: PublicKeyCredentialRpEntity = { name: "Carbon SSH" };
  if (window.location.hostname) {
    rp.id = window.location.hostname;
  }

  const publicKey: PublicKeyCredentialCreationOptions = {
    challenge: window.crypto.getRandomValues(new Uint8Array(32)),
    rp,
    user: {
      id: window.crypto.getRandomValues(new Uint8Array(16)),
      name: "local-user",
      displayName: "Local Vault User",
    },
    pubKeyCredParams: [
      { type: "public-key", alg: -7 },
      { type: "public-key", alg: -257 },
    ],
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      userVerification: "required",
    },
    timeout: 60000,
  };

  const credential = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential;
  if (!credential?.rawId) {
    throw new Error("Passkey setup did not return a credential.");
  }

  const credentialId = bufferToBase64url(credential.rawId);
  savePasskeyAccess("webauthn", credentialId);
  return credentialId;
}

export async function verifyWebAuthnPasskey(credentialId = getSavedPasskeyId()) {
  if (!canUseWebAuthnPasskeys()) {
    throw new Error("Passkeys are not available in this app window.");
  }

  if (!credentialId) {
    throw new Error(
      "No passkey is saved for this device. Set up passkeys again or reset app lock.",
    );
  }

  const publicKey: PublicKeyCredentialRequestOptions = {
    challenge: window.crypto.getRandomValues(new Uint8Array(32)),
    allowCredentials: [
      {
        id: base64urlToBuffer(credentialId),
        type: "public-key",
      },
    ],
    userVerification: "required",
    timeout: 60000,
  };

  const assertion = (await navigator.credentials.get({ publicKey })) as PublicKeyCredential;
  if (!assertion) {
    throw new Error("Passkey verification did not return an assertion.");
  }
}

function bufferToBase64url(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let str = "";
  for (const charCode of bytes) {
    str += String.fromCharCode(charCode);
  }
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function base64urlToBuffer(base64url: string) {
  const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawArgs = atob(base64);
  const buffer = new Uint8Array(rawArgs.length);
  for (let i = 0; i < rawArgs.length; i++) {
    buffer[i] = rawArgs.charCodeAt(i);
  }
  return buffer.buffer;
}
