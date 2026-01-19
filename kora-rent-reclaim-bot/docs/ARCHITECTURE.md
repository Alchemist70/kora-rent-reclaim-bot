# Architecture Overview

Note: This architecture document is written for SREs and operators. It focuses on the moving parts and what happens when things break.

## Project Structure

```
kora-rent-reclaim-bot/
├── 📄 package.json                     # Dependencies & build scripts
├── 📄 tsconfig.json                    # TypeScript configuration
├── 📄 config.example.json              # Example configuration template
├── 📄 .gitignore                       # Git ignore rules
│
├── 📄 README.md                        # Main project documentation
├── 📄 GETTING_STARTED.md               # 5-minute quick start
├── 📄 IMPLEMENTATION_COMPLETE.md       # Complete project overview
├── 📄 SESSION_SUMMARY_2026_01_19.md    # Session artifacts & changes
├── 📄 FILE_MANIFEST.md                 # This repository manifest
├── 📄 TESTING_AND_REALTIME_OPS.md      # Testing & operations guide
│
├── 📁 src/
│   ├── 📄 cli.ts                       # CLI entry point (7 commands)
│   ├── 📄 config.ts                    # Configuration loader & validator
│   ├── 📄 index.ts                     # Main export file
│   │
│   ├── 📁 utils/
│   │   ├── 📄 types.ts                 # Core type definitions
│   │   ├── 📄 logging.ts               # Winston logger wrapper
│   │   └── 📄 solana.ts                # Solana RPC utilities
│   │
│   ├── 📁 indexer/
│   │   └── 📄 sponsorshipIndexer.ts    # Account tracking & import/export
│   │
│   ├── 📁 analyzer/
│   │   └── 📄 accountAnalyzer.ts       # Account state analysis
│   │
│   ├── 📁 safety/
│   │   └── 📄 safetyEngine.ts          # 9-point safety validation (CRITICAL)
│   │
│   ├── 📁 reclaim/
│   │   └── 📄 reclaimExecutor.ts       # Transaction construction & execution
│   │
│   ├── 📁 reporting/
│   │   └── 📄 reporter.ts              # Reports & audit logging
│   │
│   ├── 📁 dashboard/                   # Phase 9: Web dashboard
│   │   ├── 📄 dashboardServer.ts       # Express.js server & REST APIs
│   │   ├── 📄 index.html               # Dashboard UI
│   │   ├── 📄 style.css                # Dashboard styling
│   │   └── 📄 dashboard.js             # Frontend logic
│   │
│   ├── 📁 alerts/                      # Phase 10: Telegram alerting
│   │   └── 📄 telegramAlertService.ts  # Telegram notifications
│   │
│   └── 📁 monitoring/                  # Phase 11: Enterprise monitoring
│       ├── 📄 metricsCollector.ts      # Real-time metrics (391 lines)
│       ├── 📄 webhookIntegration.ts    # Webhook delivery (320 lines)
│       ├── 📄 alertRulesEngine.ts      # Alert rule evaluation (410 lines)
│       └── 📄 orchestrator.ts          # Monitoring coordinator (322 lines)
│
├── 📁 docs/
│   ├── 📄 PHASE_9_DASHBOARD.md         # Dashboard usage guide
│   ├── 📄 PHASE_10_ALERTING.md         # Telegram alerting setup
│   ├── 📄 PHASE_11_MONITORING.md       # Monitoring & metrics API
│   ├── 📄 QUICKSTART.md                # 10-minute setup guide
│   ├── 📄 DEVNET-TESTING.md            # Devnet testing procedures
│   ├── 📄 ARCHITECTURE.md              # This file
│   ├── 📄 solana-rent-explained.md     # Solana rent concepts
│   ├── 📄 kora-rent-flow.md            # Kora sponsorship workflow
│   └── 📁 PHASE_9_DASHBOARD_ASSETS/    # Dashboard documentation assets
│
├── 📁 data/                            # Runtime data (git-ignored)
│   ├── indexed-accounts.json           # Primary account index
│   └── audit-log.json                  # Append-only audit trail
│
├── 📁 logs/                            # Runtime logs (git-ignored)
│   ├── bot.log                         # Main application log
│   └── error.log                       # Error-specific log
│
├── 📁 dist/                            # Build output (git-ignored)
│   ├── **/*.js                         # Compiled JavaScript
│   └── **/*.d.ts                       # Type definitions
│
├── 📄 config.json                      # Generated runtime config (git-ignored)
├── 📄 keypair.json                     # Solana keypair (git-ignored)
└── 📄 accounts.json                    # Sample accounts file (optional)
```

## Data Flow

Here's how data moves through the bot. Each phase is independent, so if one fails, you can retry it.

