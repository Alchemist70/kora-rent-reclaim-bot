# Documentation Index

Complete guide to the Kora Rent Reclaim Bot documentation. Start here to find what you need.

## Quick Start (5 minutes)

👉 **Start here if you're new:**
- [GETTING_STARTED.md](./GETTING_STARTED.md) — Setup in 5 minutes, configuration options, full workflow

## Development & Testing

- [docs/QUICKSTART.md](./docs/QUICKSTART.md) — Minimal quickstart for developers
- [TESTING_AND_REALTIME_OPS.md](./TESTING_AND_REALTIME_OPS.md) — Testing strategy, dry-run procedures, monitoring
- [docs/DEVNET-TESTING.md](./docs/DEVNET-TESTING.md) — Devnet-specific testing guide
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — System architecture and design decisions

## Production Deployment

👉 **Essential for operations:**
- [PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md) — Complete production setup, systemd service, monitoring, backup strategy
- [README.md](./README.md) — Project overview, features, configuration fields
- [GETTING_STARTED.md](./GETTING_STARTED.md) — Production checklist included

## Configuration

- **config.dev.json** — Development config (devnet, dry-run, debug logging)
- **config.prod.example.json** — Production template (mainnet, env vars, live mode)
- **config-telegram-example.json** — Telegram alerting example
- [README.md - Configuration Section](./README.md#configuration-files-reference) — Detailed field descriptions

## Features & Monitoring

- [SCHEDULER_BATCH_GUIDE.md](./SCHEDULER_BATCH_GUIDE.md) — **NEW:** Advanced scheduling and batch processing (cron automation, high-volume optimization)
- [SCHEDULER_BATCH_SUMMARY.md](./SCHEDULER_BATCH_SUMMARY.md) — Technical implementation details
- [TELEGRAM_ALERTING_IMPLEMENTATION.md](./TELEGRAM_ALERTING_IMPLEMENTATION.md) — Telegram alerts setup and API
- [docs/DASHBOARD.md](./docs/DASHBOARD.md) — Dashboard features and usage
- [docs/MONITORING.md](./docs/MONITORING.md) — Monitoring strategies and metrics
- [docs/ALERTING.md](./docs/ALERTING.md) — Alert types and configurations

## Understanding Solana

- [docs/solana-rent-explained.md](./docs/solana-rent-explained.md) — Solana rent model explained simply
- [docs/kora-rent-flow.md](./docs/kora-rent-flow.md) — How Kora accounts work and why rent gets locked
- [README.md - How It Works](./README.md#how-it-works) — Architecture overview

## Troubleshooting

See [PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md#step-7-monitoring--alerting) for:
- Bot won't start
- No reclaims happening
- Telegram alerts not working
- Emergency shutdown procedures

## File Reference

### Root Directory
```
.
├── README.md                              Project overview
├── GETTING_STARTED.md                     Setup guide (dev + prod)
├── PRODUCTION_DEPLOYMENT.md               Production runbook
├── TESTING_AND_REALTIME_OPS.md            Testing procedures
├── SCHEDULER_BATCH_GUIDE.md               Advanced scheduling & batch processing (NEW)
├── SCHEDULER_BATCH_SUMMARY.md             Implementation technical details (NEW)
├── TELEGRAM_ALERTING_IMPLEMENTATION.md    Alert system guide
├── FILE_MANIFEST.md                       List of all source files
├── config.dev.json                        Development config template
├── config.prod.example.json               Production config template
├── config-telegram-example.json           Telegram testing config
├── accounts-to-track.json                 Sample accounts file
└── package.json                           Dependencies
```

### Documentation Directory (`docs/`)
```
docs/
├── QUICKSTART.md                          Minimal 10-minute setup
├── ARCHITECTURE.md                        System design
├── DASHBOARD.md                           Dashboard features
├── MONITORING.md                          Monitoring guide
├── ALERTING.md                            Alert configuration
├── DEVNET-TESTING.md                      Devnet testing procedures
├── solana-rent-explained.md               Rent model explanation
├── kora-rent-flow.md                      Kora account flow
└── README.md                              See root README.md
```

### Source Code (`src/`)
```
src/
├── cli.ts                                 Command-line interface (+ schedule, batch commands)
├── config.ts                              Configuration loader
├── dashboard/dashboardServer.ts           Web dashboard server
├── indexer/sponsorshipIndexer.ts          Account indexing
├── analyzer/accountAnalyzer.ts            Account analysis
├── safety/safetyEngine.ts                 Safety validation
├── reclaim/reclaimExecutor.ts             Transaction execution
├── reporting/reporter.ts                  Audit logging
├── alerting/telegramAlertService.ts       Telegram alerts
├── utils/types.ts                         TypeScript types
├── utils/logging.ts                       Logging setup
├── utils/solana.ts                        Solana utilities
├── utils/scheduler.ts                     Cron scheduling (NEW)
├── utils/batchProcessor.ts                Parallel batch processing (NEW)
└── utils/auditLog.ts                      Audit trail
```

### Data Directory (Created at Runtime)
```
data/
├── indexed-accounts.json                  Tracked accounts
├── audit-log.json                         All actions
└── reports/                               Generated reports
```

## Configuration Quick Reference

### Development
```bash
cp config.dev.json config.json
npm start -- analyze --config config.json
```

### Production
```bash
source .env  # Load environment variables
npm start -- reclaim --config config.prod.json
```

### Key Config Differences

| Setting | Dev | Prod |
|---------|-----|------|
| RPC | Public devnet | Private endpoint |
| Cluster | devnet | mainnet-beta |
| Dry-run | true (safe) | false (live) |
| Logging | debug (verbose) | info (less noise) |
| Dashboard | localhost:3000 | Behind reverse proxy |
| Telegram | optional | recommended |

## Common Tasks

### I want to...

**Set up for the first time**
→ Read [GETTING_STARTED.md](./GETTING_STARTED.md)

**Understand how rent works**
→ Read [docs/solana-rent-explained.md](./docs/solana-rent-explained.md)

**Test before deploying**
→ Read [TESTING_AND_REALTIME_OPS.md](./TESTING_AND_REALTIME_OPS.md)

**Deploy to production**
→ Read [PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md)

**Set up alerts**
→ Read [TELEGRAM_ALERTING_IMPLEMENTATION.md](./TELEGRAM_ALERTING_IMPLEMENTATION.md)

**Monitor operations**
→ Read [docs/MONITORING.md](./docs/MONITORING.md)

**View the dashboard**
→ Read [docs/DASHBOARD.md](./docs/DASHBOARD.md)

**Understand the architecture**
→ Read [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)

**Troubleshoot an issue**
→ Read [PRODUCTION_DEPLOYMENT.md - Troubleshooting](./PRODUCTION_DEPLOYMENT.md#step-8-runbook)

## Development Info

### Build & Run
```bash
npm install        # Install dependencies
npm run build      # TypeScript build
npm start          # Run CLI
```

### Commands
```bash
npm start -- init              # Create example config
npm start -- index --import    # Import accounts
npm start -- analyze           # Analyze accounts
npm start -- reclaim           # Execute reclaim
npm start -- report            # View audit log
npm start -- dashboard         # Start web dashboard
npm start -- start-bot         # Start Telegram bot responder
npm start -- test-telegram     # Test Telegram alerts
```

### Technology Stack
- **Language**: TypeScript (strict mode)
- **Framework**: Node.js 16+
- **Blockchain**: @solana/web3.js
- **Database**: JSON files (auditable)
- **Logging**: Winston
- **Dashboard**: Express.js + Chart.js
- **Alerts**: Telegram Bot API

### Code Quality
- ✅ TypeScript strict mode
- ✅ 100% no compilation errors
- ✅ Comprehensive error handling
- ✅ Detailed audit logging
- ✅ Production-ready safety checks

## Support

- 📖 **Documentation**: See files above
- 🐛 **Bugs**: Open issue on GitHub
- 💬 **Questions**: Check docs first, then open discussion
- 📋 **Suggestions**: Open feature request

## Changelog

### v1.0.0 (January 19, 2026)
- ✅ Core reclaim functionality
- ✅ Operator dashboard (read-only web UI)
- ✅ Telegram alerting system
- ✅ Advanced monitoring & metrics
- ✅ Production deployment guide
- ✅ Professional blockchain-styled UI

## Additional Resources

- [Solana Docs](https://docs.solana.com/) — Official Solana documentation
- [Kora Labs](https://www.getkoralabs.com) — Kora ecosystem
- [@solana/web3.js](https://solana-labs.github.io/solana-web3.js/) — Solana JS library
- [SPL Token Program](https://github.com/solana-labs/solana-program-library) — Token standard

---
