/**
 * Budget ledger: the spending cap is enforced before every attempt, not only
 * at plan time (PHASE1_PLAN 5.4).
 *
 * - One ledger per scan, shared by all its sessions and runs, persisted at
 *   runs/scans/<scanId>/budget.json after every change (temp file + rename).
 * - reserve() before sending, settle() when the attempt ends. A missing cost
 *   (timeout, network error, no `cost` field) is charged as uncertain.
 * - Reservations left by an interrupted run are charged as uncertain on the
 *   next open, because the provider may have processed those requests.
 * - A provider cost above the reserved estimate is recorded in full, logged
 *   as a price deviation and halts the scan until the price is updated.
 * - A lock file keeps two processes from spending the same scan at once.
 *
 * The cap is protected by reserving the estimated price; it is not an
 * absolute guarantee if the provider charges more than estimated.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { roundUsd } from "@/lib/plan";

export const BUDGET_FILE = "budget.json";
export const LOCK_FILE = "budget.lock";

export type DenyReason = "budget_exhausted" | "price_above_estimate";

const entrySchema = z.object({
  attemptId: z.string(),
  runId: z.string(),
  amountUsd: z.number().nonnegative(),
  at: z.string(),
});

const deviationSchema = z.object({
  attemptId: z.string(),
  runId: z.string(),
  reservedUsd: z.number(),
  actualUsd: z.number(),
  deltaUsd: z.number(),
  at: z.string(),
});

const ledgerSchema = z.object({
  scanId: z.string(),
  maxUsd: z.number().positive(),
  costPerAttemptUsd: z.number().positive(),
  confirmed: z.array(entrySchema),
  uncertain: z.array(entrySchema.extend({ cause: z.enum(["no_cost", "interrupted_run"]) })),
  reserved: z.array(entrySchema),
  priceDeviations: z.array(deviationSchema),
  /** Set when a provider cost exceeded the estimate; cleared by a new price. */
  haltedForPrice: z.boolean(),
  updatedAt: z.string(),
});

type LedgerData = z.infer<typeof ledgerSchema>;
export type PriceDeviation = z.infer<typeof deviationSchema>;

export interface BudgetSnapshot {
  scanId: string;
  maxUsd: number;
  costPerAttemptUsd: number;
  confirmedUsd: number;
  uncertainUsd: number;
  reservedUsd: number;
  /** maxUsd − confirmed − uncertain − reserved; negative if the cap was exceeded. */
  remainingUsd: number;
  /** How far confirmed + uncertain went over the cap (0 if within). */
  overCapUsd: number;
  haltedForPrice: boolean;
  priceDeviations: PriceDeviation[];
}

export interface OpenOptions {
  scanDir: string;
  scanId: string;
  runId: string;
  maxUsd: number;
  costPerAttemptUsd: number;
  /** Clock and process check, injectable for tests. */
  now?: () => Date;
  isProcessAlive?: (pid: number) => boolean;
}

const sum = (entries: readonly { amountUsd: number }[]) => roundUsd(entries.reduce((acc, e) => acc + e.amountUsd, 0));

function defaultIsProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    // EPERM: the process exists but belongs to someone else.
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}

export class BudgetLedger {
  private closed = false;

  private constructor(
    private readonly dir: string,
    private readonly runId: string,
    private data: LedgerData,
    private readonly now: () => Date,
  ) {}

  /** Opens (or creates) the scan ledger and takes the scan lock. */
  static open(options: OpenOptions): BudgetLedger {
    const { scanDir, scanId, runId, maxUsd, costPerAttemptUsd } = options;
    if (!(maxUsd > 0)) throw new Error(`SCAN_MAX_USD must be > 0, got ${maxUsd}`);
    if (!(costPerAttemptUsd > 0)) throw new Error(`costPerAttemptUsd must be > 0, got ${costPerAttemptUsd}`);
    const now = options.now ?? (() => new Date());
    mkdirSync(scanDir, { recursive: true });
    acquireLock(scanDir, runId, options.isProcessAlive ?? defaultIsProcessAlive);

    try {
      const file = join(scanDir, BUDGET_FILE);
      let data: LedgerData;
      if (existsSync(file)) {
        data = ledgerSchema.parse(JSON.parse(readFileSync(file, "utf8")));
        if (data.scanId !== scanId) throw new Error(`${file} belongs to scan ${data.scanId}, not ${scanId}`);
        // Reservations of an earlier, interrupted run: the request may have been processed.
        const at = now().toISOString();
        for (const r of data.reserved) data.uncertain.push({ ...r, at, cause: "interrupted_run" });
        data.reserved = [];
        // A new price per attempt means the plan was re-approved (5.4 rule 5).
        if (data.haltedForPrice && costPerAttemptUsd !== data.costPerAttemptUsd) data.haltedForPrice = false;
        data.maxUsd = maxUsd;
        data.costPerAttemptUsd = costPerAttemptUsd;
      } else {
        data = {
          scanId,
          maxUsd,
          costPerAttemptUsd,
          confirmed: [],
          uncertain: [],
          reserved: [],
          priceDeviations: [],
          haltedForPrice: false,
          updatedAt: now().toISOString(),
        };
      }
      const ledger = new BudgetLedger(scanDir, runId, data, now);
      ledger.persist();
      return ledger;
    } catch (e) {
      releaseLock(scanDir);
      throw e;
    }
  }

