/**
 * Reporting Module
 * 
 * Generates reports about reclaim activities
 * Outputs human-readable summaries and machine-readable logs
 */

import fs from "fs";
import path from "path";
import { PublicKey } from "@solana/web3.js";
import {
  ReclaimReport,
  ReclaimAction,
  AccountAnalysis,
} from "../utils/types.js";
import {
  lamportsToSol,
} from "../utils/solana.js";
import {
  logInfo,
  logError,
  logDebug,
} from "../utils/logging.js";

/**
 * Reporter for generating summaries and audit logs
 */
export class Reporter {
  private auditLogPath: string;

  constructor(auditLogPath: string) {
    this.auditLogPath = auditLogPath;
  }

  /**
   * Generate a report from analyses and actions
   */
  public generateReport(
    analyses: AccountAnalysis[],
    actions: ReclaimAction[],
    isDryRun: boolean
  ): ReclaimReport {
    const report: ReclaimReport = {
      timestamp: Date.now(),
      totalTracked: analyses.length,
      existingAccounts: analyses.filter((a) => a.currentState.exists).length,
      reclaimableAccounts: analyses.filter((a) => a.isReclaimable).length,
      totalRentLocked: analyses.reduce(
        (sum, a) => sum + a.sponsoredAccount.rentLamportsAtCreation,
        0
      ),
      totalReclaimedLamports: actions.reduce(
        (sum, a) =>
          a.status === "CONFIRMED" ? sum + a.amount : sum,
        0
      ),
      totalStillLocked: analyses.reduce(
        (sum, a) =>
          a.isReclaimable && a.currentState.exists ? sum + a.reclaimableLamports : sum,
        0
      ),
      actions,
      reasonSummary: new Map(),
      isDryRun,
    };

    // Summarize reasons for non-reclaimable accounts
    for (const analysis of analyses) {
      if (!analysis.isReclaimable) {
        const count = report.reasonSummary.get(analysis.reason) || 0;
        report.reasonSummary.set(analysis.reason, count + 1);
      }
    }

    return report;
  }

  /**
   * Generate a human-readable text report
   */
  public formatReport(report: ReclaimReport): string {
    let output = "\n";
    output += "═".repeat(70) + "\n";
    output += "KORA RENT RECLAIM BOT - REPORT\n";
    output += "═".repeat(70) + "\n\n";

    // Timestamp
    const date = new Date(report.timestamp);
    output += `Report Generated: ${date.toISOString()}\n`;
    output += `Mode: ${report.isDryRun ? "DRY-RUN" : "LIVE"}\n\n`;

    // Summary statistics
    output += "─".repeat(70) + "\n";
    output += "SUMMARY\n";
    output += "─".repeat(70) + "\n";
    output += `Total Accounts Tracked:     ${report.totalTracked}\n`;
    output += `Existing On-Chain:          ${report.existingAccounts}\n`;
    output += `Reclaimable:                ${report.reclaimableAccounts}\n`;
    output += `\n`;

    output += `Total Rent Locked (at creation):  ${lamportsToSol(report.totalRentLocked).toFixed(4)} SOL\n`;
    output += `Total Reclaimed:                 ${lamportsToSol(report.totalReclaimedLamports).toFixed(4)} SOL\n`;
    output += `Still Locked:                    ${lamportsToSol(report.totalStillLocked).toFixed(4)} SOL\n`;
    output += `\n`;

    // Actions summary
    const confirmedActions = report.actions.filter((a) => a.status === "CONFIRMED");
    const failedActions = report.actions.filter((a) => a.status === "FAILED");
    const dryRunActions = report.actions.filter((a) => a.status === "DRY_RUN");

    output += `Actions Confirmed:              ${confirmedActions.length}\n`;
    output += `Actions Failed:                 ${failedActions.length}\n`;
    output += `Actions (Dry-Run):              ${dryRunActions.length}\n`;
    output += `\n`;

    // Reasons for rejection
    if (report.reasonSummary.size > 0) {
      output += "─".repeat(70) + "\n";
      output += "REASONS FOR REJECTION\n";
      output += "─".repeat(70) + "\n";

      for (const [reason, count] of report.reasonSummary.entries()) {
        output += `${count.toString().padEnd(3)} accounts: ${reason}\n`;
      }
      output += "\n";
    }

    // Confirmed actions detail
    if (confirmedActions.length > 0) {
      output += "─".repeat(70) + "\n";
      output += "CONFIRMED RECLAIMS\n";
      output += "─".repeat(70) + "\n";

      for (const action of confirmedActions) {
        output += `\n  Account: ${action.accountPubkey.toString()}\n`;
        output += `  Amount:  ${lamportsToSol(action.amount).toFixed(4)} SOL (${action.amount} lamports)\n`;
        output += `  Tx:      ${action.txSignature}\n`;
      }
      output += "\n";
    }

    // Failed actions detail
    if (failedActions.length > 0) {
      output += "─".repeat(70) + "\n";
      output += "FAILED RECLAIMS\n";
      output += "─".repeat(70) + "\n";

      for (const action of failedActions) {
        output += `\n  Account: ${action.accountPubkey.toString()}\n`;
        output += `  Amount:  ${lamportsToSol(action.amount).toFixed(4)} SOL\n`;
        output += `  Error:   ${action.errorMessage}\n`;
      }
      output += "\n";
    }

    output += "═".repeat(70) + "\n";

    return output;
  }

