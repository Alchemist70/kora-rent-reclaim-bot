/**
 * Configuration loading and validation
 * Loads settings from config.json and environment variables
 * Validates all required parameters before starting the bot
 */

import fs from "fs";
import path from "path";
import { PublicKey } from "@solana/web3.js";
import { BotConfig } from "./utils/types.js";
import { isValidPublicKey } from "./utils/solana.js";
import { logError, logInfo, logDebug } from "./utils/logging.js";

/**
 * Load configuration from JSON file
 * Validates all required fields and types
 */
export function loadConfig(configPath: string): BotConfig {
  try {
    // Check file exists
    if (!fs.existsSync(configPath)) {
      throw new Error(`Config file not found: ${configPath}`);
    }

    logDebug(`Loading config from: ${configPath}`);

    // Parse JSON
    let rawConfig: any;
    try {
      rawConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    } catch (error) {
      throw new Error(
        `Failed to parse config JSON: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Load .env if present (populate process.env for substitutions)
    try {
      const envPath = path.resolve('.env');
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        envContent.split(/\r?\n/).forEach((line) => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) return;
          const idx = trimmed.indexOf('=');
          if (idx === -1) return;
          const key = trimmed.slice(0, idx).trim();
          const val = trimmed.slice(idx + 1).trim();
          if (!(key in process.env)) {
            // remove optional surrounding quotes
            process.env[key] = val.replace(/^"|"$/g, '').replace(/^'|'$/g, '');
          }
        });
      }
    } catch (e) {
      // non-fatal
    }

    // Replace ${ENV_VAR} placeholders in rawConfig using process.env
    const replacePlaceholders = (obj: any): any => {
      if (obj === null || obj === undefined) return obj;
      if (typeof obj === 'string') {
        return obj.replace(/\$\{([A-Z0-9_]+)\}/gi, (_m: string, name: string) => {
          return process.env[name] ?? '';
        });
      }
      if (Array.isArray(obj)) {
        return obj.map((v) => replacePlaceholders(v));
      }
      if (typeof obj === 'object') {
        const out: any = {};
        for (const [k, v] of Object.entries(obj)) {
          out[k] = replacePlaceholders(v);
        }
        return out;
      }
      return obj;
    };

    rawConfig = replacePlaceholders(rawConfig);

    // Validate required fields
    const requiredFields = [
      "rpcUrl",
      "cluster",
      "keypairPath",
      "treasuryAddress",
      "indexPath",
      "auditLogPath",
    ];

    for (const field of requiredFields) {
      if (!(field in rawConfig)) {
        throw new Error(`Missing required config field: ${field}`);
      }
    }

    // Validate RPC URL
    if (typeof rawConfig.rpcUrl !== "string" || !rawConfig.rpcUrl.trim()) {
      throw new Error("rpcUrl must be a non-empty string");
    }

    // Validate cluster
    const validClusters = ["devnet", "testnet-beta", "mainnet-beta"];
    if (!validClusters.includes(rawConfig.cluster)) {
      throw new Error(
        `cluster must be one of: ${validClusters.join(", ")}`
      );
    }

    // Validate keypair path exists
    if (typeof rawConfig.keypairPath !== "string" || !rawConfig.keypairPath.trim()) {
      throw new Error("keypairPath must be a non-empty string");
    }

    if (!fs.existsSync(rawConfig.keypairPath)) {
      throw new Error(`Keypair file not found: ${rawConfig.keypairPath}`);
    }

    // Validate treasury address
    if (!isValidPublicKey(rawConfig.treasuryAddress)) {
      throw new Error(
        `treasuryAddress is not a valid Solana public key: ${rawConfig.treasuryAddress}`
      );
    }

    // Validate paths
    if (typeof rawConfig.indexPath !== "string" || !rawConfig.indexPath.trim()) {
      throw new Error("indexPath must be a non-empty string");
    }

    if (typeof rawConfig.auditLogPath !== "string" || !rawConfig.auditLogPath.trim()) {
      throw new Error("auditLogPath must be a non-empty string");
    }

    // Set defaults for optional fields
    const minInactivitySlots = rawConfig.minInactivitySlots ?? 100000; // ~46 hours on devnet
    const maxRetries = rawConfig.maxRetries ?? 3;
    const retryDelayMs = rawConfig.retryDelayMs ?? 1000;
    const dryRun = rawConfig.dryRun ?? true; // Default to dry-run for safety
    const logLevel = rawConfig.logLevel ?? "info";

    // Parse allowed programs
    const allowedPrograms: PublicKey[] = [];
    if (rawConfig.allowedPrograms && Array.isArray(rawConfig.allowedPrograms)) {
      for (const programStr of rawConfig.allowedPrograms) {
        if (!isValidPublicKey(programStr)) {
          throw new Error(`Invalid program address in allowedPrograms: ${programStr}`);
        }
        allowedPrograms.push(new PublicKey(programStr));
      }
    }

    // Validate log level
    const validLogLevels = ["debug", "info", "warn", "error"];
    if (!validLogLevels.includes(logLevel)) {
      throw new Error(`logLevel must be one of: ${validLogLevels.join(", ")}`);
    }

    // Parse Telegram configuration
    const telegramConfig = rawConfig.telegram ? {
      enabled: rawConfig.telegram.enabled ?? false,
      botToken: rawConfig.telegram.botToken ?? "",
      chatId: rawConfig.telegram.chatId ?? "",
      alerts: rawConfig.telegram.alerts ? {
        reclaimThreshold: rawConfig.telegram.alerts.reclaimThreshold,
        idleThreshold: rawConfig.telegram.alerts.idleThreshold,
        dailySummary: rawConfig.telegram.alerts.dailySummary ?? false
      } : undefined
    } : undefined;

    // Parse dashboard configuration
    const dashboardConfig = rawConfig.dashboard ? {
      enabled: rawConfig.dashboard.enabled ?? false,
      port: rawConfig.dashboard.port ?? 3000,
      host: rawConfig.dashboard.host ?? "localhost"
    } : undefined;

    const config: BotConfig = {
      rpcUrl: rawConfig.rpcUrl,
      cluster: rawConfig.cluster,
      keypairPath: path.resolve(rawConfig.keypairPath),
      treasuryAddress: new PublicKey(rawConfig.treasuryAddress),
      indexPath: path.resolve(rawConfig.indexPath),
      auditLogPath: path.resolve(rawConfig.auditLogPath),
      minInactivitySlots,
      maxRetries,
      retryDelayMs,
      allowedPrograms,
      dryRun,
      logLevel,
      telegram: telegramConfig,
      dashboard: dashboardConfig,
    };

    logInfo(
      `✓ Config loaded successfully (${config.dryRun ? "DRY-RUN MODE" : "LIVE MODE"})`,
      {
        cluster: config.cluster,
        treasury: config.treasuryAddress.toString(),
        minInactivitySlots: config.minInactivitySlots,
      }
    );

    return config;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logError("loadConfig", errorMsg);
    throw new Error(`Config validation failed: ${errorMsg}`);
  }
}

/**
 * Create an example config file
 * Useful for setting up the bot for the first time
 */
export function createExampleConfig(outputPath: string): void {
  const exampleConfig = {
    // RPC endpoint - can be public or private
    // Public endpoints: https://api.devnet.solana.com, https://api.testnet.solana.com
    rpcUrl: "https://api.devnet.solana.com",

    // Solana cluster to operate on
    cluster: "devnet",

    // Path to operator keypair (JSON format)
    // KEEP THIS SECURE! This account will sign reclaim transactions
    keypairPath: "./keypair.json",

    // Treasury address where reclaimed SOL should be sent
    // Should be under operator control
    treasuryAddress: "11111111111111111111111111111111",

    // Path to track indexed accounts (persisted locally)
    indexPath: "./data/indexed-accounts.json",

    // Path to audit log (all actions recorded here)
    auditLogPath: "./data/audit-log.json",

    // Minimum inactivity period (in slots) before an account is eligible for reclaim
    // Solana: ~400ms per slot on average
    // 100000 slots ≈ 46 hours (safe default)
    minInactivitySlots: 100000,

    // RPC retry configuration
    maxRetries: 3,
    retryDelayMs: 1000,

    // Programs we're allowed to interact with (empty = only System program)
    // Examples: SPL Token program, custom programs
    allowedPrograms: [],

    // Dry-run mode (recommend: always start with true!)
    // In dry-run: analyzes accounts, logs decisions, but doesn't submit transactions
    dryRun: true,

    // Log level: debug, info, warn, error
    logLevel: "info",

    // Optional: Telegram alerting configuration
    telegram: {
      enabled: false,
      botToken: "YOUR_TELEGRAM_BOT_TOKEN",
      chatId: "YOUR_TELEGRAM_CHAT_ID",
      alerts: {
        // Minimum SOL amount to trigger reclaim alert
        reclaimThreshold: 0.1,
        // Minimum idle SOL to trigger idle rent alert
        idleThreshold: 0.5,
        // Send daily summary
        dailySummary: false
      }
    },

    // Optional: Local dashboard configuration
    dashboard: {
      enabled: false,
      port: 3000,
      host: "localhost"
    },
  };

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(exampleConfig, null, 2));
  logInfo(`✓ Example config created at: ${outputPath}`);
}
