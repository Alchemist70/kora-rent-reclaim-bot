# Project Files - Dev & Production Ready

**Status**: ✅ Production Ready | **Build**: 0 TypeScript Errors | **Date**: January 19, 2026

Complete inventory of all project files optimized for both local development and production deployment.

---

## Configuration Files

### Development
| File | Purpose | Usage |
|------|---------|-------|
| **config.dev.json** | Development configuration template | `cp config.dev.json config.json` |
| **.env.example** | Environment variables template | Source locally, NEVER commit |

### Production  
| File | Purpose | Usage |
|------|---------|-------|
| **config.prod.example.json** | Production template with env vars | `cp config.prod.example.json config.json` |
| **.env.production** | Production environment variables | Load via systemd service |

### Testing
| File | Purpose | Usage |
|------|---------|-------|
| **config-telegram-example.json** | Pre-configured Telegram testing | Direct testing of alerts |
| **accounts-to-track.json** | Sample accounts for testing | `npm start -- index --import accounts-to-track.json` |

**Note**: `config.json` is gitignored and created locally from templates.

---

## Documentation Files (Root)

All markdown documentation is environment-agnostic and includes both dev & production guidance.

| File | Purpose | Audience |
|------|---------|----------|
| **README.md** | Project overview, architecture, features | Everyone |
| **GETTING_STARTED.md** | 5-minute setup + full workflow + production checklist | New users |
| **PRODUCTION_DEPLOYMENT.md** | Complete production runbook, systemd setup, monitoring | DevOps/SRE |
| **TESTING_AND_REALTIME_OPS.md** | Testing procedures, dry-run guidelines, monitoring | QA/Operators |
| **TELEGRAM_ALERTING_IMPLEMENTATION.md** | Alert system guide, API reference, troubleshooting | All users |
| **DOCUMENTATION.md** | Index of all docs, quick reference guide | All users |
| **FILE_MANIFEST.md** | List of all source code files with descriptions | Developers |

---

## Documentation Files (docs/)

| File | Purpose | Environment |
|------|---------|-------------|
| **QUICKSTART.md** | Minimal 10-minute setup | Both (devnet + testnet) |
| **ARCHITECTURE.md** | System design and components | Both (reference only) |
| **DASHBOARD.md** | Web dashboard features and usage | Both |
| **MONITORING.md** | Monitoring strategies and metrics | Production-focused |
| **ALERTING.md** | Alert types and configurations | Both |
| **DEVNET-TESTING.md** | Devnet-specific testing guide | Development-focused |
| **solana-rent-explained.md** | Solana rent model explanation | Both (educational) |
| **kora-rent-flow.md** | How Kora accounts work | Both (educational) |

---

## Source Code Files (src/)

All TypeScript files include production safety by default (strict mode, error handling, logging).

### Core CLI & Configuration
```
src/
├── cli.ts                    Command-line interface (reclaim, analyze, index, dashboard, test-telegram)
├── config.ts                 Configuration loader with env var support
└── utils/
    ├── types.ts              TypeScript interfaces (all types)
    ├── logging.ts            Winston-based structured logging
    ├── solana.ts             Solana utilities (RPC, keypair, connection)
    └── types.ts              Domain types
```

### Indexing & Analysis
```
├── indexer/
│   └── sponsorshipIndexer.ts Account indexing and tracking
├── analyzer/
│   └── accountAnalyzer.ts    On-chain account analysis
└── safety/
    └── safetyEngine.ts       9-point safety validation
```

### Reclaim & Reporting
```
├── reclaim/
│   └── reclaimExecutor.ts    Transaction execution (dry-run + live)
├── reporting/
│   └── reporter.ts           Audit logging and reporting
└── alerting/
    └── telegramAlertService.ts Telegram alert integration
```

### Web Dashboard
```
└── dashboard/
    └── dashboardServer.ts    Express server for web UI (read-only, professional styling)
```

### Frontend (public/)
```
public/
├── index.html              Dashboard HTML (professional blockchain UI)
├── dashboard.js            Dashboard JavaScript logic
├── style.css               Professional CSS with glass-morphism effects
└── (implicitly referenced by dashboardServer.ts)
```

---

## Data Files (Created at Runtime)

Created automatically when bot runs:

```
data/
├── indexed-accounts.json      Tracked accounts (updated during indexing)
├── audit-log.json            Complete audit trail of all actions
└── reports/
    └── report-{timestamp}.json Generated after each reclaim cycle
```

**Backup these files regularly in production!**

---

## Development vs Production Comparison

### Development Setup
```
📁 root/
  ├── config.dev.json           ← Use this
  ├── accounts-to-track.json    ← Use this
  ├── .env                       ← Optional (for local testing)
  └── npm start -- analyze
```

**Characteristics:**
- ✅ Public RPC endpoint (devnet)
- ✅ Dry-run mode enabled (no transactions)
- ✅ Debug logging (verbose)
- ✅ Dashboard on localhost:3000
- ✅ Low alert thresholds (frequent alerts)
- ✅ minInactivitySlots: 100,000 (~46 hours)

### Production Setup
```
📁 /opt/kora-rent-reclaim-bot/
  ├── config.prod.json           ← Created from config.prod.example.json
  ├── .env                        ← Secure, chmod 600
  ├── /var/lib/bot-data/          ← Separate data directory
  │   ├── indexed-accounts.json
  │   ├── audit-log.json
  │   └── reports/
  ├── Systemd service             ← Runs continuously
  ├── Nginx reverse proxy         ← Dashboard with TLS
  └── S3 backups                  ← Automated daily
```

