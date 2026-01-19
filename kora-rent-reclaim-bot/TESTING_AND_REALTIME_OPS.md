# Testing & Real-Time Operations Guide

**Latest Update**: January 19, 2026  
**System Status**: ✅ Production-Ready | Dashboard at http://localhost:3000  
**Architecture**: Multi-layer validation with real-time monitoring  
**Safety Level**: Enterprise-grade with mandatory dry-run testing  

---

## Quick Navigation

- **New to the bot?** Start with [GETTING_STARTED.md](./GETTING_STARTED.md)
- **First deploy?** Follow [PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md)
- **Local development?** Use [config.dev.json](./config.dev.json)
- **Production setup?** Use [config.prod.example.json](./config.prod.example.json)

---

## Overview

The Solana Kora Rent Reclaim Bot uses a **3-tier testing approach** before any live operations:

```
Test Environment (devnet/testnet)  ← Use config.dev.json or testnet config
    ↓
Validation Checks (Safety engine)
    ↓
Dry-Run Simulation (dryRun: true)
    ↓
Live Execution (dryRun: false)  ← Production mode
    ↓
Real-Time Monitoring (Dashboard + Telegram)
```

Every operation is logged, monitored, and reversible (when possible).

---

## Environment Configuration

### Development Mode
Use `config.dev.json`:
- RPC: Public devnet endpoint
- Dry-run: ENABLED (no transactions)
- Logging: Debug (verbose)
- Dashboard: localhost:3000

```bash
cp config.dev.json config.json
npm start -- analyze --config config.json
```

### Production Mode
Use `config.prod.example.json` with environment variables:
- RPC: Private endpoint (Helius, Triton, etc.)
- Dry-run: DISABLED (real transactions)
- Logging: Info (less verbose)
- Dashboard: Secured behind reverse proxy

```bash
source .env  # Load your secrets
npm start -- reclaim --config config.prod.json
```

---

## Part 1: Testing Strategy

### 1.1 Unit Testing (Local)

**Before deployment, test individual components:**

```bash
# Build and verify no compilation errors
npm run build

# Test CLI commands with --help
node dist/cli.js --help

# Test init command
node dist/cli.js init --output test-config.json

# Verify config was created
cat test-config.json
```

**What gets tested:**
- ✅ CLI argument parsing
- ✅ Configuration loading
- ✅ File I/O operations
- ✅ Path resolution

### 1.2 Configuration Testing

**Create test config for devnet:**

```json
{
  "rpcUrl": "https://api.devnet.solana.com",
  "cluster": "devnet",
  "keypairPath": "./test-keypair.json",
  "treasuryAddress": "6qNzjnzjDPmqMLhx1wbBWXEyuZ5EpwJnZZpQaZRvkrz",
  "indexPath": "./data/test-accounts.json",
  "auditLogPath": "./data/test-audit.json",
  "minInactivitySlots": 100000,
  "dryRun": true,
  "logLevel": "debug",
  "dashboard": {
    "enabled": true,
    "port": 3000
  }
}
```

**Validate your configuration:**

Load it up and see if it parses okay:
node dist/cli.js init --output /dev/null --config test-config.json

# Check logs for errors
tail -f logs/error.log
```

### 1.3 Account Indexing Test

Let's test that imports work. Create a small test dataset:

```bash
# Create test accounts file with 5 sample accounts
cat > test-accounts.json << 'EOF'
[
  {
    "publicKey": "2v6A93rjxfqsH7kCTKxmJXd9v3TxzNHqZVHJqWwE1Q2",
    "ownerProgram": "11111111111111111111111111111111",
    "rentLamportsAtCreation": 890880,
    "creationSlot": 1000,
    "creationTxSignature": "5DZ...",
    "createdAt": 1705689600
  }
]
EOF

# Index the test accounts
node dist/cli.js index --import test-accounts.json --config test-config.json
```

**Verify indexing:**

```bash
# Check indexed data
cat data/test-accounts.json | jq '.length'  # Should show count

