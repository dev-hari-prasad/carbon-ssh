# Strict Host Key Validation

## Goal

Enforce strict checking of server host keys on every SSH connection, explicitly blocking connections and alerting the user if the server fingerprint changes, thereby preventing active Man-in-the-Middle (MitM) attacks.

## Architectural Analysis

While Carbon's `secure-store.cjs` currently contains stub methods for `trustKnownHost` and `readKnownHost`, the actual SSH connection logic in `ws-handler.cjs` does not enforce strict fingerprint validation or prompt the user upon detection of a new or changed key. 

To achieve production-grade security:
1. We must implement Trust on First Use (TOFU) for new connections.
2. We must orchestrate an IPC flow between the `ssh2` client (backend) and the React UI (frontend) so the connection halts and waits for user confirmation before proceeding with the handshake.
3. We must enforce a hard block when a fingerprint mismatch occurs, with a deliberate, high-friction resolution path to prevent users from blindly clicking "Accept".

This introduces asynchronous complexity during the SSH handshake. The backend `ssh2` instance must pause during the `verify` event while awaiting an IPC response from the renderer.

## Dependencies

- **WebSocket / SSH Handler (`ws-handler.cjs`)**: Must intercept the host key verification step.
- **Secure Store (`secure-store.cjs`)**: Must be updated to reliably retrieve and persist trusted fingerprints per connection.
- **Renderer UI (`Modal.tsx`, Connection Flow)**: Needs a blocking modal to display the fingerprint to the user.

## Risks

- **Connection Timeouts**: Awaiting user confirmation might trigger SSH handshake timeouts if the user walks away. We must handle connection resets gracefully.
- **User Fatigue**: Users might indiscriminately accept changed keys (e.g., after rebuilding a droplet) if the bypass is too easy.
- **Key Algorithms**: A server might present a different key type (e.g., ECDSA vs ED25519) on subsequent connections depending on client ordering.

## Epics

### Epic: Host Key Verification & Interception

#### Tasks

- [ ] Task: Implement `verify` callback in `ssh2` client (`ws-handler.cjs`)
  - [ ] Sub-task: Extract the presented host key fingerprint and algorithm.
  - [ ] Sub-task: Compare the presented fingerprint against the `secureStore` via `readKnownHost`.
  - [ ] Sub-task: If a match is found, proceed instantly.
- [ ] Task: Build asynchronous IPC blocking mechanism
  - [ ] Sub-task: If the key is new or mismatched, suspend the connection and emit a `host-key-verification-required` message over the WebSocket.
  - [ ] Sub-task: Wait for a specific WebSocket response (`host-key-action`) to either accept or reject the key.
  - [ ] Sub-task: Register timeout fallback to tear down the connection if the user does not respond within 30 seconds.

#### Acceptance Criteria

- Existing trusted connections proceed without interruption.
- New connections pause and emit the verification payload.
- Mismatched connections pause and emit a mismatch payload.
- The `ssh2` connection is cleanly terminated if the key is rejected.

#### Rollback Plan

- Gate the new `verify` logic behind a feature flag (`ENABLE_STRICT_HOST_KEYS`). If bugs arise (e.g., hanging connections), toggle off to revert to standard trust-all behavior.

#### Testing Requirements

- **Unit tests**: Validate fingerprint comparison logic for identical, differing, and null stored keys.
- **Integration tests**: Spin up a local SSH daemon, connect once to store the key, regenerate the server key, and assert that the secondary connection traps the mismatch.

---

### Epic: TOFU & Mismatch UI Workflows

#### Tasks

- [ ] Task: Build TOFU (Trust on First Use) Modal
  - [ ] Sub-task: Create a UI showing the host key fingerprint (SHA256 Base64 format and MD5 Hex format options).
  - [ ] Sub-task: Add "Accept & Save" and "Cancel Connection" buttons.
- [ ] Task: Build Key Mismatch (Red Alert) Modal
  - [ ] Sub-task: Design a high-friction visual warning (Red/Critical severity).
  - [ ] Sub-task: Clearly explain the MitM risk.
  - [ ] Sub-task: Force the user to type the connection name to acknowledge and overwrite the stored key.
- [ ] Task: Integrate UI responses with the WebSocket
  - [ ] Sub-task: Send the `trustKnownHost` event to IPC upon acceptance, then signal the WebSocket to resume.

#### Acceptance Criteria

- The user sees a clear, understandable fingerprint prompt on first connection.
- The user cannot easily bypass a modified host key warning by accident.

#### Rollback Plan

- Fallback to generic connection failures if the UI fails to render the modal.

#### Testing Requirements

- **UI tests**: Ensure the High-Friction modal correctly disables the "Accept" button until the confirmation text is perfectly matched.
- **Security tests**: Verify that bypassing the UI (e.g., closing the modal) results in a connection rejection, not a silent acceptance.
