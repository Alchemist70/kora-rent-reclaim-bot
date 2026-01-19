/**
 * Logging utility with Winston
 * All bot actions are logged with timestamps and context
 * This ensures full auditability of all operations
 */

import winston from "winston";
import fs from "fs";
import path from "path";

let logger: winston.Logger | null = null;

/**
 * Initialize the logging system
 * Creates both console and file output
 */
export function initializeLogger(
  logLevel: "debug" | "info" | "warn" | "error" = "info",
  logDir: string = "./logs"
): winston.Logger {
  // Create logs directory if it doesn't exist
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  // Define log format: timestamp, level, and message
  const logFormat = winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  );

  // Console output format (more readable)
  const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.printf(({ timestamp, level, message }) => {
      return `[${timestamp}] ${level}: ${message}`;
    })
  );

  logger = winston.createLogger({
    level: logLevel,
    format: logFormat,
    defaultMeta: { service: "kora-rent-reclaim-bot" },
    transports: [
      // Console output
      new winston.transports.Console({
        format: consoleFormat,
      }),

      // File output - all logs
      new winston.transports.File({
        filename: path.join(logDir, "bot.log"),
        maxsize: 10485760, // 10MB
        maxFiles: 5,
      }),

      // File output - errors only
      new winston.transports.File({
        filename: path.join(logDir, "error.log"),
        level: "error",
        maxsize: 10485760,
        maxFiles: 5,
      }),
    ],
  });

  return logger;
}

/**
 * Get the logger instance
 * Returns existing logger or initializes default
 */
export function getLogger(): winston.Logger {
  if (!logger) {
    logger = initializeLogger("info");
  }
  return logger;
}

/**
 * Log an account action (indexing, analyzing, reclaiming)
 * This is used for audit trail purposes
 */
export function logAccountAction(
  action: string,
  accountPubkey: string,
  details: Record<string, any>
): void {
  const log = getLogger();
  log.info(`[${action}] Account: ${accountPubkey}`, details);
}

/**
 * Log a reclaim decision
 */
export function logReclaimDecision(
  accountPubkey: string,
  approved: boolean,
  reason: string,
  details?: Record<string, any>
): void {
  const log = getLogger();
  const status = approved ? "✓ APPROVED" : "✗ REJECTED";
  log.info(`[RECLAIM_DECISION] ${status} - ${accountPubkey}: ${reason}`, details);
}

/**
 * Log a transaction submission
 */
export function logTransactionSubmitted(
  txSignature: string,
  details: Record<string, any>
): void {
  const log = getLogger();
  log.info(`[TX_SUBMITTED] ${txSignature}`, details);
}

/**
 * Log a safety check
 */
export function logSafetyCheck(
  checkName: string,
  passed: boolean,
  details: string
): void {
  const log = getLogger();
  const status = passed ? "PASS" : "FAIL";
  log.info(`[SAFETY_CHECK] ${checkName}: ${status} - ${details}`);
}

/**
 * Log an error with context
 */
export function logError(
  context: string,
  error: Error | string,
  details?: Record<string, any>
): void {
  const log = getLogger();
  const errorMessage = typeof error === "string" ? error : error.message;
  const stack = typeof error === "string" ? undefined : error.stack;
  
  log.error(`[${context}] ${errorMessage}`, {
    ...details,
    stack,
  });
}

/**
 * Log a debug message
 */
export function logDebug(message: string, details?: Record<string, any>): void {
  const log = getLogger();
  log.debug(message, details);
}

/**
 * Log general info
 */
export function logInfo(message: string, details?: Record<string, any>): void {
  const log = getLogger();
  log.info(message, details);
}

/**
 * Log a warning
 */
export function logWarn(message: string, details?: Record<string, any>): void {
  const log = getLogger();
  log.warn(message, details);
}