# Check audit log
cat data/test-audit.json | jq '.[-1]'       # Should show import action
```

### 1.4 Analysis Testing

**Run safety analysis on test data:**

```bash
# Analyze accounts (dry-run by default)
node dist/cli.js analyze --config test-config.json
```

**Expected output shows:**

```
✅ Account 2v6A93r... RECLAIMABLE (no active tokens, no recent txs)
✅ Account 3x7B94s... RECLAIMABLE (locked since slot 1000)
⚠️  Account 4y8C95t... SKIP_LOW_RENT (rent too small)
❌ Account 5z9D96u... CANNOT_RECLAIM (active token balance)
```

**What gets tested:**
- ✅ Account data parsing
- ✅ Safety validation rules
- ✅ Token balance checking
- ✅ Rent amount filtering

### 1.5 Dry-Run Reclaim Testing

**CRITICAL: Always test before going live!**

```bash
# Ensure dryRun: true in config.json
cat test-config.json | grep -A 2 '"dryRun"'

# Run dry-run reclaim
node dist/cli.js reclaim --config test-config.json
```

**Expected output:**

```
[INFO] Dry-run mode: No transactions will be submitted

Account: 2v6A93r...
  Status: RECLAIMABLE
  Rent to reclaim: 890880 lamports (0.0009 SOL)
  Estimated fee: 5000 lamports
  Net recovery: 885880 lamports

Total accounts analyzed: 1
Total potential recovery: 0.0009 SOL
Estimated fees: 0.000005 SOL
Net recovery: 0.000885 SOL

Transaction would be submitted to: devnet
```

**Review the output carefully:**
- ✅ Account counts match expectations
- ✅ Rent amounts are reasonable
- ✅ No suspicious patterns
- ✅ Estimated fees are acceptable

### 1.6 Dashboard Testing

**While operations run, monitor the dashboard:**

```bash
# Terminal 1: Keep bot running
node dist/cli.js dashboard --config test-config.json

# Terminal 2: Make requests to trigger dashboard updates
node dist/cli.js analyze --config test-config.json
```

**Dashboard should show:**

1. **Metrics Cards** (real-time):
   - Total accounts tracked
   - Total rent locked
   - Total reclaimed (if live)
   - Still idle accounts

2. **Account Status Cards**:
   - Count of reclaimable accounts
   - Count of reclaimed accounts
   - Count of skipped accounts
   - Count of failed accounts

3. **Accounts Tab**:
   - Searchable table of accounts
   - Status color-coded
   - Rent amounts in SOL
   - Analysis reasons

4. **Timeline Tab**:
   - Historical operations
   - Chart of reclaimed SOL over time
   - Trend analysis

### 1.7 Monitoring Integration Test

**Test the monitoring system (Phase 11):**

```bash
# Enable monitoring in config
cat > test-config.json << 'EOF'
{
  ...
  "monitoring": {
    "enabled": true,
    "metricsIntervalMs": 30000,
    "webhooks": {
      "enabled": false
    },
    "alertRules": {
      "enabled": false
    }
  }
}
EOF

# Start bot and check metrics endpoint
curl http://localhost:3000/api/metrics | jq '.'
```

**Expected metrics response:**

```json
{
  "operationsStarted": 1,
  "operationsCompleted": 1,
  "operationsFailed": 0,
  "reclaimsAttempted": 1,
  "reclaimsSuccessful": 0,
  "accountsAnalyzed": 1,
  "errorsEncountered": 0,
  "averageProcessingTimeMs": 234,
  "successRate": 100,
  "lastSnapshot": "2026-01-19T07:53:40Z"
}
```

---

## Part 2: Real-Time Operations

### 2.1 System Architecture

**Real-time data flow:**

```
┌─────────────────────────────────────┐
│    Solana Blockchain (RPC)          │
│  • Account data                     │
│  • Transaction status               │
│  • Slot information                 │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│    Core Bot (Phases 1-8)            │
│  • Indexer (reads accounts)         │
│  • Analyzer (validates safety)      │
│  • Reclaim Engine (executes txs)    │
│  • Reporter (logs actions)          │
└──────────────┬──────────────────────┘
               │
     ┌─────────┴─────────┬────────────┐
     │                   │            │
┌────▼──────┐  ┌────────▼────┐  ┌────▼──────────┐
│ Dashboard │  │ Telegram    │  │ Monitoring   │
│ (Phase 9) │  │ Alerts      │  │ (Phase 11)   │
│ http://   │  │ (Phase 10)  │  │ • Metrics    │
│ localhost │  │ Real-time   │  │ • Webhooks   │
│ :3000     │  │ notifications   │ • Rules      │
└────┬──────┘  └────────┬────┘  └────┬──────────┘
     │                  │            │
     └──────────────────┼────────────┘
                        │
                   ┌────▼────────┐
                   │ Audit Log   │
                   │ audit-log   │
                   │ .json       │
                   └─────────────┘
