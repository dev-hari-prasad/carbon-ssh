# Passkey Protection Implementation Plan for Electron

Implementing Passkeys (WebAuthn/FIDO2) in an Electron application introduces unique challenges. The WebAuthn API strictly requires a valid **Relying Party (RP) Origin** (e.g., `https://yourdomain.com`). Because Electron apps typically run on `file://` or custom local schemes (`app://`), the built-in browser WebAuthn APIs will forcefully reject passkey creation or assertion requests.

Here is a comprehensive plan on how to achieve Passkey/Biometric protection in this Electron app, structured by use-case.

---

## 1. Goal: Local Vault Encryption (Protecting SSH Keys)
If your primary goal is to securely lock the app and encrypt local SSH configurations using the user's device biometrics (Touch ID, Windows Hello, Face ID), **you do not need full WebAuthn Passkeys**. Instead, use Native OS Biometrics to wrap a local AES encryption key.

### Implementation: Native Biometrics wrapping a Master Key
1. **Master Key Generation**: When the user first opens the app, generate a strong AES-GCM Master Key.
2. **Secure Enclave Storage**:
   - Use the system's native keychain (macOS Keychain, Windows Credential Vault, Linux Secret Service).
   - In Electron, use the `keytar` package or Electron's native `safeStorage` API.
3. **Biometric Prompt**:
   - Use Electron's native APIs to prompt for biometrics before decrypting the safe storage.
   - On macOS: `systemPreferences.promptTouchID('Unlock Terminal Muse')`.
   - On Windows: `@1password/node-windows-hello` or native WinRT bindings to trigger Windows Hello.
4. **App Flow**:
   - User launches app -> App prompts biometric check -> On success, decrypts Master Key from native vault -> Decrypts local SQLite DB/Host JSON.

---

## 2. Goal: Cloud Sync & True Passkey Authentication
If your goal is to authenticate the user to a remote backend (to sync SSH connections, workspaces, etc.) using true cross-device Passkeys, you must work around the `localhost` / `app://` limitation.

### Approach A: Hosted Auth Server + PKCE Flow (Recommended)
Because Electron cannot act as a Relying Party, you offload the WebAuthn ceremony to a real web domain.

1. **Set up an Auth Domain**: Deploy a small web server to `https://auth.terminalmuse.com`.
2. **Electron Login Flow**:
   - Electron opens a system browser window or `BrowserWindow` pointing to `https://auth.terminalmuse.com/login?redirect_uri=terminalmuse://auth`.
   - The user authenticates using their Passkey on the secure HTTPS domain (satisfying WebAuthn requirements).
3. **Deep Linking (Custom Protocol)**:
   - Once authenticated, the web server redirects to `terminalmuse://auth?token=...`.
   - Electron captures the `app.setAsDefaultProtocolClient('terminalmuse')` event.
   - Electron extracts the token, verifies it, and logs the user in.

### Approach B: Localhost Loopback Server
Technically, WebAuthn allows `http://localhost` as a valid Relying Party.
1. **Spin up Local Server**: Electron spins up an Express server on a random port (e.g., `http://localhost:59231`).
2. **WebAuthn Execution**: The Electron UI `iframe` or `BrowserWindow` navigates to that localhost address.
3. **Caveat**: This can feel hacky, is prone to local firewall blocks, and Apple's Passkey sync often behaves poorly with `localhost` across ecosystem boundaries. **Approach A is highly preferred over this.**

### Approach C: Third-Party Identity Providers
If you don't want to build the WebAuthn backend yourself, services like **Clerk**, **Auth0**, or **Corbado** provide Passkey-first authentication.
- You still use the OAuth PKCE flow (Approach A), but point the user to `your-tenant.clerk.accounts.dev`.
- They handle the complex WebAuthn attestation, verification, and cross-device syncing.

---

## Summary of Action Plan

**Phase 1: Local Lock (Quickest win, highest UX)**
* Instead of building a complex WebAuthn RP, leverage Electron's `safeStorage` combined with `systemPreferences.promptTouchID()` / Windows Hello APIs.
* **Why:** This achieves the "Passkey feel" (biometric unlock) instantly without needing a cloud backend or domain.

**Phase 2: Cloud Sync (If applicable)**
* If you plan to sync environments across machines, implement **Approach A**.
* Build a lightweight web frontend hosted on Vercel/Next.js strictly for the WebAuthn flow.
* Configure Electron to intercept deep links (`terminalmuse://`) to securely pass the session token back to the desktop app.