  /** Reserves one attempt's estimated cost, or says why it must not be sent. */
  reserve(attemptId: string): { ok: true } | { ok: false; reason: DenyReason } {
    this.assertOpen();
    if (this.findReservation(attemptId)) throw new Error(`attempt ${attemptId} is already reserved`);
    if (this.data.haltedForPrice) return { ok: false, reason: "price_above_estimate" };
    if (this.snapshot().remainingUsd < this.data.costPerAttemptUsd) return { ok: false, reason: "budget_exhausted" };
    this.data.reserved.push({ attemptId, runId: this.runId, amountUsd: this.data.costPerAttemptUsd, at: this.stamp() });
    this.persist();
    return { ok: true };
  }

  /**
   * Moves a reservation to confirmed (provider cost known) or uncertain
   * (cost unknown: charged at the reserved amount).
   */
  settle(attemptId: string, actualUsd: number | null): { priceAboveEstimate: boolean } {
    this.assertOpen();
    const r = this.takeReservation(attemptId);
    const at = this.stamp();
    let priceAboveEstimate = false;
    if (actualUsd === null) {
      this.data.uncertain.push({ ...r, at, cause: "no_cost" });
    } else {
      if (!(actualUsd >= 0)) throw new Error(`actual cost must be >= 0, got ${actualUsd}`);
      this.data.confirmed.push({ ...r, amountUsd: actualUsd, at });
      if (roundUsd(actualUsd) > roundUsd(r.amountUsd)) {
        priceAboveEstimate = true;
        this.data.haltedForPrice = true;
        this.data.priceDeviations.push({
          attemptId,
          runId: this.runId,
          reservedUsd: r.amountUsd,
          actualUsd,
          deltaUsd: roundUsd(actualUsd - r.amountUsd),
          at,
        });
      }
    }
    this.persist();
    return { priceAboveEstimate };
  }

  /** Drops a reservation for an attempt that was never sent. */
  release(attemptId: string): void {
    this.assertOpen();
    this.takeReservation(attemptId);
    this.persist();
  }

  snapshot(): BudgetSnapshot {
    const confirmedUsd = sum(this.data.confirmed);
    const uncertainUsd = sum(this.data.uncertain);
    const reservedUsd = sum(this.data.reserved);
    const spent = roundUsd(confirmedUsd + uncertainUsd);
    return {
      scanId: this.data.scanId,
      maxUsd: this.data.maxUsd,
      costPerAttemptUsd: this.data.costPerAttemptUsd,
      confirmedUsd,
      uncertainUsd,
      reservedUsd,
      remainingUsd: roundUsd(this.data.maxUsd - spent - reservedUsd),
      overCapUsd: Math.max(0, roundUsd(spent - this.data.maxUsd)),
      haltedForPrice: this.data.haltedForPrice,
      priceDeviations: [...this.data.priceDeviations],
    };
  }

  /** Releases the scan lock. Open reservations stay and count as interrupted next time. */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    releaseLock(this.dir);
  }

  private findReservation(attemptId: string) {
    return this.data.reserved.find((r) => r.attemptId === attemptId);
  }

  private takeReservation(attemptId: string) {
    const i = this.data.reserved.findIndex((r) => r.attemptId === attemptId);
    if (i < 0) throw new Error(`attempt ${attemptId} has no reservation`);
    return this.data.reserved.splice(i, 1)[0];
  }

  private stamp(): string {
    return this.now().toISOString();
  }

  private assertOpen(): void {
    if (this.closed) throw new Error("budget ledger is closed");
  }

  /** Writes to a temp file first, then renames, so a crash never leaves half a file. */
  private persist(): void {
    this.data.updatedAt = this.stamp();
    const file = join(this.dir, BUDGET_FILE);
    const tmp = `${file}.${process.pid}.tmp`;
    writeFileSync(tmp, `${JSON.stringify(this.data, null, 2)}\n`, "utf8");
    renameSync(tmp, file);
  }
}

const lockSchema = z.object({ pid: z.number().int(), runId: z.string(), at: z.string() });

function acquireLock(dir: string, runId: string, isProcessAlive: (pid: number) => boolean): void {
  const file = join(dir, LOCK_FILE);
  const content = JSON.stringify({ pid: process.pid, runId, at: new Date().toISOString() });
  try {
    writeFileSync(file, content, { flag: "wx" });
    return;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
  }
  const parsed = lockSchema.safeParse(safeJson(readFileSync(file, "utf8")));
  if (parsed.success && isProcessAlive(parsed.data.pid)) {
    throw new Error(
      `scan is in use by run ${parsed.data.runId} (pid ${parsed.data.pid}); wait for it to finish before starting another session`,
    );
  }
  // Stale lock from a run that no longer exists.
  writeFileSync(file, content);
}

function releaseLock(dir: string): void {
  rmSync(join(dir, LOCK_FILE), { force: true });
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