### 1. Configuration Phase
```
config.json (user input)
    ↓
loadConfig() in config.ts
    ├─ Validate required fields
    ├─ Verify file paths exist
    ├─ Parse PublicKeys
    └─ Return typed BotConfig
```

### 2. Indexing Phase
```
accounts.json (external source)
    ↓
SponsoredAccountIndexer.importAccountsFromFile()
    ├─ Parse JSON
    ├─ Validate each account
    ├─ Register with indexer
    └─ Persist to indexed-accounts.json
    
indexed-accounts.json (persistent state)
```

### 3. Analysis Phase
```
indexed-accounts.json (state)
    ↓
For each account:
  AccountAnalyzer.analyzeAccount()
    ├─ Fetch on-chain data (RPC)
    ├─ Determine account type
    ├─ Check rent exemption
    ├─ Calculate inactivity
    ├─ Identify risk flags
    └─ Return AccountAnalysis
    
AccountAnalysis[] (in-memory)
```

### 4. Safety Check Phase
```
AccountAnalysis[]
    ↓
For each analysis:
  SafetyEngine.checkAccountSafety()
    ├─ Check 1: PDA detection
    ├─ Check 2: Known program
    ├─ Check 3: Account type
    ├─ Check 4: No token balance
    ├─ Check 5: Empty data
    ├─ Check 6: Inactivity
    ├─ Check 7: Rent exempt
    ├─ Check 8: Has value
    └─ Return SafetyCheckResult
    
SafetyCheckResult[] (in-memory)
```

### 5. Reclaim Phase
```
For approved accounts (dry-run or live):
  ReclaimExecutor.executeReclaim()
    ├─ Build SystemProgram.transfer instruction
    ├─ If live:
    │   ├─ Sign with operator keypair
    │   ├─ Submit via RPC
    │   ├─ Poll for confirmation
    │   └─ Update status
    └─ Return ReclaimAction
    
ReclaimAction[] (in-memory)
```

### 6. Reporting Phase
```
AccountAnalysis[] + ReclaimAction[]
    ↓
Reporter.generateReport()
    ├─ Calculate statistics
    ├─ Summarize reasons
    └─ Create ReclaimReport
    
Report output:
  ├─ Console (human-readable)
  ├─ report.json (machine-readable)
  └─ audit-log.json (append-only audit trail)
```

## Component Responsibilities

### cli.ts
**Purpose**: Command-line interface
- Parse command-line arguments
- Orchestrate workflow
- Handle user I/O
- Call other modules

**Commands**:
- `init`: Generate example config
- `index`: Import accounts
- `analyze`: Check account state
- `reclaim`: Execute reclaims
- `report`: Show audit summary
- `stats`: Show indexer statistics

**Error Handling**: Graceful exit with error messages

---

### config.ts
**Purpose**: Configuration management
- Load JSON config file
- Validate all fields
- Handle defaults
- Type-check values

**Functions**:
- `loadConfig(path)`: Load and validate
- `createExampleConfig(path)`: Generate template

**Safety**: Validation on all inputs, clear error messages

---

### types.ts
**Purpose**: Type definitions (TypeScript)
- Define all data structures
- Ensure type safety
- Document fields
- Enable IDE autocompletion

**Key Types**:
- `BotConfig`: Bot settings
- `SponsoredAccount`: Tracked account
- `AccountAnalysis`: Analysis result
- `ReclaimAction`: Reclaim transaction
- `SafetyCheckResult`: Safety decision

---

### logging.ts
**Purpose**: Structured logging
- Winston-based logger
- Console + file output
- Log rotation
- Consistent format

**Functions**:
- `initializeLogger(level)`: Setup
- `getLogger()`: Get instance
- `logAccountAction()`: Account-specific
- `logReclaimDecision()`: Safety decision
- `logTransactionSubmitted()`: TX tracking
- `logSafetyCheck()`: Check result
- `logError()`: Error logging
- `logDebug/Info/Warn()`: General logging

**Output**: `logs/bot.log`, `logs/error.log`, console

---

### solana.ts
**Purpose**: Solana utilities
- RPC connection management
- Keypair loading
- Account info fetching
- Retry logic
- Helper functions

**Functions**:
- `getSolanaConnection()`: Create connection with retry
- `loadKeypair()`: Load from JSON file
- `getAccountInfoWithRetry()`: Fetch account with retry
- `getMinimumBalanceForRentExemption()`: Calculate rent
- `getCurrentSlot()`: Get current slot
- `getTransactionWithRetry()`: Fetch TX
- `isValidPublicKey()`: Validate address
- `lamportsToSol()`: Format conversion
- `solToLamports()`: Format conversion

