# Kora Rent Reclaim Bot

**Status**: ✅ Production Ready | **Build**: 0 Errors | **Version**: 1.0.0

**An automated, production-grade bot for reclaiming rent-locked SOL from sponsored accounts created via Kora operators.**

## 📖 Quick Links

- **New here?** → [GETTING_STARTED.md](./GETTING_STARTED.md) (5-minute setup)
- **Dashboard guide** → [docs/DASHBOARD_GUIDE.md](./docs/DASHBOARD_GUIDE.md) (monitoring web UI)
- **Deploying to production?** → [PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md)
- **All documentation** → [DOCUMENTATION.md](./DOCUMENTATION.md)
- **Testing procedures** → [TESTING_AND_REALTIME_OPS.md](./TESTING_AND_REALTIME_OPS.md)

## Overview

Solana accounts need a minimum lamport balance to stay rent-exempt. When Kora operators sponsor account creation for users, those lamports get locked indefinitely—unless we close the account.

Here's what this bot does:
1. **Finds** accounts created via Kora sponsorship
2. **Checks** their on-chain state
3. **Validates** they're safe to reclaim
4. **Reclaims** rent through transactions
5. **Logs** everything for transparency

## Why This Matters

Operators can end up with thousands of sponsored accounts on devnet or mainnet. Each one locks up SOL. A bot that finds and reclaims this rent? That's a big win for capital efficiency.

**Example:**
- 1,000 sponsored accounts at 890,880 lamports each = **~0.89 SOL per account**
- Total locked: **~890 SOL**
- Reclaimed: **~890 SOL** (if all accounts are inactive and eligible)

## How It Works

### Architecture

```
User Input (config.json)
        ↓
    CLI Interface
        ↓
   Indexer     ←→ Indexer State (JSON)
    (tracks accounts)
        ↓
   Analyzer
   (fetches on-chain state)
        ↓
   Safety Engine
   (performs checks)
        ↓
  Reclaim Executor
  (submits transactions)
        ↓
  Reporter
  (generates audit log)
```

### Key Concepts