```

### 2.2 Real-Time Dashboard Updates

**The dashboard updates every 10 seconds by default:**

```typescript
// From dashboard.js
setInterval(updateMetrics, 10000); // Refresh every 10 seconds

async function updateMetrics() {
  const response = await fetch('/api/metrics');
  const data = await response.json();
  
  // Update DOM elements with live data
  document.getElementById('totalAccounts').textContent = data.total;
  document.getElementById('totalReclaimed').textContent = data.reclaimed;
  // ... more updates
}
```

**What updates in real-time:**

| Component | Update Frequency | Source |
|-----------|-----------------|--------|
| Metric Cards | Every 10 seconds | `/api/metrics` endpoint |
| Accounts Table | Every 10 seconds | `/api/accounts` endpoint |
| Timeline Chart | Every 10 seconds | `/api/timeline` endpoint |
| Warning Alerts | Every 10 seconds | `/api/warnings` endpoint |
| Audit Log | Real-time | File watcher on `audit-log.json` |

### 2.3 Live Operation Flow

**Step-by-step what happens when you run reclaim:**

```
1. USER COMMAND
   $ node dist/cli.js reclaim --config config.json

2. INITIALIZATION
   ├─ Load config
   ├─ Connect to RPC endpoint
   ├─ Load keypair
   └─ Verify treasury address

3. LOAD DATA
   ├─ Read indexed accounts
   ├─ Check current blockchain state
   └─ Filter by criteria

4. ANALYSIS & SAFETY CHECK
   ├─ For each account:
   │  ├─ Check token balance
   │  ├─ Check recent transactions
   │  ├─ Verify it's empty/safe
   │  ├─ Calculate rent to recover
   │  └─ Emit analysis event ──┐
   └─ Log results              │
                                │
5. REAL-TIME MONITORING ◄──────┘
   ├─ MetricsCollector receives event
   ├─ Updates operation metrics
   ├─ Emits to dashboard
   └─ Sends to webhooks (if configured)

6. ALERT RULES EVALUATION
   ├─ Check if any alert rules triggered
   ├─ Send Telegram notifications
   ├─ Broadcast via webhooks
   └─ Log alert

7. TRANSACTION PREPARATION
   ├─ Build close instruction
   ├─ Add rent recovery to treasury
   ├─ Calculate fees
   └─ Estimate SOL recovery

8. DRY-RUN MODE (if enabled)
   ├─ Show what would happen
   ├─ Print estimated recovery
   ├─ DON'T submit to blockchain
   └─ Exit

9. LIVE EXECUTION (if dryRun: false)
   ├─ Submit transaction to RPC
   ├─ Poll for confirmation
   ├─ Retry if needed
   └─ Emit reclaim_success event ──┐
                                    │
10. REAL-TIME UPDATES ◄────────────┘
    ├─ Dashboard metrics updated
    ├─ Audit log written
    ├─ Telegram alert sent
    └─ Webhook broadcast

11. LOGGING & REPORTING
    ├─ Write to audit-log.json
    ├─ Write to debug logs
    ├─ Update metrics
    └─ Return results to CLI

12. USER SEES
    ├─ Success/failure message
    ├─ SOL recovered
    ├─ Transaction signature
    └─ Total operations completed
```

### 2.4 Real-Time Monitoring Events

**The system emits 9 types of real-time events:**

```typescript
// From metricsCollector.ts
enum MetricsEventType {
  OPERATION_STARTED = 'operation_started',
  OPERATION_COMPLETED = 'operation_completed',
  OPERATION_FAILED = 'operation_failed',
  RECLAIM_ATTEMPTED = 'reclaim_attempted',
  RECLAIM_SUCCESSFUL = 'reclaim_successful',
  RECLAIM_FAILED = 'reclaim_failed',
  ACCOUNT_ANALYZED = 'account_analyzed',
  ERROR_OCCURRED = 'error_occurred',
  METRICS_SNAPSHOT = 'metrics_snapshot'
}
```

**Each event carries real-time data:**

```json
// Example: operation_started
{
  "type": "operation_started",
  "operationType": "analyze",
  "timestamp": 1705689840000,
  "operationId": "op_123abc",
  "itemsProcessed": 0
}