**Error Handling**: Exponential backoff, graceful failure

---

### SponsoredAccountIndexer
**Purpose**: Track sponsored accounts
- Persist account list locally
- Validate on import
- Export to files
- Provide statistics

**Key Methods**:
- `registerAccount()`: Add account
- `getTrackedAccounts()`: List all
- `getAccountsByOwner()`: Filter by program
- `updateAccountLastChecked()`: Update timestamp
- `removeAccount()`: Delete (after reclaim)
- `importAccountsFromFile()`: Bulk import
- `exportAccountsToFile()`: Bulk export
- `getStatistics()`: Analytics

**State**: `indexed-accounts.json` (persistent)

---

### AccountAnalyzer
**Purpose**: Analyze account state
- Fetch on-chain data
- Determine account type
- Detect PDAs
- Calculate inactivity
- Identify risks

**Key Methods**:
- `analyzeAccount()`: Single account
- `analyzeMultiple()`: Batch analysis
- `determineAccountState()`: Fetch & parse
- `determineAccountType()`: Classify
- `detectPda()`: PDA detection
- `identifyRisks()`: Flag problems

**Output**: `AccountAnalysis[]` (in-memory)

---

### SafetyEngine (CRITICAL)
**Purpose**: Enforce safety rules
- Perform multi-layer checks
- Generate decisions
- Log reasoning
- Ensure fail-safe behavior

**Key Methods**:
- `checkAccountSafety()`: Full check
- `checkNotPda()`: PDA safety
- `checkKnownProgram()`: Program safety
- `checkAccountType()`: Type safety
- `checkNoTokenBalance()`: Token safety
- `checkEmpty()`: Data safety
- `checkInactivity()`: Activity safety
- `checkRentExempt()`: Rent safety
- `checkHasValue()`: Value check
- `getSafetyReport()`: Human-readable output

**Philosophy**: Fail closed - when in doubt, reject

---

### ReclaimExecutor
**Purpose**: Execute reclaim transactions
- Build reclaim instructions
- Sign transactions
- Submit to RPC
- Confirm and log

**Key Methods**:
- `executeReclaim()`: Single account
- `buildReclaimInstruction()`: Create instruction
- `buildBatchReclaimTransaction()`: Multiple accounts
- `verifyReclaim()`: Confirm TX

**Safety**: 
- Checks keypair loaded
- Verifies treasury address
- Handles dry-run mode
- Logs all actions

---

### Reporter
**Purpose**: Generate reports
- Aggregate statistics
- Format output
- Persist logs
- Create audit trail

**Key Methods**:
- `generateReport()`: Aggregate data
- `formatReport()`: Human-readable
- `saveReport()`: Persist to JSON
- `appendAuditEntry()`: Audit log
- `getAuditLogSummary()`: Summary stats

**Output**: 
- Console text
- `report.json`
- `audit-log.json` (append-only)

---

## Safety Layers (Defense in Depth)

### Layer 1: Input Validation
```
Config → Validate
Accounts → Validate
Keypair → Validate
```

### Layer 2: Type Safety
```
TypeScript ensures compile-time type checking
All inputs/outputs typed
No any types (except where necessary)
```

### Layer 3: On-Chain Verification
```
Fetch account data
Parse safely
Verify expectations
Graceful failure
```

### Layer 4: Safety Checks
```
9-point check system
All checks must pass
Conservative defaults
Log every decision
```

### Layer 5: Transaction Safety
```
Verify before signing
Verify before submitting
Poll for confirmation
Log results
```

### Layer 6: Audit Trail
```
Every action logged
Timestamps
Context details
Permanently recorded
```

---

## Error Handling Strategy

### Principle: Fail Safely

```
When in doubt:
  ✗ Don't reclaim
  ✓ Log the issue
  ✓ Continue with next account
  ✓ Report summary at end
```

### Examples

```typescript
// Fail closed - return empty
if (!this.isProbablyPda(account)) {
  // Safe to proceed
} else {
  // NEVER proceed - reject absolutely
  riskFlags.push(RiskFlag.PDA);
}

// Graceful skipping
if (accountInfo === null) {
  // Account doesn't exist - OK, skip
  return [];
}

// Retry on network errors
for (let attempt = 0; attempt < maxRetries; attempt++) {
  try {
    return await connection.getAccountInfo(address);
  } catch (error) {
    // Retry with backoff
  }
}

// Log but continue
try {
  // Process account
} catch (error) {
  logError("analyzeAccount", error);
  // Return safe default (not reclaimable)
}
```

---

## Data Persistence

