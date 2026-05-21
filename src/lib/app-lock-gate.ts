/** Ephemeral unlock authorization — consumed once by `unlockApp()`. */
let unlockGrantPending = false;

export function grantAppUnlock(): void {
  unlockGrantPending = true;
}

export function consumeUnlockGrant(): boolean {
  if (!unlockGrantPending) return false;
  unlockGrantPending = false;
  return true;
}

export function clearUnlockGrant(): void {
  unlockGrantPending = false;
}
