import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BUDGET_FILE, BudgetLedger, LOCK_FILE, renameWithRetry, type OpenOptions } from "@/lib/budget";

const COST = 0.004;
let scanDir: string;
const open: (over?: Partial<OpenOptions>) => BudgetLedger = (over = {}) =>
  BudgetLedger.open({ scanDir, scanId: "scan-1", runId: "run-a", maxUsd: 0.02, costPerAttemptUsd: COST, ...over });

beforeEach(() => {
  scanDir = join(mkdtempSync(join(tmpdir(), "ortsrank-budget-")), "scans", "scan-1");
});
afterEach(() => rmSync(join(scanDir, "..", ".."), { recursive: true, force: true }));

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("reserve and settle", () => {
  it("moves a reservation to confirmed with the provider cost", () => {
    const b = open();
    expect(b.reserve("t1-a1")).toEqual({ ok: true });
    expect(b.snapshot()).toMatchObject({ reservedUsd: 0.004, remainingUsd: 0.016 });
    b.settle("t1-a1", 0.004);
    expect(b.snapshot()).toMatchObject({ confirmedUsd: 0.004, reservedUsd: 0, uncertainUsd: 0, remainingUsd: 0.016 });
    b.close();
  });

  it("charges a timeout (no cost) as uncertain at the reserved amount", () => {
    const b = open();
    b.reserve("t1-a1");
    b.settle("t1-a1", null);
    expect(b.snapshot()).toMatchObject({ confirmedUsd: 0, uncertainUsd: 0.004, remainingUsd: 0.016 });
    b.close();
  });

  it("records a lower provider cost as it is, without a deviation", () => {
    const b = open();
    b.reserve("t1-a1");
    expect(b.settle("t1-a1", 0.002)).toEqual({ priceAboveEstimate: false });
    expect(b.snapshot()).toMatchObject({ confirmedUsd: 0.002, priceDeviations: [] });
    b.close();
  });

  it("releases a reservation for an attempt that was never sent", () => {
    const b = open();
    b.reserve("t1-a1");
    b.release("t1-a1");
    expect(b.snapshot().remainingUsd).toBe(0.02);
    b.close();
  });

  it("rejects double reservations and unknown attempts", () => {
    const b = open();
    b.reserve("t1-a1");
    expect(() => b.reserve("t1-a1")).toThrow(/already reserved/);
    expect(() => b.settle("nope", 0.004)).toThrow(/no reservation/);
    expect(() => b.release("nope")).toThrow(/no reservation/);
    b.close();
    expect(() => b.reserve("t2-a1")).toThrow(/closed/);
  });

  it("rejects invalid caps and prices", () => {
    expect(() => open({ maxUsd: 0 })).toThrow(/SCAN_MAX_USD/);
    expect(() => open({ costPerAttemptUsd: 0 })).toThrow(/costPerAttemptUsd/);
    expect(existsSync(join(scanDir, LOCK_FILE))).toBe(false);
  });
});

describe("cap", () => {
  it("does not exceed the cap with concurrent requests", async () => {
    const b = open({ maxUsd: 0.02 }); // room for exactly 5 attempts
    let inFlight = 0;
    let maxInFlight = 0;
    const results = await Promise.all(
      Array.from({ length: 12 }, async (_, i) => {
        const id = `t${i}-a1`;
        const r = b.reserve(id);
        if (!r.ok) return r.reason;
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        expect(b.snapshot().remainingUsd).toBeGreaterThanOrEqual(0);
        await tick();
        inFlight -= 1;
        b.settle(id, COST);
        return "sent";
      }),
    );
    expect(results.filter((r) => r === "sent")).toHaveLength(5);
    expect(results.filter((r) => r === "budget_exhausted")).toHaveLength(7);
    expect(maxInFlight).toBe(5);
    expect(b.snapshot()).toMatchObject({ confirmedUsd: 0.02, remainingUsd: 0, overCapUsd: 0 });
    b.close();
  });

  it("denies new attempts once uncertain and confirmed spending use up the budget", () => {
    const b = open({ maxUsd: 0.01 });
    b.reserve("a");
    b.settle("a", null);
    b.reserve("b");
    b.settle("b", 0.004);
    expect(b.snapshot().remainingUsd).toBe(0.002);
    expect(b.reserve("c")).toEqual({ ok: false, reason: "budget_exhausted" });
    b.close();
  });
});