**Characteristics:**
- ✅ Private RPC endpoint (mainnet-beta)
- ✅ Dry-run mode disabled (real transactions)
- ✅ Info logging (less noise)
- ✅ Dashboard behind reverse proxy with TLS
- ✅ High alert thresholds (significant amounts only)
- ✅ minInactivitySlots: 1,000,000 (~2.5 days)
- ✅ systemd service for 24/7 operation
- ✅ Automated backups

---

## Configuration Field Reference

### Common Fields (Both Environments)

```json
{
  "rpcUrl": "RPC_ENDPOINT",
  "cluster": "devnet|testnet-beta|mainnet-beta",
  "keypairPath": "./keypair.json",
  "treasuryAddress": "PUBKEY",
  "indexPath": "./data/indexed-accounts.json",
  "auditLogPath": "./data/audit-log.json",
  "minInactivitySlots": 100000,
  "maxRetries": 3,
  "retryDelayMs": 1000,
  "dryRun": true|false,
  "logLevel": "debug|info|warn|error"
}
```

### Environment-Specific Differences

| Field | Dev | Prod |
|-------|-----|------|
| `rpcUrl` | Public devnet | Private endpoint |
| `cluster` | devnet | mainnet-beta |
| `dryRun` | true (safe) | false (live) |
| `logLevel` | debug | info |
| `minInactivitySlots` | 100,000 | 1,000,000 |
| `maxRetries` | 3 | 5 |
| `retryDelayMs` | 1,000 | 2,000 |

---

## Environment Variables (Production Only)

Never hardcode secrets. Use environment variables:

```bash
# .env file (chmod 600, .gitignore)
SOLANA_RPC_URL="https://your-private-rpc.example.com"
KEYPAIR_PATH="/secure/vault/keypair.json"
TREASURY_ADDRESS="YOUR_TREASURY_PUBKEY"
TELEGRAM_BOT_TOKEN="YOUR_BOT_TOKEN"
TELEGRAM_CHAT_ID="YOUR_CHAT_ID"
DATA_DIR="/var/lib/bot-data"
LOG_DIR="/var/log/kora-bot"
```

Load in production:
```bash
source /opt/kora-rent-reclaim-bot/.env
npm start -- reclaim --config config.prod.json
```

---

## Quick Start Commands

### Development
```bash
# Setup
cp config.dev.json config.json

# Build
npm install
npm run build

# Test
npm start -- analyze --config config.json

# Dashboard
npm start -- dashboard --config config.json
```

### Production
```bash
# Setup
cp config.prod.example.json config.prod.json
source .env

# Build
npm install
npm run build

# Deploy (via systemd)
sudo systemctl start kora-bot
sudo journalctl -u kora-bot -f
```

---

## Files Summary

### Total Files by Category

**Configuration Templates**: 3
- config.dev.json
- config.prod.example.json
- config-telegram-example.json

**Documentation**: 13
- 5 root markdown files
- 8 docs/ markdown files

**Source Code**: 15+ TypeScript files
- CLI, indexer, analyzer, safety engine, executor, reporter, alerts, dashboard

**Frontend**: 3 files
- HTML, JavaScript, CSS

**Sample Data**: 1 file
- accounts-to-track.json

**Total**: 40+ files all production-ready

---

## File Exclusions (gitignore)

Files NOT tracked in git (security & privacy):

```
config.json              (Use config.dev.json template instead)
config.prod.json         (Use config.prod.example.json template)
.env                     (Secrets - generate locally)
.env.production          (Secrets - never commit)
data/                    (Runtime data)
dist/                    (Compiled JavaScript)
node_modules/            (Dependencies)
*.log                    (Log files)
/backups/                (Local backups)
```

---

## Maintenance & Updates

### Regular Checks
- [ ] Review and rotate secrets quarterly
- [ ] Update npm dependencies monthly
- [ ] Test disaster recovery monthly
- [ ] Review audit logs weekly
- [ ] Monitor disk space for data/

### Upgrades
- Always test on devnet first
- Run full test suite before mainnet upgrade
- Maintain 2 deployments (canary + stable)

---

## Support & Troubleshooting

**Issue**: Config not found
→ Use: `cp config.dev.json config.json`

**Issue**: Secrets exposed in git
→ Use: Environment variables (see PRODUCTION_DEPLOYMENT.md)

**Issue**: Build fails
→ Run: `npm install && npm run build`

**Issue**: Telegram alerts not working
→ Run: `npm start -- test-telegram --config config.json`

For more help, see:
- [DOCUMENTATION.md](./DOCUMENTATION.md)
- [PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md)
- [GETTING_STARTED.md](./GETTING_STARTED.md)

---

## Compliance & Audit

All operations are logged to `audit-log.json`:
- Timestamp
- Action type (INDEX, ANALYZE, RECLAIM, etc.)
- Account public key
- Amount
- Transaction signature
- Status

**In production, ship logs to immutable storage** (S3, CloudWatch, etc.)

---

**Last Updated**: January 19, 2026  
**Status**: ✅ Production Ready  
**Build Errors**: 0  
**TypeScript Strict Mode**: ✅ Enabled  