### indexed-accounts.json
```json
{
  "sponsoredAccounts": [
    {
      "publicKey": "...",
      "ownerProgram": "...",
      "rentLamportsAtCreation": 890880,
      "creationSlot": 200000,
      "creationTxSignature": "...",
      "createdAt": 1705689600,
      "lastCheckedAt": 1705754400
    }
  ],
  "lastIndexedSlot": 300000,
  "lastIndexedAt": 1705754400,
  "totalIndexed": 1000
}
```

### audit-log.json
```json
[
  {
    "timestamp": "2024-01-20T10:30:00.000Z",
    "unix_timestamp": 1705754400000,
    "action": "INDEXED",
    "account": "6qNzjnzjDPmqMLhx1wbBWXEyuZ5EpwJnZZpQaZRvkrz",
    "details": { ... }
  },
  ...
]
```

### report.json
```json
{
  "timestamp": 1705754400000,
  "totalTracked": 1000,
  "existingAccounts": 800,
  "reclaimableAccounts": 795,
  "totalRentLocked": 890000000,
  "totalReclaimedLamports": 712000000,
  "totalStillLocked": 178000000,
  "actions": [ ... ],
  "isDryRun": false
}
```

---

## Testing Recommendations

### Unit Tests
- Type validation
- Helper functions
- Utility conversions

### Integration Tests
- Config loading
- RPC connection
- Account fetching
- Analysis flow

### Devnet Tests
- Full workflow
- Account creation
- Reclaim execution
- Audit logging

### Safety Tests
- Edge cases
- Error scenarios
- Boundary conditions
- PDA detection

---

## Performance Considerations

### Batch Processing
```
For N accounts:
- Analyze sequentially (RPC calls can't be parallelized safely)
- Collect results in memory
- Process once at end
```

### RPC Rate Limiting
```
Implement:
- Exponential backoff on failures
- Configurable retry delays
- Request queuing if needed
```

### Memory Management
```
- Stream large result sets
- Don't load entire blockchain into memory
- Clear processed data
```

---

## Deployment

### Development

For local testing and development:

```bash
npm run dev -- [command]
```

### Staging (Testnet)

Before going to production, deploy to Solana testnet with the same infrastructure:

```bash
# Build production artifacts
npm run build

# Create staging config (testnet RPC, staging keypair)
cp config.example.json config.staging.json
# Edit config.staging.json to point to testnet

# Deploy with staging configuration
npm start -- reclaim --config config.staging.json --dry-run true
```

### Production Deployment Options

See [GETTING_STARTED.md](../GETTING_STARTED.md#moving-to-production) for complete production setup. Common options:

**Option 1: Systemd Service (Linux/macOS)**
```bash
# Install as systemd service
sudo cp kora-bot.service /etc/systemd/system/
sudo systemctl enable kora-bot
sudo systemctl start kora-bot
```

**Option 2: Docker Container**
```bash
# Build and run
docker build -t solana-bot .
docker run -d \
  --name solana-reclaim \
  -v /config:/app/config \
  -v /data:/app/data \
  -v /logs:/app/logs \
  solana-bot
```

**Option 3: Kubernetes Deployment**
```bash
kubectl apply -f kora-bot-deployment.yaml
kubectl logs -f deployment/solana-reclaim
```

**Option 4: PM2 Process Manager**
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Automation

**Cron-based reclaims (every 6 hours):**
```bash
0 */6 * * * cd /path/to/bot && npm start -- reclaim --config config.json >> cron.log 2>&1
```

**With monitoring/alerting:**
```bash
0 */6 * * * /path/to/bot/run-with-monitoring.sh
```

**Key Production Considerations:**

1. **RPC Endpoint**: Use a private/paid RPC endpoint, never public API
2. **Keypair Storage**: Store in secure vault (AWS Secrets, HashiCorp Vault), never in git
3. **Logging**: Send logs to centralized system (CloudWatch, ELK, Datadog)
4. **Monitoring**: Set up alerts for failures, high costs, or inactivity
5. **Backups**: Daily backup of audit logs and indexed accounts
6. **Runbooks**: Document recovery procedures before production
7. **Testing**: Run through staging first; use dry-run on mainnet initially

---

## Future Enhancements

1. **Scalability**
   - Parallel RPC calls
   - Multi-region deployment
   - Database backend (instead of JSON)

2. **Features**
   - Token account reclaim
   - Multi-signature treasury
   - Webhook notifications
   - Web UI dashboard

3. **Observability**
   - Prometheus metrics
   - Grafana dashboards
   - Structured logging (JSON)

4. **Security**
   - Hardware wallet support
   - Rate limiting
   - IP whitelisting
   - Signature verification

---

**Architecture Philosophy**: Conservative, auditable, and fail-safe. Every decision is recorded and reversible.
