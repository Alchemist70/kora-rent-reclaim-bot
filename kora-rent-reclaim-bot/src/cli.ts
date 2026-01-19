/**
 * CLI Interface
 * 
 * Command-line interface for the Kora Rent Reclaim Bot
 * Provides commands for:
 * - Indexing sponsored accounts
 * - Analyzing account state
 * - Running safety checks
 * - Executing reclaims (or dry-run)
 * - Generating reports
 * - Starting local dashboard
 */

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { PublicKey } from "@solana/web3.js";
import { loadConfig, createExampleConfig } from "./config.js";
import { initializeLogger, logInfo, logError, logDebug } from "./utils/logging.js";
import { getSolanaConnection, loadKeypair, getCurrentSlot } from "./utils/solana.js";
import { SponsoredAccountIndexer } from "./indexer/sponsorshipIndexer.js";
import { AccountAnalyzer } from "./analyzer/accountAnalyzer.js";
import { SafetyEngine } from "./safety/safetyEngine.js";
import { ReclaimExecutor } from "./reclaim/reclaimExecutor.js";
import { Reporter } from "./reporting/reporter.js";
import { DashboardServer } from "./dashboard/dashboardServer.js";
import { ReclaimAction, ReclaimStatus } from "./utils/types.js";
import { initializeAlertService, getAlertService } from "./alerting/telegramAlertService.js";

/**
 * Main CLI entry point
 */