#### 1. Rent Exemption
Accounts on Solana need a minimum balance to avoid paying rent each year. Here's the deal:
- Rent gets collected annually (harsh, but that's Solana)
- How much you need depends on the account data size
- Most accounts? Around 890,880 lamports to be safe

#### 2. Sponsored Accounts
Kora operators create accounts for users on their behalf:
- They call `SystemProgram.createAccount`
- The operator pays the rent-exempt balance upfront
- If that account never gets used? That SOL's stuck forever

#### 3. Reclaim Conditions
We only reclaim from accounts that meet all of these:
- **Empty** — no data in them
- **Inactive** — haven't been touched in N slots
- **Safe** — not PDAs, not weird program accounts
- **Worth it** — enough SOL to cover the transaction fee

#### 4. Safety Guarantees
We built in multiple safety checks. The bot will:
- **Never** close PDAs (Program Derived Addresses)
- **Never** touch unknown program accounts
- **Never** mess with token accounts
- **Never** touch recently-used accounts
- Log every decision (fully auditable)
- Start in dry-run mode by default (fail-safe)

## Installation

### Prerequisites
You'll need:
- Node.js 16 or higher
- npm or yarn
- A Solana keypair (JSON format) — keep this secure in production
- Some devnet SOL for testing (grab it from faucet.solana.com)

**For Production:**
- Private RPC endpoint (not public API)
- Hardware wallet or KMS for keypair storage
- Monitoring and alerting infrastructure
- Secure backup procedures
- Load balancing (if running at scale)

### Setup

```bash
# Clone and install
git clone https://github.com/your-org/kora-rent-reclaim-bot
cd kora-rent-reclaim-bot
npm install

# Build TypeScript
npm run build

# Create example config
npm start -- init --output config.json

# Edit config.json with your settings
```

## Configuration

Create a `config.json` file:

```json
{
  "rpcUrl": "https://api.devnet.solana.com",
  "cluster": "devnet",
  "keypairPath": "./keypair.json",
  "treasuryAddress": "YOUR_TREASURY_ADDRESS",
  "indexPath": "./data/indexed-accounts.json",
  "auditLogPath": "./data/audit-log.json",
  "minInactivitySlots": 100000,
  "maxRetries": 3,
  "retryDelayMs": 1000,
  "allowedPrograms": [],
  "dryRun": true,
  "logLevel": "info",
  "telegram": {
    "enabled": false,
    "botToken": "YOUR_TELEGRAM_BOT_TOKEN",
    "chatId": "YOUR_TELEGRAM_CHAT_ID",
    "alerts": {
      "reclaimThreshold": 0.1,
      "idleThreshold": 0.5,
      "dailySummary": false
    }
  },
  "dashboard": {
    "enabled": false,
    "port": 3000,
    "host": "localhost"
  }
}
```

### Configuration Files Reference

Three config examples are provided:

1. **config.dev.json** — Local development (devnet, dry-run, debug)
2. **config.prod.example.json** — Production template (mainnet, uses env vars)
3. **config-telegram-example.json** — Telegram testing example

**Quick start:**
```bash
# Development
cp config.dev.json config.json

# Production (edit with your environment variables first)
cp config.prod.example.json config.json
```

### Configuration Fields

| Field | Type | Description |
|-------|------|-------------|
| `rpcUrl` | string | **Production**: Use private endpoint (Helius, Triton, Alchemy). **Dev**: Use public endpoint |
| `cluster` | string | Network: `devnet`, `testnet-beta`, or `mainnet-beta`. Start with devnet, test on testnet, then mainnet |
| `keypairPath` | string | Path to operator keypair (JSON). **Production**: Store in secure vault (AWS Secrets, Vault, HSM). Never commit to git |
| `treasuryAddress` | string | Where reclaimed SOL is sent. **Production**: Verify address 5+ times before going live |
| `indexPath` | string | Local file tracking sponsored accounts. Back up daily in production |
| `auditLogPath` | string | Audit log of all actions. **Production**: Ship logs to external storage (S3, CloudWatch, etc.) |
| `minInactivitySlots` | number | Slots before account eligible (~46 hours on devnet, ~2 days on mainnet). Tune based on your tolerance |
| `dryRun` | boolean | **ALWAYS true on first runs**. Only set false after reviewing dry-run output 3+ times |
| `telegram.enabled` | boolean | Enable Telegram alerts. Recommended for production monitoring |
| `telegram.botToken` | string | Telegram bot token from BotFather. Store in secure vault, not in git |
| `telegram.chatId` | string | Your Telegram chat ID. Multiple chat IDs can receive alerts |
| `telegram.alerts.reclaimThreshold` | number | Only alert on reclaims >= this SOL. Prevents alert fatigue |
| `telegram.alerts.idleThreshold` | number | Only alert on idle >= this SOL. Reduce noise on testnet |
| `dashboard.enabled` | boolean | Enable operator dashboard. **Production**: Restrict access to trusted IPs only |
| `dashboard.port` | number | Dashboard port (default: 3000). **Production**: Use reverse proxy (nginx) and TLS |
| `dashboard.host` | string | Dashboard host (default: localhost). **Production**: Use 0.0.0.0 only behind firewall |

### Using Environment Variables (Production)

Never hardcode secrets. Create `.env` file:

```bash
export SOLANA_RPC_URL="https://your-private-rpc.example.com"
export KEYPAIR_PATH="/secure/path/to/keypair.json"
export TREASURY_ADDRESS="YOUR_TREASURY_PUBKEY"
export TELEGRAM_BOT_TOKEN="YOUR_BOT_TOKEN"
export TELEGRAM_CHAT_ID="YOUR_CHAT_ID"
export DATA_DIR="/var/lib/bot-data"
```

Then load and run:
```bash
source .env
npm start -- reclaim --config config.prod.json
```

## Usage

### 1. Initialize Configuration

```bash
npm start -- init
```

Generates a sample `config.json`. Edit with your settings.

### 2. Index Sponsored Accounts

First, create a JSON file with accounts you want to track. Format:

```json
[
  {
    "publicKey": "6qNzjnzjDPmqMLhx1wbBWXEyuZ5EpwJnZZpQaZRvkrz",
    "ownerProgram": "11111111111111111111111111111111",
    "rentLamportsAtCreation": 890880,
    "creationSlot": 123456,
    "creationTxSignature": "...",
    "createdAt": 1705689600
  }
]
```

Then import:

```bash
npm start -- index --import accounts.json
```

### 3. Analyze Accounts

Analyze all tracked accounts for reclaimability:

```bash
npm start -- analyze
```

Output shows which accounts pass safety checks.

### 4. Dry-Run Reclaim (MANDATORY FIRST STEP)

Test reclaim logic without submitting transactions:

```bash
npm start -- reclaim --dry-run true
```

**ALWAYS run this first!** Review the output carefully:
- ✅ Account counts match your data
- ✅ Rent amounts are reasonable
- ✅ No suspicious patterns
- ✅ Transaction fees are acceptable

Run dry-run **3 times on devnet** before moving to testnet. Run **3 times on testnet** before going to mainnet.

### 5. Execute Live Reclaim

Once confident after multiple dry-runs:

```bash
npm start -- reclaim --dry-run false
```

⚠️ **PRODUCTION WARNING**: This submits real transactions! Ensure:
- `treasuryAddress` is correct (verify 5+ times)
- Keypair is stored securely (not in code, not in git)
- You have sufficient SOL for transaction fees
- Dashboard monitoring is active
- Telegram alerts are configured
- Someone is watching in real-time

### 6. Check Reports

View audit log summary:

```bash
npm start -- report
```

View indexer statistics:

```bash
npm start -- stats
```

### 7. Monitor Operations (Production Setup)

View real-time dashboard:

```bash
npm start -- dashboard --config config.json
```

Access at `http://localhost:3000` (or your configured host/port).

**Production Dashboard Setup:**
- Restrict access to trusted IPs via firewall
- Use reverse proxy (nginx) with TLS/SSL
- Monitor dashboard server health separately
- Set up automated screenshot captures for alerting systems
- Log all dashboard access (for compliance)
- Back up dashboard data directory

**Log Aggregation (Production):**
- Stream logs to ELK, Datadog, or CloudWatch
- Set up alerts on error rates (>1% failure rate)
- Monitor RPC endpoint health continuously
- Track transaction failures by type
- Create dashboards for:
  - Transaction success rate
  - Average reclaim amount
  - Fees paid per day
  - Error frequency
  - System uptime

### 8. Advanced Scheduling (Automated Recurring Operations)

Automate recurring operations using cron expressions:

```bash
# Analyze accounts every day at 2 AM
npm start -- schedule --cron '0 2 * * *' --operation analyze

# Reclaim every 6 hours
npm start -- schedule --cron '0 */6 * * *' --operation reclaim

# Generate weekly report on Sundays at midnight
npm start -- schedule --cron '0 0 * * 0' --operation report
```

**Features:**
- Cron-based scheduling with automatic retry logic
- Concurrency control and rate limiting
- Telegram notifications on completion/failure
- Full audit trail for compliance

See [SCHEDULER_BATCH_GUIDE.md](./SCHEDULER_BATCH_GUIDE.md) for complete documentation and examples.

### 9. Batch Processing (Optimized High-Volume Operations)

Process large account sets efficiently with parallel batching:

```bash
# Analyze 1000 accounts in batches of 100
npm start -- batch --operation analyze --batch-size 100 --parallelism 4

# Reclaim with custom batch configuration
npm start -- batch --operation reclaim --batch-size 50 --parallelism 8

# Health check accounts in parallel
npm start -- batch --operation check --batch-size 200 --parallelism 6
```

**Features:**
- Configurable batch sizing and parallelism
- Real-time progress tracking with visual progress bar
- Automatic retry logic with exponential backoff
- Detailed performance statistics (throughput, success rate)
- Graceful error handling and recovery

See [SCHEDULER_BATCH_GUIDE.md](./SCHEDULER_BATCH_GUIDE.md) for advanced usage and tuning.

### 10. Telegram Alerting & Bot Commands

Receive real-time alerts on important events and respond to bot commands:

#### Setup
1. Create a Telegram bot via @BotFather
2. Get your chat ID
3. Set environment variables in `.env`:
   ```bash
   TELEGRAM_BOT_TOKEN=your-token
   TELEGRAM_CHAT_ID=your-chat-id
   ```
4. Update `config.json` with placeholders:
   ```json
   {
     "telegram": {
       "enabled": true,
       "botToken": "${TELEGRAM_BOT_TOKEN}",
       "chatId": "${TELEGRAM_CHAT_ID}",
       "alerts": {
         "reclaimThreshold": 0.1,
         "idleThreshold": 0.5
       }
     }
   }
   ```

#### Start Bot as Background Responder (Recommended for Production)
```bash
npm start -- start-bot --config config.json
```
The bot will listen for Telegram commands: `/start`, `/testconnection`, `/status`

#### Test Telegram Connection
```bash
npm start -- test-telegram --config config.json
```

#### Available Telegram Commands
- `/start` — Show welcome message and available commands
- `/testconnection` — Verify bot is connected and operational
- `/status` — Get current bot status

Alerts are automatically sent on:
- ✅ Successful reclaims
- ⏰ Idle rent detection
- ❌ Reclaim failures
- 🛡️ Safety check failures
- 🚨 System errors

See [PHASE_10_ALERTING.md](./docs/PHASE_10_ALERTING.md) for full documentation.

## Safety Model

### Why Fail-Safe?

The bot prioritizes **conservatism** over aggressiveness:
- **Fail closed**: When in doubt, DON'T reclaim
- **Audit everything**: All decisions are logged
- **Manual override**: Operator can review and approve each decision
- **Dry-run first**: Always test before going live

### Safety Checks

The Safety Engine performs these checks on every account:

1. **Account Exists**: Only reclaim from existing accounts
2. **Not a PDA**: PDAs are program-controlled, never close them
3. **Known Program**: Only System program or allowlisted programs
4. **Account Type**: Only System accounts (not tokens, contracts)
5. **No Token Balance**: SPL token accounts require special handling
6. **Empty Data**: No custom data in the account
7. **Sufficient Inactivity**: Account must be inactive for N slots
8. **Rent Exempt**: Account should be rent-exempt
9. **Has Value**: Must have SOL to reclaim

If ANY check fails, the account is not reclaimed.

## Audit Trail

All actions are logged to `audit-log.json`:

```json
[
  {
    "timestamp": "2024-01-20T10:30:00.000Z",
    "unix_timestamp": 1705754400000,
    "action": "INDEXED",
    "account": "6qNzjnzjDPmqMLhx1wbBWXEyuZ5EpwJnZZpQaZRvkrz",
    "details": {
      "owner": "11111111111111111111111111111111",
      "rentLamports": 890880,
      "creationSlot": 123456
    }
  },
  {
    "timestamp": "2024-01-20T10:35:00.000Z",
    "unix_timestamp": 1705754500000,
    "action": "RECLAIM_CONFIRMED",
    "account": "6qNzjnzjDPmqMLhx1wbBWXEyuZ5EpwJnZZpQaZRvkrz",
    "details": {
      "lamports": 890880,
      "sol": 0.89088,
      "txSignature": "5qpXD4jnZzjDPmqMLhx1wbBWXEyuZ5EpwJnZZpQaZRvkrz"
    }
  }
]
```

## Advanced Topics

### Multi-Program Support

By default, the bot only reclaims from System program accounts. To support other programs, add to `allowedPrograms`:

```json
{
  "allowedPrograms": [
    "TokenkegQfeZyiNwAJsyFbPVwwQQfuCS3nWknj3HWetQf"
  ]
}
```

### Custom Inactivity Threshold

Adjust how long an account must be inactive:

```json
{
  "minInactivitySlots": 200000
}
```

On Solana (~400ms per slot):
- 100,000 slots ≈ 46 hours
- 1,000,000 slots ≈ 19 days

### Batch Operations

The CLI processes accounts one-by-one by default. For large-scale operations, consider:
1. Batching analyses in a single pass
2. Filtering before analysis
3. Running multiple bot instances with different account sets

## Troubleshooting

### "Account not found"
The account doesn't exist on-chain. This is expected—the bot skips non-existent accounts.

### "Account has token balance"
The account is an SPL token account with a balance. Close the account first (via user action).

### "Account is a PDA"
Program Derived Address—NEVER close this. It's controlled by its program.

### "Recent activity"
The account was modified recently. Wait until it's older.

### "Transaction failed"
Check:
- Sufficient SOL in operator keypair for fees
- Treasury address is valid
- Network not overloaded

## Development

### Building
```bash
npm run build
```

### Running in Dev Mode
```bash
npm run dev -- analyze
```

### Running Tests
(Tests coming soon)

## Code Quality

- **TypeScript**: Full type safety
- **Comments**: Every function is explained
- **Error Handling**: Graceful failure, never partial reclaims
- **Logging**: Winston-based structured logging
- **Audit Trail**: JSON logs for compliance

## License

MIT - Open source, use freely

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests (if applicable)
4. Submit a pull request

## Support

For issues, questions, or suggestions:
1. Check the [docs](./docs/) folder
2. Review the audit logs
3. Check RPC node health
4. Open an issue on GitHub

## Security

⚠️ **IMPORTANT SECURITY CONSIDERATIONS**

1. **Keypair Security**:
   - Store keypairs securely
   - Use appropriate file permissions (`chmod 600`)
   - Consider hardware wallet integration

2. **RPC Endpoint**:
   - Use a private/trusted RPC endpoint if possible
   - Public endpoints have rate limits
   - Consider running your own validator

3. **Account Safety**:
   - Always test with `--dry-run true` first
   - Verify treasury address before going live
   - Use limited-permission keypairs if possible

4. **Audit Trail**:
   - Keep audit logs backed up
   - Review logs regularly
   - Monitor for unexpected actions

## Roadmap

- [x] Phase 1-8: Core reclaim functionality
- [x] Phase 9: Operator Dashboard (real-time web UI)
- [x] Phase 10: Telegram Alerting (real-time notifications)
- [x] Phase 11: Advanced Monitoring & Metrics (enterprise-grade monitoring)      # Later Implementation
- [ ] Hardware wallet support     # Later Implementation
- [ ] Multi-signature treasury support     # Later Implementation
- [ ] Token account reclaim (with token burning)
- [x] Advanced scheduling/automation
- [ ] GraphQL API integration     # Later Implementation
- [x] Batch processing improvements

## References

- [Solana Rent Model](https://docs.solana.com/developing/programming-model/accounts#rent)
- [Kora Documentation](https://www.getkoralabs.com)
- [@solana/web3.js](https://solana-labs.github.io/solana-web3.js/)
- [SPL Token Program](https://github.com/solana-labs/solana-program-library)

---

**Built with ❤️ for Solana operators**
