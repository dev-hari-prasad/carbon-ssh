import { describe, expect, it } from "vitest";
import { clearUnlockGrant, consumeUnlockGrant, grantAppUnlock } from "./app-lock-gate";

describe("app-lock-gate", () => {
  it("consumes a grant once", () => {
    clearUnlockGrant();
    grantAppUnlock();
    expect(consumeUnlockGrant()).toBe(true);
    expect(consumeUnlockGrant()).toBe(false);
  });

  it("rejects unlock without a grant", () => {
    clearUnlockGrant();
    expect(consumeUnlockGrant()).toBe(false);
  });
});