// Example: reclaim_successful
{
  "type": "reclaim_successful",
  "accountAddress": "2v6A93rjxfqsH7kCTKxmJXd9v3TxzNHqZVHJqWwE1Q2",
  "reclaimedLamports": 885880,
  "transactionSignature": "5DZ7x...",
  "timestamp": 1705689845000,
  "feePaid": 5000
}
```

### 2.5 Dashboard API Endpoints

**Real-time data comes from these HTTP endpoints:**

```bash
# Get current metrics snapshot
curl http://localhost:3000/api/metrics

# Get all tracked accounts
curl http://localhost:3000/api/accounts

# Get timeline data (historical)
curl http://localhost:3000/api/timeline

# Get current warnings
curl http://localhost:3000/api/warnings

# Get audit log summary
curl http://localhost:3000/api/audit-log
```

**Example metrics response:**

```json
{
  "operationsStarted": 5,
  "operationsCompleted": 4,
  "operationsFailed": 1,
  "reclaimsAttempted": 15,
  "reclaimsSuccessful": 12,
  "reclaimsFailed": 3,
  "accountsAnalyzed": 50,
  "totalReclaimedSol": 0.045,
  "totalFeePaidSol": 0.000025,
  "averageProcessingTimeMs": 234,
  "successRate": 80,
  "lastSnapshot": "2026-01-19T08:00:00Z",
  "uptime": 3600000
}
```

### 2.6 Real-Time Alerts

**Telegram alerts fire automatically in real-time:**

```
Alert Type                  When Triggered              Format
─────────────────────────────────────────────────────────────────
Operation Started           Each operation begins       📊 Analyzing 100 accounts...
Analysis Complete           Analysis finishes           ✅ 85 accounts reclaimable
Reclaim Success             Account closed              ✅ Reclaimed 0.0009 SOL
Reclaim Failure             Transaction fails           ❌ Failed: insufficient balance
High Failure Rate           >20% failures              ⚠️  CRITICAL: 30% failure rate
Error Alert                 Unexpected error           🚨 RPC connection lost
Daily Summary               Scheduled time             📈 Daily: 50 SOL reclaimed
```

**Messages arrive in real-time with:**
- ✅ Immediate notification
- ✅ Transaction signature (if applicable)
- ✅ Metrics snapshot
- ✅ Suggested action

---

## Part 3: Validation & Safety

### 3.1 Multi-Layer Validation

**Every reclaim passes through 5 validation layers:**

```
Layer 1: Account Ownership
├─ Verify account belongs to System Program
└─ Reject if program-derived address (PDA)

Layer 2: Token Balance
├─ Check for SPL token holdings
├─ Check for NFT holdings
└─ Reject if any tokens present

Layer 3: Recent Activity
├─ Check transaction history (last 1000 slots)
├─ Check for recent SOL transfers
└─ Reject if activity in last N slots

Layer 4: Data Validity
├─ Verify account size reasonable
├─ Check executable flag false
├─ Verify not a program account
└─ Validate state consistency

Layer 5: Rent Calculation
├─ Verify rent amount > 0
├─ Check rent >= minimum threshold
├─ Validate rent math
└─ Estimate network fees
```

### 3.2 Safety Features

**Built-in protections:**

```typescript
// From analyzer.ts
isSafeToReclaim(account): boolean {
  // Never close PDAs
  if (this.isPDA(account)) return false;
  
  // Never close if has tokens
  if (account.hasTokens) return false;
  
  // Never close if recent activity
  if (this.hasRecentActivity(account)) return false;
  
  // Never close unknown programs
  if (this.isUnknownProgram(account)) return false;
  
  // Safe!
  return true;
}
```

### 3.3 Dry-Run Mode

**Always test before live execution:**

```bash
# DRY-RUN (safe, no transactions submitted)
node dist/cli.js reclaim --config config.json
# (with "dryRun": true in config.json)

Output:
────────────────────────────────────────
Dry-run Mode: No transactions submitted
────────────────────────────────────────
Total accounts reclaimable: 85
Total SOL to recover: 75.82345
Estimated fees: 0.000425
Net recovery: 75.823025 SOL
────────────────────────────────────────

# LIVE (submits real transactions)
# 1. Change config: "dryRun": false
# 2. Run command again (CAREFULLY!)
node dist/cli.js reclaim --config config.json
```

---

## Part 4: Testing Scenarios

### Scenario 1: Development Testing (RECOMMENDED FIRST)

```bash
# Use devnet with small test dataset

# 1. Setup
node dist/cli.js init --output config-dev.json

# 2. Edit config-dev.json:
# - "rpcUrl": "https://api.devnet.solana.com"
# - "dryRun": true