  /**
   * Save report to JSON file
   */
  public saveReport(report: ReclaimReport, outputPath: string): void {
    try {
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Serialize report (handle Map)
      const serializable = {
        ...report,
        reasonSummary: Object.fromEntries(report.reasonSummary),
        actions: report.actions.map((a) => ({
          ...a,
          accountPubkey: a.accountPubkey.toString(),
          treasuryAddress: a.treasuryAddress.toString(),
        })),
      };

      fs.writeFileSync(outputPath, JSON.stringify(serializable, null, 2));
      logInfo(`✓ Report saved to ${outputPath}`);
    } catch (error) {
      logError(
        "saveReport",
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Append an audit entry
   */
  public appendAuditEntry(
    action: string,
    accountPubkey: PublicKey | null,
    details: Record<string, any>
  ): void {
    try {
      const entry = {
        timestamp: new Date().toISOString(),
        unix_timestamp: Date.now(),
        action,
        account: accountPubkey?.toString() || null,
        details,
      };

      // Load existing audit log or create new
      let auditLog: any[] = [];
      if (fs.existsSync(this.auditLogPath)) {
        try {
          auditLog = JSON.parse(fs.readFileSync(this.auditLogPath, "utf-8"));
        } catch {
          auditLog = [];
        }
      }

      // Append new entry
      auditLog.push(entry);

      // Write back to file
      const dir = path.dirname(this.auditLogPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(this.auditLogPath, JSON.stringify(auditLog, null, 2));

      logDebug(`Audit entry appended: ${action}`);
    } catch (error) {
      logError(
        "appendAuditEntry",
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Get audit log summary
   */
  public getAuditLogSummary(): {
    totalEntries: number;
    actionCounts: Record<string, number>;
  } {
    try {
      if (!fs.existsSync(this.auditLogPath)) {
        return { totalEntries: 0, actionCounts: {} };
      }

      const auditLog = JSON.parse(fs.readFileSync(this.auditLogPath, "utf-8"));
      const actionCounts: Record<string, number> = {};

      for (const entry of auditLog) {
        const action = entry.action || "UNKNOWN";
        actionCounts[action] = (actionCounts[action] || 0) + 1;
      }

      return {
        totalEntries: auditLog.length,
        actionCounts,
      };
    } catch (error) {
      logError(
        "getAuditLogSummary",
        error instanceof Error ? error.message : String(error)
      );
      return { totalEntries: 0, actionCounts: {} };
    }
  }
}