async function main() {
  yargs(hideBin(process.argv))
    .command(
      "init",
      "Create an example config file",
      (yargs) =>
        yargs.option("output", {
          alias: "o",
          describe: "Output path for config file",
          default: "config.json",
          type: "string",
        }),
      async (argv) => {
        createExampleConfig(argv.output as string);
        console.log(`✓ Config created at: ${argv.output}`);
        process.exit(0);
      }
    )

    .command(
      "index",
      "Index sponsored accounts from a JSON file",
      (yargs) =>
        yargs
          .option("config", {
            alias: "c",
            describe: "Path to config file",
            default: "config.json",
            type: "string",
          })
          .option("import", {
            alias: "i",
            describe: "Path to accounts file to import",
            type: "string",
            demandOption: true,
          }),
      async (argv) => {
        try {
          const config = loadConfig(argv.config as string);
          initializeLogger(config.logLevel);

          logInfo(`Starting indexing from: ${argv.import}`);

          const indexer = new SponsoredAccountIndexer(config.indexPath);
          const imported = indexer.importAccountsFromFile(argv.import as string);

          const stats = indexer.getStatistics();
          logInfo(`✓ Indexing complete`, {
            totalTracked: stats.totalTracked,
            rentLocked: stats.totalRentLocked,
            imported,
          });

          process.exit(0);
        } catch (error) {
          logError("index", error instanceof Error ? error.message : String(error));
          process.exit(1);
        }
      }
    )

    .command(
      "analyze",
      "Analyze tracked accounts for reclaimability",
      (yargs) =>
        yargs.option("config", {
          alias: "c",
          describe: "Path to config file",
          default: "config.json",
          type: "string",
        }),
      async (argv) => {
        try {
          const config = loadConfig(argv.config as string);
          initializeLogger(config.logLevel);

          logInfo("Starting account analysis...");

          // Connect to Solana
          const connection = await getSolanaConnection(
            config.rpcUrl,
            config.maxRetries,
            config.retryDelayMs
          );

          // Load indexer
          const indexer = new SponsoredAccountIndexer(config.indexPath);
          const accounts = indexer.getTrackedAccounts();

          if (accounts.length === 0) {
            logInfo("No accounts to analyze");
            process.exit(0);
          }

          // Analyze all accounts
          const analyzer = new AccountAnalyzer(connection);
          const analyses = await analyzer.analyzeMultiple(accounts);

          // Create safety engine
          const safetyEngine = new SafetyEngine(config);

          // Check safety
          let reclaimableCount = 0;
          for (const analysis of analyses) {
            const safetyResult = safetyEngine.checkAccountSafety(analysis);
            if (safetyResult.approved) {
              reclaimableCount++;
              console.log(safetyEngine.getSafetyReport(analysis));
            }
          }

          logInfo(`✓ Analysis complete`, {
            total: analyses.length,
            reclaimable: reclaimableCount,
          });

          process.exit(0);
        } catch (error) {
          logError("analyze", error instanceof Error ? error.message : String(error));
          process.exit(1);
        }
      }
    )

    .command(
      "reclaim",
      "Execute reclaim actions (or dry-run)",
      (yargs) =>
        yargs
          .option("config", {
            alias: "c",
            describe: "Path to config file",
            default: "config.json",
            type: "string",
          })
          .option("dry-run", {
            alias: "d",
            describe: "Dry-run mode (don't submit transactions)",
            type: "boolean",
            default: true,
          }),
      async (argv) => {
        try {
          const config = loadConfig(argv.config as string);
          config.dryRun = argv["dry-run"] as boolean;
          initializeLogger(config.logLevel);

          logInfo(`Starting reclaim process (${config.dryRun ? "DRY-RUN" : "LIVE"})...`);

          // Initialize Telegram alerts if configured
          const alertService = config.telegram
            ? initializeAlertService(config.telegram)
            : null;

          // Test alert connection if enabled
          if (alertService && alertService.isEnabled()) {
            await alertService.testConnection();
          }

          // Connect to Solana
          const connection = await getSolanaConnection(
            config.rpcUrl,
            config.maxRetries,
            config.retryDelayMs
          );

          // Load keypair
          const operatorKeypair = loadKeypair(config.keypairPath);

          // Load indexer
          const indexer = new SponsoredAccountIndexer(config.indexPath);
          const accounts = indexer.getTrackedAccounts();

          if (accounts.length === 0) {
            logInfo("No accounts to process");
            process.exit(0);
          }

          // Analyze all accounts
          const analyzer = new AccountAnalyzer(connection);
          const analyses = await analyzer.analyzeMultiple(accounts);

          // Create safety engine
          const safetyEngine = new SafetyEngine(config);

          // Create executor
          const executor = new ReclaimExecutor(connection, operatorKeypair, config);

          // Create reporter
          const reporter = new Reporter(config.auditLogPath);

          // Execute reclaims
          const actions: ReclaimAction[] = [];
          let approvedCount = 0;

          for (const analysis of analyses) {
            const safetyResult = safetyEngine.checkAccountSafety(analysis);
            if (safetyResult.approved) {
              approvedCount++;
              const action = await executor.executeReclaim(analysis);
              actions.push(action);

              // Update audit log
              reporter.appendAuditEntry(
                action.status === ReclaimStatus.DRY_RUN ? "RECLAIM_DRY_RUN" : "RECLAIM_EXECUTED",
                analysis.publicKey,
                {
                  amount: action.amount,
                  txSignature: action.txSignature,
                  status: action.status,
                }
              );

              // Send Telegram alert on successful reclaim
              if (
                action.status === ReclaimStatus.CONFIRMED &&
                alertService &&
                alertService.isEnabled()
              ) {
                const amountSol = action.amount / 1e9;
                await alertService.alertRentReclaimed(
                  analysis.publicKey.toString(),
                  amountSol,
                  action.txSignature || "pending"
                );
              }

              // Remove from index after successful reclaim
              if (action.status === ReclaimStatus.CONFIRMED) {
                indexer.removeAccount(analysis.publicKey);
              }
            } else if (alertService && alertService.isEnabled() && safetyResult.checks.some(c => !c.passed)) {
              // Send alert on safety check failure
              const failedChecks = safetyResult.checks
                .filter(c => !c.passed)
                .map(c => c.name);
              await alertService.alertSafetyCheckFailed(
                analysis.publicKey.toString(),
                failedChecks
              );
            }
          }

          // Generate report
          const report = reporter.generateReport(analyses, actions, config.dryRun);
          const reportText = reporter.formatReport(report);
          console.log(reportText);

          // Save report
          const reportPath = config.auditLogPath.replace("audit-log.json", "report.json");
          reporter.saveReport(report, reportPath);

          // Send analysis summary to Telegram
          if (alertService && alertService.isEnabled()) {
            const totalRentLocked = analyses.reduce((sum, a) => sum + a.reclaimableLamports, 0) / 1e9;
            await alertService.sendAnalysisSummary(
              analyses.length,
              approvedCount,
              totalRentLocked
            );
          }

          logInfo(`✓ Reclaim process complete`, {
            analyzed: analyses.length,
            approved: approvedCount,
            executed: actions.filter((a) => a.status === ReclaimStatus.CONFIRMED).length,
            dryRun: config.dryRun,
          });

          process.exit(0);
        } catch (error) {
          logError("reclaim", error instanceof Error ? error.message : String(error));
          process.exit(1);
        }
      }
    )

    .command(
      "report",
      "Show audit log summary",
      (yargs) =>
        yargs.option("config", {
          alias: "c",
          describe: "Path to config file",
          default: "config.json",
          type: "string",
        }),
      async (argv) => {
        try {
          const config = loadConfig(argv.config as string);
          initializeLogger(config.logLevel);

          const reporter = new Reporter(config.auditLogPath);
          const summary = reporter.getAuditLogSummary();

          console.log("\n╔════════════════════════════════════════╗");
          console.log("║      AUDIT LOG SUMMARY                 ║");
          console.log("╚════════════════════════════════════════╝\n");

          console.log(`Total Entries: ${summary.totalEntries}\n`);
          console.log("Actions:\n");

          for (const [action, count] of Object.entries(summary.actionCounts)) {
            console.log(`  ${action.padEnd(30)} ${count}`);
          }

          console.log("\n");
          process.exit(0);
        } catch (error) {
          logError("report", error instanceof Error ? error.message : String(error));
          process.exit(1);
        }
      }
    )

    .command(
      "stats",
      "Show indexer statistics",
      (yargs) =>
        yargs.option("config", {
          alias: "c",
          describe: "Path to config file",
          default: "config.json",
          type: "string",
        }),
      async (argv) => {
        try {
          const config = loadConfig(argv.config as string);
          initializeLogger(config.logLevel);

          const indexer = new SponsoredAccountIndexer(config.indexPath);
          const stats = indexer.getStatistics();

          console.log("\n╔════════════════════════════════════════╗");
          console.log("║      INDEXER STATISTICS                ║");
          console.log("╚════════════════════════════════════════╝\n");

          console.log(`Total Tracked:     ${stats.totalTracked}`);
          console.log(`Total Rent Locked: ${(stats.totalRentLocked / 1_000_000_000).toFixed(4)} SOL\n`);

          console.log("Accounts by Owner:\n");
          for (const [owner, count] of stats.accountsByOwner.entries()) {
            console.log(`  ${owner.substring(0, 30)}... ${count}`);
          }

          console.log("\n");
          process.exit(0);
        } catch (error) {
          logError("stats", error instanceof Error ? error.message : String(error));
          process.exit(1);
        }
      }
    )

    .command(
      "test-telegram",
      "Test Telegram alerting configuration",
      (yargs) =>
        yargs.option("config", {
          alias: "c",
          describe: "Path to config file",
          default: "config.json",
          type: "string",
        }),
      async (argv) => {
        try {
          const config = loadConfig(argv.config as string);
          initializeLogger(config.logLevel);

          if (!config.telegram || !config.telegram.enabled) {
            logError("test-telegram", "Telegram alerting not enabled in config");
            process.exit(1);
          }

          logInfo("Testing Telegram connection...");

          const alertService = initializeAlertService(config.telegram);
          const success = await alertService.testConnection();

          if (success) {
            logInfo("✓ Telegram connection test successful");
            console.log("\n✅ Alerts will be sent to your Telegram chat\n");
            process.exit(0);
          } else {
            logError("test-telegram", "Connection test failed");
            console.log("\n❌ Failed to connect. Check:");
            console.log("  • Bot token is correct");
            console.log("  • Chat ID is correct");
            console.log("  • Network connectivity\n");
            process.exit(1);
          }
        } catch (error) {
          logError("test-telegram", error instanceof Error ? error.message : String(error));
          process.exit(1);
        }
      }
    )

    .command(
      "dashboard",
      "Start the local operator dashboard (read-only web UI)",
      (yargs) =>
        yargs
          .option("config", {
            alias: "c",
            describe: "Path to config file",
            default: "config.json",
            type: "string",
          })
          .option("port", {
            describe: "Port to run dashboard on",
            default: 3000,
            type: "number",
          })
          .option("host", {
            describe: "Host to bind to",
            default: "localhost",
            type: "string",
          }),
      async (argv) => {
        try {
          initializeLogger("debug");
          logInfo("Dashboard: Starting operator dashboard server");

          const configPath = argv.config as string;
          const port = argv.port as number;
          const host = argv.host as string;

          // Load configuration
          const config = loadConfig(configPath);

          // Create dashboard server
          const dashboard = new DashboardServer({
            port,
            host,
            auditLogPath: config.auditLogPath,
            indexPath: config.indexPath,
          });

          // Start server
          await dashboard.start();

          logInfo(`✓ Dashboard running at http://${host}:${port}`, {
            auditLog: config.auditLogPath,
            indexPath: config.indexPath,
          });

          // Keep process running
          process.on("SIGINT", async () => {
            logInfo("Dashboard: Shutting down gracefully");
            await dashboard.stop();
            process.exit(0);
          });
        } catch (error) {
          logError("dashboard", error instanceof Error ? error.message : String(error));
          process.exit(1);
        }
      }
    )

    .help()
    .alias("help", "h")
    .version("1.0.0")
    .alias("version", "v")
    .demandCommand()
    .strict()
    .parse();
}

// Run CLI
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