# 3. Create test data
cat > test-accounts.json << 'EOF'
[{"publicKey": "....", "rentLamportsAtCreation": 890880}]
EOF

# 4. Run analysis
node dist/cli.js analyze --config config-dev.json

# 5. Review dry-run output
node dist/cli.js reclaim --config config-dev.json

# 6. Monitor dashboard
curl http://localhost:3000/api/metrics | jq '.'
```

### Scenario 2: Staging Testing (BEFORE MAINNET)

```bash
# Use testnet with production config

# 1. Setup testnet config
node dist/cli.js init --output config-testnet.json

# 2. Edit config-testnet.json:
# - "rpcUrl": "https://api.testnet.solana.com"
# - "cluster": "testnet"
# - "dryRun": true (initially)

# 3. Import production account list
node dist/cli.js index --import production-accounts.json --config config-testnet.json

# 4. Test analysis at scale
time node dist/cli.js analyze --config config-testnet.json

# 5. Dry-run with real numbers
node dist/cli.js reclaim --config config-testnet.json

# 6. If confident, enable live mode
# - Change "dryRun": false
# - Verify keypair is test keypair
# - Run reclaim

# 7. Validate transactions
node dist/cli.js report --config config-testnet.json
```

### Scenario 3: Production Testing (FINAL)

```bash
# 1. Use mainnet config with safety limits
node dist/cli.js init --output config-prod.json

# 2. Edit config-prod.json:
# - "rpcUrl": "https://api.mainnet-beta.solana.com"
# - "cluster": "mainnet-beta"
# - "dryRun": true
# - "logLevel": "info"
# - Add Telegram alerts
# - Add monitoring webhooks

# 3. Run with monitoring
node dist/cli.js dashboard --config config-prod.json &
node dist/cli.js reclaim --config config-prod.json

# 4. Watch dashboard while running
# - Monitor metrics
# - Watch for errors
# - Check audit log

# 5. Only after successful dry-run:
# - Change "dryRun": false
# - RUN AGAIN (live execution)
# - Monitor closely
```

---

## Part 5: Real-Time Monitoring in Action

### 5.1 Live Scenario: 1000 Account Batch

**Watch the system in real-time:**

```
TIME: 08:00:00 ─────────────────────────────────────
User starts: node dist/cli.js reclaim --config config.json

Dashboard BEFORE:
├─ Total Accounts: 1000
├─ Total Rent Locked: 890.23 SOL
├─ Total Reclaimed: 0 SOL
└─ Still Idle: 1000

TIME: 08:00:10 ─────────────────────────────────────
Operation started - analyzing accounts...

Metrics update (real-time):
├─ operationsStarted: 1
├─ accountsAnalyzed: 0 → 250
└─ Dashboard refreshes

TIME: 08:00:20 ─────────────────────────────────────
Analysis 25% complete

Telegram alert:
📊 Analyzing 1000 accounts...
Progress: 250/1000 (25%)

TIME: 08:00:30 ─────────────────────────────────────
Analysis 50% complete

Dashboard updates:
├─ Reclaimable: 850
├─ Cannot Reclaim: 150
└─ Average processing time: 234ms

TIME: 08:00:40 ─────────────────────────────────────
Analysis complete!

Telegram alert:
✅ Analysis complete!
Reclaimable: 850 accounts
Rent value: 758.23 SOL

Dashboard shows:
├─ Status cards updated
├─ Accounts tab populated
├─ Timeline chart shows spike

TIME: 08:00:45 ─────────────────────────────────────
Starting reclaim phase (dry-run)...

Each successful reclaim sends metrics:
├─ reclaimsSuccessful++
├─ totalReclaimedSol += amount
├─ Dashboard updates in real-time

TIME: 08:01:00 ─────────────────────────────────────
Reclaim 100 complete (11.76% of 850)

Dashboard live updates:
├─ Reclaimed cards: 100
├─ Total SOL: 89.02 SOL
├─ Success rate: 100%

TIME: 08:05:00 ─────────────────────────────────────
All 850 reclaims processed

Final Telegram alert:
✅ Dry-run complete!
Total potential recovery: 758.23 SOL
Estimated fees: 0.04 SOL
Net recovery: 758.19 SOL

Dashboard final state:
├─ Reclaimable: 850 → Done
├─ Reclaimed: 850
├─ Total SOL: 758.19
└─ Success rate: 100%

