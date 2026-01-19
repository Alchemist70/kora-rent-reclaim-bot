/**
 * Operator Dashboard Server
 * 
 * Local read-only dashboard for monitoring rent reclaim operations
 * No wallet connections, no transaction signing
 * Displays data from audit-log.json and indexed accounts
 */

import express, { Express, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { logInfo, logError } from "../utils/logging.js";

/**
 * Dashboard data structures
 */
interface DashboardMetrics {
  timestamp: number;
  totalTracked: number;
  totalRentLocked: number;
  totalReclaimedLamports: number;
  totalStillLocked: number;
  reclaimableCount: number;
  skippedCount: number;
  confirmedCount: number;
  failedCount: number;
}

interface AccountRecord {
  publicKey: string;
  status: "active" | "reclaimable" | "reclaimed" | "skipped" | "failed";
  accountType: string;
  owner: string;
  rentLamports: number;
  reason: string;
  lastActivity: number;
  reclaimedAmount?: number;
  txSignature?: string;
}

interface ReclaimEvent {
  timestamp: number;
  account: string;
  amount: number;
  status: string;
}

/**
 * Dashboard server configuration
 */
interface DashboardConfig {
  port: number;
  host: string;
  auditLogPath: string;
  indexPath: string;
}

/**
 * Dashboard Server
 */
export class DashboardServer {
  private app: Express;
  private config: DashboardConfig;
  private server: any;

  constructor(config: DashboardConfig) {
    this.app = express();
    this.config = config;
    this.setupRoutes();
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.config.port, this.config.host, () => {
          logInfo(`Dashboard server started on http://${this.config.host}:${this.config.port}`);
          resolve();
        });
      } catch (error) {
        logError("dashboard", `Failed to start server: ${error}`);
        reject(error);
      }
    });
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          logInfo("Dashboard server stopped");
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Setup Express routes
   */
  private setupRoutes(): void {
    // Serve static files (HTML, CSS, JS)
    this.app.use(express.static(this.getPublicDir()));

    // API endpoints
    this.app.get("/api/metrics", this.handleMetrics.bind(this));
    this.app.get("/api/accounts", this.handleAccounts.bind(this));
    this.app.get("/api/timeline", this.handleTimeline.bind(this));
    this.app.get("/api/warnings", this.handleWarnings.bind(this));
    this.app.get("/api/audit-summary", this.handleAuditSummary.bind(this));

    // Health check
    this.app.get("/health", (req, res) => {
      res.json({ status: "ok", timestamp: Date.now() });
    });

    // Catch all - serve index.html for SPA
    this.app.get("*", (req, res) => {
      const indexFile = path.join(this.getPublicDir(), "index.html");
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).json({ error: "Not found" });
      }
    });
  }

  /**
   * Get public directory for serving static files
   */
  private getPublicDir(): string {
    // Public directory is in the root of the project
    return path.join(path.dirname(this.config.auditLogPath), "..", "public");
  }

  /**
   * Handler: GET /api/metrics
   */
  private handleMetrics(req: Request, res: Response): void {
    try {
      const metrics = this.calculateMetrics();
      res.json(metrics);
    } catch (error) {
      logError("dashboard", `Metrics error: ${error}`);
      res.status(500).json({ error: "Failed to calculate metrics" });
    }
  }

  /**
   * Handler: GET /api/accounts
   */
  private handleAccounts(req: Request, res: Response): void {
    try {
      const accounts = this.loadAccounts();
      res.json(accounts);
    } catch (error) {
      logError("dashboard", `Accounts error: ${error}`);
      res.status(500).json({ error: "Failed to load accounts" });
    }
  }

  /**
   * Handler: GET /api/timeline
   */
  private handleTimeline(req: Request, res: Response): void {
    try {
      const timeline = this.generateTimeline();
      res.json(timeline);
    } catch (error) {
      logError("dashboard", `Timeline error: ${error}`);
      res.status(500).json({ error: "Failed to generate timeline" });
    }
  }

  /**
   * Handler: GET /api/warnings
   */
  private handleWarnings(req: Request, res: Response): void {
    try {
      const warnings = this.generateWarnings();
      res.json(warnings);
    } catch (error) {
      logError("dashboard", `Warnings error: ${error}`);
      res.status(500).json({ error: "Failed to generate warnings" });
    }
  }

  /**
   * Handler: GET /api/audit-summary
   */
  private handleAuditSummary(req: Request, res: Response): void {
    try {
      const summary = this.getAuditSummary();
      res.json(summary);
    } catch (error) {
      logError("dashboard", `Audit summary error: ${error}`);
      res.status(500).json({ error: "Failed to get audit summary" });
    }
  }

  /**
   * Calculate dashboard metrics
   */
  private calculateMetrics(): DashboardMetrics {
    const indexedAccounts = this.loadIndexedAccounts();
    const auditLog = this.loadAuditLog();

    let totalRentLocked = 0;
    let totalReclaimedLamports = 0;
    let totalStillLocked = 0;
    let reclaimableCount = 0;
    let confirmedCount = 0;

    // Calculate from audit log
    for (const entry of auditLog) {
      if (entry.action === "INDEXED") {
        totalRentLocked += entry.details?.rentLamports || 0;
      }
      if (entry.action === "RECLAIM_CONFIRMED") {
        totalReclaimedLamports += entry.details?.lamports || 0;
        confirmedCount++;
      }
    }

    // Count accounts
    const reclaimableAccounts = indexedAccounts.filter(
      (acc: any) => !auditLog.some((e: any) => e.account === acc.publicKey && e.action === "RECLAIM_CONFIRMED")
    );
    reclaimableCount = reclaimableAccounts.length;
    totalStillLocked = reclaimableAccounts.reduce((sum: number, acc: any) => sum + (acc.rentLamportsAtCreation || 0), 0);

    const failedCount = auditLog.filter((e: any) => e.action === "RECLAIM_FAILED").length;
    const skippedCount = indexedAccounts.length - confirmedCount - failedCount - reclaimableCount;

    return {
      timestamp: Date.now(),
      totalTracked: indexedAccounts.length,
      totalRentLocked,
      totalReclaimedLamports,
      totalStillLocked,
      reclaimableCount,
      skippedCount,
      confirmedCount,
      failedCount,
    };
  }

  /**
   * Load account records
   */
  private loadAccounts(): AccountRecord[] {
    const indexedAccounts = this.loadIndexedAccounts();
    const auditLog = this.loadAuditLog();
    const records: AccountRecord[] = [];

    for (const account of indexedAccounts) {
      // Find audit entries for this account
      const entries = auditLog.filter((e: any) => e.account === account.publicKey);
      const lastEntry = entries[entries.length - 1];

      let status: "active" | "reclaimable" | "reclaimed" | "skipped" | "failed" = "active";
      let reason = "Pending analysis";
      let reclaimedAmount = 0;
      let txSignature: string | undefined;

      if (lastEntry) {
        if (lastEntry.action === "RECLAIM_CONFIRMED") {
          status = "reclaimed";
          reason = "Rent successfully reclaimed";
          reclaimedAmount = lastEntry.details?.lamports || 0;
          txSignature = lastEntry.details?.txSignature;
        } else if (lastEntry.action === "RECLAIM_FAILED") {
          status = "failed";
          reason = `Reclaim failed: ${lastEntry.details?.error || "Unknown error"}`;
        } else if (lastEntry.action === "ANALYZED") {
          status = lastEntry.details?.reclaimable ? "reclaimable" : "skipped";
          reason = lastEntry.details?.inactivitySlots < 100000 ? "Too recent" : "Eligible for reclaim";
        }
      }

      records.push({
        publicKey: account.publicKey,
        status,
        accountType: account.ownerProgram === "11111111111111111111111111111111" ? "System" : "Token",
        owner: account.ownerProgram,
        rentLamports: account.rentLamportsAtCreation,
        reason,
        lastActivity: lastEntry?.unix_timestamp || account.createdAt,
        reclaimedAmount,
        txSignature,
      });
    }

    return records;
  }

  /**
   * Generate reclaim timeline
   */
  private generateTimeline(): ReclaimEvent[] {
    const auditLog = this.loadAuditLog();
    const events: ReclaimEvent[] = [];

    for (const entry of auditLog) {
      if (entry.action === "RECLAIM_CONFIRMED" || entry.action === "RECLAIM_FAILED") {
        events.push({
          timestamp: entry.unix_timestamp || Date.now(),
          account: entry.account?.substring(0, 8) + "..." || "unknown",
          amount: entry.details?.lamports || 0,
          status: entry.action === "RECLAIM_CONFIRMED" ? "success" : "failed",
        });
      }
    }

    return events.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Generate warnings
   */
  private generateWarnings(): Array<{ level: string; message: string; timestamp: number }> {
    const warnings: Array<{ level: string; message: string; timestamp: number }> = [];
    const metrics = this.calculateMetrics();
    const accounts = this.loadAccounts();

    // Warning 1: Idle rent above threshold
    const idleThreshold = 1_000_000_000; // 1 SOL in lamports
    if (metrics.totalStillLocked > idleThreshold) {
      warnings.push({
        level: "warning",
        message: `${(metrics.totalStillLocked / 1_000_000_000).toFixed(2)} SOL still idle in ${metrics.reclaimableCount} accounts`,
        timestamp: Date.now(),
      });
    }

    // Warning 2: Accounts with recent activity
    const recentAccounts = accounts.filter((a) => {
      const daysSinceActivity = (Date.now() - a.lastActivity) / (1000 * 60 * 60 * 24);
      return daysSinceActivity < 1;
    });

    if (recentAccounts.length > 0) {
      warnings.push({
        level: "info",
        message: `${recentAccounts.length} accounts have activity in last 24 hours`,
        timestamp: Date.now(),
      });
    }

    // Warning 3: Failed reclaims
    if (metrics.failedCount > 0) {
      warnings.push({
        level: "error",
        message: `${metrics.failedCount} reclaim attempts have failed`,
        timestamp: Date.now(),
      });
    }

    return warnings;
  }

  /**
   * Get audit log summary
   */
  private getAuditSummary(): Record<string, number> {
    const auditLog = this.loadAuditLog();
    const summary: Record<string, number> = {};

    for (const entry of auditLog) {
      const action = entry.action || "UNKNOWN";
      summary[action] = (summary[action] || 0) + 1;
    }

    return summary;
  }

  /**
   * Load indexed accounts
   */
  private loadIndexedAccounts(): any[] {
    try {
      if (!fs.existsSync(this.config.indexPath)) {
        return [];
      }
      const data = JSON.parse(fs.readFileSync(this.config.indexPath, "utf-8"));
      return data.sponsoredAccounts || [];
    } catch {
      return [];
    }
  }

  /**
   * Load audit log
   */
  private loadAuditLog(): any[] {
    try {
      if (!fs.existsSync(this.config.auditLogPath)) {
        return [];
      }
      return JSON.parse(fs.readFileSync(this.config.auditLogPath, "utf-8"));
    } catch {
      return [];
    }
  }

  /**
   * Get the Express app (for testing)
   */
  public getApp(): Express {
    return this.app;
  }
}
