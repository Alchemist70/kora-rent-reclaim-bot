/**
 * Audit Log Utility
 * Writes append-only audit trail to JSON file
 * Used for compliance and operation tracking
 */

import fs from "fs";
import path from "path";
import { logError } from "./logging.js";

export interface AuditEntry {
  unix_timestamp: number;
  iso_timestamp: string;
  action: string;
  account?: string;
  details?: Record<string, any>;
}

/**
 * Append an entry to the audit log
 */
export function appendToAuditLog(
  auditLogPath: string,
  action: string,
  account?: string,
  details?: Record<string, any>
): void {
  try {
    // Create logs directory if needed
    const dir = path.dirname(auditLogPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Create entry
    const entry: AuditEntry = {
      unix_timestamp: Math.floor(Date.now() / 1000),
      iso_timestamp: new Date().toISOString(),
      action,
      account,
      details,
    };

    // Load existing entries or create new array
    let entries: AuditEntry[] = [];
    if (fs.existsSync(auditLogPath)) {
      try {
        const content = fs.readFileSync(auditLogPath, "utf-8");
        entries = JSON.parse(content);
        if (!Array.isArray(entries)) {
          entries = [];
        }
      } catch {
        entries = [];
      }
    }

    // Append new entry
    entries.push(entry);

    // Write back
    fs.writeFileSync(auditLogPath, JSON.stringify(entries, null, 2));
  } catch (error) {
    logError(
      "auditLog",
      `Failed to write audit entry: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Load audit log entries
 */
export function loadAuditLog(auditLogPath: string): AuditEntry[] {
  try {
    if (!fs.existsSync(auditLogPath)) {
      return [];
    }
    const content = fs.readFileSync(auditLogPath, "utf-8");
    const entries = JSON.parse(content);
    return Array.isArray(entries) ? entries : [];
  } catch (error) {
    logError(
      "auditLog",
      `Failed to load audit log: ${error instanceof Error ? error.message : String(error)}`
    );
    return [];
  }
}

/**
 * Get audit summary
 */
export function getAuditSummary(auditLogPath: string) {
  const entries = loadAuditLog(auditLogPath);

  return {
    totalEntries: entries.length,
    actions: {
      indexed: entries.filter((e) => e.action === "INDEXED").length,
      analyzed: entries.filter((e) => e.action === "ANALYZED").length,
      reclaimConfirmed: entries.filter((e) => e.action === "RECLAIM_CONFIRMED").length,
      reclaimFailed: entries.filter((e) => e.action === "RECLAIM_FAILED").length,
    },
    lastEntry: entries[entries.length - 1] || null,
  };
}