Audit log entry:
{
  "timestamp": "2026-01-19T08:05:00Z",
  "action": "reclaim_batch",
  "accountsProcessed": 850,
  "successCount": 850,
  "totalReclaimedSol": 758.19,
  "totalFeeSol": 0.04,
  "dryRun": true,
  "status": "COMPLETED"
}
```

### 5.2 Monitoring Metrics in Real-Time

**Check metrics while operation runs:**

```bash
# Terminal 1: Run operation
node dist/cli.js reclaim --config config.json

# Terminal 2: Watch metrics update
watch -n 1 'curl -s http://localhost:3000/api/metrics | jq "."'
```

**Output changes every second:**

```
Every 1.0s: curl -s http://localhost:3000/api/metrics | jq "."

{
  "operationsStarted": 1,
  "operationsCompleted": 0,
  "operationsFailed": 0,
  "reclaimsAttempted": 0,
  "reclaimsSuccessful": 0,
  "reclaimsFailed": 0,
  "accountsAnalyzed": 234,        ← Incrementing!
  "totalReclaimedSol": 0,
  "totalFeePaidSol": 0,
  "averageProcessingTimeMs": 234,
  "successRate": 100,
  "lastSnapshot": "2026-01-19T08:00:10Z",
  "uptime": 10000
}

---

{
  "operationsStarted": 1,
  "operationsCompleted": 0,
  "operationsFailed": 0,
  "reclaimsAttempted": 0,
  "reclaimsSuccessful": 0,
  "reclaimsFailed": 0,
  "accountsAnalyzed": 500,        ← Updated!
  "totalReclaimedSol": 0,
  "totalFeePaidSol": 0,
  "averageProcessingTimeMs": 232,
  "successRate": 100,
  "lastSnapshot": "2026-01-19T08:00:11Z",
  "uptime": 11000
}
```

---

## Part 6: Troubleshooting Real-Time Issues

### Issue: Dashboard not updating

```bash
# 1. Verify dashboard is running
lsof -i :3000

# 2. Check if bot is running
ps aux | grep "node dist/cli.js"

# 3. Check dashboard logs
tail -f logs/bot.log | grep dashboard

# 4. Manually test endpoint
curl http://localhost:3000/api/metrics

# 5. Check for errors
tail -f logs/error.log
```

### Issue: Metrics show old data

```bash
# 1. Restart dashboard
# Terminal 1:
pkill -f "dist/cli.js dashboard"

# Wait 2 seconds
sleep 2

# Terminal 2:
node dist/cli.js dashboard --config config.json

# 2. Clear browser cache
# Ctrl+Shift+Delete in browser
```

### Issue: Real-time alerts not sending

```bash
# 1. Check Telegram config
cat config.json | jq '.telegram'

# 2. Verify bot token format
# Token should be: 123456789:ABCDEFGhijklmno-PQRSTUVWXYZ

# 3. Test alert endpoint
curl -X POST http://localhost:3000/api/test-alert

# 4. Check Telegram logs
tail -f logs/bot.log | grep telegram
```

### Issue: High CPU usage during operations

```bash
# 1. Check what's running
ps aux | grep node | grep -v grep

# 2. Monitor resource usage
top -p $(pgrep -f "node dist/cli.js")

# 3. Reduce batch size
# Edit config.json, add:
# "batchSize": 100  (instead of 1000)

