/**
 * Race / TOCTOU — app-lock grant consumption under concurrency
 *
 * RUN: pnpm exec vitest run agents/cache/tools/applock-concurrency.test.ts
 */

import { describe, expect, it } from "vitest";
import {
  clearUnlockGrant,
  consumeUnlockGrant,
  grantAppUnlock,
} from "../../../src/lib/app-lock-gate";

describe("app-lock-gate concurrency", () => {
  it("only one consumer wins under parallel consume", () => {
    clearUnlockGrant();
    grantAppUnlock();
    const results = Array.from({ length: 20 }, () => consumeUnlockGrant());
    expect(results.filter(Boolean).length).toBe(1);
  });

  it("double grant still single consume", () => {
    clearUnlockGrant();
    grantAppUnlock();
    grantAppUnlock();
    expect(consumeUnlockGrant()).toBe(true);
    expect(consumeUnlockGrant()).toBe(false);
  });

  it("grant after consume requires new grant", async () => {
    clearUnlockGrant();
    grantAppUnlock();
    expect(consumeUnlockGrant()).toBe(true);
    // Simulate race: second unlockApp without re-auth
    expect(consumeUnlockGrant()).toBe(false);
    grantAppUnlock();
    expect(consumeUnlockGrant()).toBe(true);
  });
});