describe("shared across sessions and restarts", () => {
  it("session 2 of the same scan can only use what session 1 left", () => {
    const s1 = open({ runId: "run-session-1" });
    for (const id of ["a", "b", "c"]) {
      s1.reserve(id);
      s1.settle(id, COST);
    }
    s1.close();

    const s2 = open({ runId: "run-session-2" });
    expect(s2.snapshot()).toMatchObject({ confirmedUsd: 0.012, remainingUsd: 0.008 });
    expect(s2.reserve("d").ok).toBe(true);
    expect(s2.reserve("e").ok).toBe(true);
    expect(s2.reserve("f")).toEqual({ ok: false, reason: "budget_exhausted" });
    s2.close();
  });

  it("a different scan has its own ledger", () => {
    const s1 = open();
    s1.reserve("a");
    s1.settle("a", COST);
    s1.close();
    const otherDir = join(scanDir, "..", "scan-2");
    const other = BudgetLedger.open({ scanDir: otherDir, scanId: "scan-2", runId: "r", maxUsd: 0.02, costPerAttemptUsd: COST });
    expect(other.snapshot().confirmedUsd).toBe(0);
    other.close();
  });

  it("refuses a ledger file that belongs to another scan", () => {
    open().close();
    expect(() => open({ scanId: "scan-x" })).toThrow(/belongs to scan scan-1/);
    expect(existsSync(join(scanDir, LOCK_FILE))).toBe(false);
  });

  it("after an interrupted run, reads earlier spending and charges open reservations as uncertain", () => {
    const crashed = open({ runId: "run-crashed" });
    crashed.reserve("a");
    crashed.settle("a", COST);
    crashed.reserve("b"); // sent, then the process died: no settle, no close
    crashed.reserve("c");

    // The lock is still there; its process is gone.
    const restarted = open({ runId: "run-restart", isProcessAlive: () => false });
    expect(restarted.snapshot()).toMatchObject({
      confirmedUsd: 0.004,
      uncertainUsd: 0.008,
      reservedUsd: 0,
      remainingUsd: 0.008,
    });
    const file = JSON.parse(readFileSync(join(scanDir, BUDGET_FILE), "utf8"));
    expect(file.uncertain.map((u: { attemptId: string; cause: string }) => [u.attemptId, u.cause])).toEqual([
      ["b", "interrupted_run"],
      ["c", "interrupted_run"],
    ]);
    restarted.close();
  });

  it("refuses to open while another live process holds the scan", () => {
    const first = open({ runId: "run-1" });
    expect(() => open({ runId: "run-2", isProcessAlive: () => true })).toThrow(/in use by run run-1/);
    first.close();
    expect(() => open({ runId: "run-2" }).close()).not.toThrow();
  });

  it("takes over an unreadable lock file", () => {
    open().close();
    writeFileSync(join(scanDir, LOCK_FILE), "garbage");
    expect(() => open().close()).not.toThrow();
  });
});

describe("provider cost above the estimate", () => {
  it("records the full cost, logs the deviation, stops new attempts and reports the overrun", async () => {
    const b = open({ maxUsd: 0.006, runId: "run-1" });
    // Two attempts in flight; the provider charges twice the estimate for each.
    expect(b.reserve("a").ok).toBe(true);
    expect(b.reserve("b")).toEqual({ ok: false, reason: "budget_exhausted" }); // 0.002 left < 0.004
    await tick();
    expect(b.settle("a", 0.008)).toEqual({ priceAboveEstimate: true });

    const s = b.snapshot();
    expect(s.confirmedUsd).toBe(0.008);
    expect(s.overCapUsd).toBe(0.002);
    expect(s.remainingUsd).toBe(-0.002);
    expect(s.haltedForPrice).toBe(true);
    expect(s.priceDeviations).toEqual([
      expect.objectContaining({ attemptId: "a", runId: "run-1", reservedUsd: 0.004, actualUsd: 0.008, deltaUsd: 0.004 }),
    ]);
    expect(b.reserve("c")).toEqual({ ok: false, reason: "price_above_estimate" });
    b.close();
  });

  it("stops other attempts even when budget is left, and settles those already in flight in full", () => {
    const b = open({ maxUsd: 1 });
    b.reserve("a");
    b.reserve("b");
    b.settle("a", 0.008);
    expect(b.reserve("c")).toEqual({ ok: false, reason: "price_above_estimate" });
    b.settle("b", 0.008); // already sent, must still be recorded
    expect(b.snapshot()).toMatchObject({ confirmedUsd: 0.016, overCapUsd: 0 });
    expect(b.snapshot().priceDeviations).toHaveLength(2);
    b.close();
  });

  it("stays halted after restart with the same price; a new price clears the halt", () => {
    const b = open({ maxUsd: 1 });
    b.reserve("a");
    b.settle("a", 0.008);
    b.close();

    const samePrice = open({ maxUsd: 1 });
    expect(samePrice.reserve("b")).toEqual({ ok: false, reason: "price_above_estimate" });
    samePrice.close();

    const newPrice = open({ maxUsd: 1, costPerAttemptUsd: 0.008 });
    expect(newPrice.snapshot().haltedForPrice).toBe(false);
    expect(newPrice.reserve("b").ok).toBe(true);
    expect(newPrice.snapshot().priceDeviations).toHaveLength(1); // history is kept
    newPrice.close();
  });
});

describe("persistence", () => {
  it("writes a valid ledger after every change and leaves no temp files", () => {
    const b = open();
    const read = () => JSON.parse(readFileSync(join(scanDir, BUDGET_FILE), "utf8"));
    b.reserve("a");
    expect(read().reserved).toHaveLength(1);
    b.settle("a", COST);
    expect(read().confirmed).toHaveLength(1);
    expect(read().reserved).toHaveLength(0);
    b.close();
    expect(readdirSync(scanDir).sort()).toEqual([BUDGET_FILE]);
  });
});

describe("renameWithRetry (Windows file locks)", () => {
  const err = (code: string) => Object.assign(new Error(code), { code });

  it("retries transient lock errors and then succeeds", () => {
    let calls = 0;
    const waits: number[] = [];
    renameWithRetry("a", "b", () => {
      calls++;
      if (calls < 3) throw err(calls === 1 ? "EPERM" : "EBUSY");
    }, (ms) => waits.push(ms));
    expect(calls).toBe(3);
    expect(waits).toEqual([10, 20]);
  });

  it("gives up after the last attempt and rethrows", () => {
    let calls = 0;
    expect(() => renameWithRetry("a", "b", () => { calls++; throw err("EPERM"); }, () => {}, 4)).toThrow("EPERM");
    expect(calls).toBe(4);
  });

  it("does not retry other errors", () => {
    let calls = 0;
    expect(() => renameWithRetry("a", "b", () => { calls++; throw err("ENOENT"); }, () => {})).toThrow("ENOENT");
    expect(calls).toBe(1);
  });
});