# 4. Increase interval between operations
# "metricsIntervalMs": 60000  (instead of 30000)
```

---

## Part 7: Best Practices

### Testing Best Practices

✅ **DO:**
- Always test on devnet first
- Use small datasets initially (5-10 accounts)
- Run multiple dry-runs before going live
- Monitor dashboard during operations
- Keep audit logs for review
- Enable debug logging in test environment
- Test after any configuration changes

❌ **DON'T:**
- Skip dry-run testing
- Run live operations without review
- Use production keypair in test environment
- Ignore error messages
- Change configuration mid-operation
- Delete audit logs
- Run multiple instances with same treasury

### Real-Time Operations Best Practices

✅ **DO:**
- Monitor dashboard while operations run
- Watch Telegram alerts in real-time
- Review audit logs after each batch
- Scale up gradually (10 → 100 → 1000)
- Set up email notifications for errors
- Keep detailed records
- Test disaster recovery procedures

❌ **DON'T:**
- Start large batches without monitoring
- Ignore warnings or alerts
- Assume transactions succeeded without checking
- Run operations during sleep
- Skip validation checks
- Use high-risk configurations
- Operate without backups

---

## Part 4: Production Readiness Checklist

Before deploying to mainnet, verify ALL of these:

### Pre-Deployment Checklist

- [ ] **Keypair Security**
  - [ ] Production keypair stored in secure vault (not in git)
  - [ ] Test keypair removed from production environment
  - [ ] Keypair permissions restricted (chmod 400)
  - [ ] Backup of keypair stored securely offline

- [ ] **RPC Endpoint**
  - [ ] Using private RPC endpoint (not public API)
  - [ ] Rate limiting configured appropriately
  - [ ] RPC endpoint verified with test transaction
  - [ ] Backup RPC endpoints configured for failover

- [ ] **Configuration**
  - [ ] Mainnet cluster setting verified
  - [ ] Treasury address verified (test 3 times!)
  - [ ] Min inactivity slots appropriate for mainnet (≥500k slots)
  - [ ] Dry-run mode disabled ONLY for live operations
  - [ ] Logging level set to "info" or "warn" (not "debug")

- [ ] **Safety Checks**
  - [ ] Ran 3x dry-run on devnet with test data
  - [ ] Ran 3x dry-run on testnet with real-like data
  - [ ] Verified safety engine blocks PDAs
  - [ ] Verified safety engine blocks program-owned accounts
  - [ ] Tested failure scenarios (RPC down, insufficient SOL, etc.)

- [ ] **Monitoring & Alerting**
  - [ ] Telegram alerts configured for production
  - [ ] Webhook endpoints validated
  - [ ] Alert rules tested and verified
  - [ ] Log aggregation configured (CloudWatch, Datadog, etc.)
  - [ ] Dashboard accessible via VPN only
  - [ ] Metrics collection enabled

- [ ] **Operations**
  - [ ] Runbook created for common issues
  - [ ] On-call rotation established
  - [ ] Incident response procedures documented
  - [ ] Backup and recovery procedures tested
  - [ ] Daily monitoring routine established
  - [ ] Weekly review process scheduled

- [ ] **Documentation**
  - [ ] Deployment procedure documented
  - [ ] Emergency shutdown procedure documented
  - [ ] Recovery procedures tested
  - [ ] Team trained on monitoring dashboard
  - [ ] Change log maintained

### Production Deployment Options

#### Option 1: Systemd Service (Recommended for Linux)

Create `/etc/systemd/system/kora-bot.service`:
```ini
[Unit]
Description=Kora Rent Reclaim Bot
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=solana
WorkingDirectory=/opt/kora-bot
ExecStart=/usr/bin/node dist/cli.js reclaim --config /etc/kora-bot/config.json
Restart=on-failure
RestartSec=30
StandardOutput=journal
StandardError=journal
SyslogIdentifier=kora-bot
Environment="NODE_ENV=production"

[Install]
WantedBy=multi-user.target
```

Then start:
```bash
sudo systemctl enable kora-bot
sudo systemctl start kora-bot
sudo journalctl -u kora-bot -f  # Monitor
```

#### Option 2: Docker (Recommended for Cloud)

Create `Dockerfile`:
```dockerfile
FROM node:18-alpine
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy compiled code
COPY dist/ ./dist/

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Mount volumes for config and data
VOLUME ["/config", "/data", "/logs"]

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/metrics', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

USER nodejs
EXPOSE 3000
CMD ["node", "dist/cli.js", "reclaim", "--config", "/config/config.json"]
```

Run:
```bash
docker run -d \
  --name kora-reclaim \
  --restart=always \
  -v /secure/config:/config:ro \
  -v /var/kora/data:/data \
  -v /var/kora/logs:/logs \
  -p 3000:3000 \
  kora-reclaim:latest
```

#### Option 3: Kubernetes (Recommended for Enterprise)

Create `deployment.yaml`:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kora-reclaim-bot
  namespace: solana
spec:
  replicas: 1
  selector:
    matchLabels:
      app: kora-reclaim-bot
  template:
    metadata:
      labels:
        app: kora-reclaim-bot
    spec:
      serviceAccountName: kora-bot
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
      containers:
      - name: bot
        image: kora-reclaim:latest
        imagePullPolicy: Always
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        env:
        - name: NODE_ENV
          value: "production"
        volumeMounts:
        - name: config
          mountPath: /config
          readOnly: true
        - name: data
          mountPath: /data
        - name: logs
          mountPath: /logs
        livenessProbe:
          httpGet:
            path: /api/metrics
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 60
        readinessProbe:
          httpGet:
            path: /api/metrics
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 30
      volumes:
      - name: config
        secret:
          secretName: kora-bot-config
      - name: data
        persistentVolumeClaim:
          claimName: kora-bot-data
      - name: logs
        persistentVolumeClaim:
          claimName: kora-bot-logs
```

Deploy:
```bash
kubectl apply -f deployment.yaml
kubectl logs -f deployment/kora-reclaim-bot -n solana
```

### Production Monitoring Setup

Monitor these metrics in real-time:

```bash
# Success rate (should be >90%)
curl http://localhost:3000/api/metrics | jq '.successRate'

# Recent errors
curl http://localhost:3000/api/metrics | jq '.recentErrors[-5:]'

# Rent reclaimed today
curl http://localhost:3000/api/metrics | jq '.totalRentReclaimed'

# RPC errors (should be low)
curl http://localhost:3000/api/metrics | jq '.rpcErrors'

# Last operation time (should be recent)
curl http://localhost:3000/api/metrics | jq '.lastOperationTime'
```

### Daily Operational Tasks

**Every Day:**
- Check dashboard: http://localhost:3000
- Review metrics: Success rate, recent errors
- Check logs: `tail -100 logs/bot.log | grep ERROR`
- Verify treasury balance: `solana balance <treasury> --keypair <keypair>`

**Every Week:**
- Review audit log: `wc -l data/audit-log.json`
- Check idle accounts trending up/down
- Verify backups are working
- Test alert system (send test alert)

**Every Month:**
- Review all transactions for anomalies
- Rotate keypair (create new keypair, test, migrate)
- Update documentation with lessons learned
- Test recovery procedures

### Operational Runbooks

**Bot is down:**
```bash
# 1. Check systemd/docker status
systemctl status kora-bot
# or docker ps | grep kora

# 2. Check logs for errors
journalctl -u kora-bot -n 50
# or docker logs kora-reclaim -n 50

# 3. Restart if needed
systemctl restart kora-bot
# or docker restart kora-reclaim

# 4. Alert operations team if still down
```

**High error rate (>10%):**
```bash
# 1. Check RPC endpoint
curl -X POST https://api.mainnet-beta.solana.com \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'

# 2. Check recent transactions
tail -50 logs/bot.log | grep ERROR

# 3. Temporarily disable live reclaims (keep dry-run)
# Edit config: "dryRun": true, then restart

# 4. Investigate and fix root cause
```

**Transactions failing:**
```bash
# 1. Check SOL balance in treasury
solana balance <treasury> --keypair <keypair>

# 2. Check RPC rate limits (reduce concurrency)
# 3. Check for spam/network congestion
# 4. Review recent transactions for patterns
```

---

## Quick Start: Test → Real-Time

### 5-Minute Test Cycle

```bash
# 1. Build (1 min)
npm run build

# 2. Create config (1 min)
node dist/cli.js init --output config.json
# Edit: set dryRun: true

# 3. Analyze (1 min)
node dist/cli.js analyze --config config.json

# 4. Dry-run reclaim (1 min)
node dist/cli.js reclaim --config config.json

# 5. Review results (1 min)
cat data/audit-log.json | jq '.[-1]'

Success? Proceed to real-time operations.
```

### Real-Time Monitoring Cycle

```bash
# Terminal 1: Run operation
node dist/cli.js reclaim --config config.json

# Terminal 2: Watch metrics
watch -n 1 'curl -s http://localhost:3000/api/metrics | jq'

# Terminal 3: Monitor dashboard
# Open browser: http://localhost:3000

# Terminal 4: Watch logs
tail -f logs/bot.log
```

---

## Summary

| Phase | Purpose | Status | Safety Level |
|-------|---------|--------|--------------|
| Unit Testing | Verify components | Before deploy | ✅ High |
| Config Testing | Validate settings | Before operation | ✅ High |
| Indexing Test | Test data import | Before analysis | ✅ Medium |
| Analysis Test | Verify safety checks | Before reclaim | ✅ High |
| Dry-Run Test | Simulate reclaim | Before live | ✅ Maximum |
| Dashboard Test | Real-time monitoring | During operation | ✅ Information only |
| Live Operation | Execute reclaims | After all tests | ⚠️ With safeguards |

**You are now ready to:**
1. ✅ Test the system end-to-end
2. ✅ Monitor operations in real-time
3. ✅ Scale from test to production
4. ✅ Troubleshoot issues as they arise

