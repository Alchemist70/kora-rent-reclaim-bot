# Kora Rent Reclaim Bot

**An automated, production-grade bot for reclaiming rent-locked SOL from sponsored accounts created via Kora operators.**

## Overview

Solana account creation requires a minimum lamport balance to remain rent-exempt. When Kora operators sponsor account creation for users, those lamports become locked in the account indefinitely—unless the account is closed.

This bot:
1. **Tracks** accounts created via Kora sponsorship
2. **Monitors** their on-chain state
3. **Analyzes** safety and reclaimability
4. **Reclaims** rent via automated transactions
5. **Audits** all actions for transparency

## Why This Matters

On Solana's devnet and mainnet, operators can accumulate thousands of sponsored accounts. Each account locks SOL that would otherwise be available. A bot that systematically identifies and reclaims this rent can significantly improve capital efficiency.

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
In Solana, accounts must maintain a minimum lamport balance to avoid rent collection:
- Rent is collected annually
- Minimum balance depends on account data size
- Most accounts require ~890,880 lamports for rent exemption

#### 2. Sponsored Accounts
Kora operators create accounts on behalf of users:
- Accounts are created via `SystemProgram.createAccount`
- Operator pays the rent-exempt balance
- If the account is never used, the SOL is locked forever

#### 3. Reclaim Conditions
The bot ONLY reclaims from accounts that are:
- **Empty** (no custom data)
- **Inactive** (haven't been modified in N slots)
- **Safe** (not PDAs, not unknown programs)
- **Valuable** (have enough SOL to justify the transaction fee)

#### 4. Safety Guarantees
The bot implements multiple safety layers:
- **NEVER** closes PDAs (Program Derived Addresses)
- **NEVER** closes unknown program accounts
- **NEVER** closes accounts with token balances
- **NEVER** closes accounts with recent activity
- All decisions are logged and auditable
- Default to dry-run mode (safe by default)

## Installation

### Prerequisites
- Node.js 16+
- npm or yarn
- A Solana keypair (JSON format)
- Devnet SOL for testing (faucet.solana.com)

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

### Configuration Fields

| Field | Type | Description |
|-------|------|-------------|
| `rpcUrl` | string | Solana RPC endpoint (public or private) |
| `cluster` | string | Network: devnet, testnet-beta, mainnet-beta |
| `keypairPath` | string | Path to operator keypair (JSON format) |
| `treasuryAddress` | string | Where reclaimed SOL is sent |
| `indexPath` | string | Local file tracking sponsored accounts |
| `auditLogPath` | string | Audit log of all actions |
| `minInactivitySlots` | number | Slots before account eligible for reclaim (~46 hours on devnet) |
| `dryRun` | boolean | **RECOMMENDED: true** Do not submit transactions, just analyze |
| `telegram.enabled` | boolean | Enable Telegram alerts (optional) |
| `telegram.botToken` | string | Telegram bot token from BotFather |
| `telegram.chatId` | string | Your Telegram chat ID |
| `telegram.alerts.reclaimThreshold` | number | Min SOL to alert on successful reclaim |
| `telegram.alerts.idleThreshold` | number | Min idle SOL to alert on detection |
| `dashboard.enabled` | boolean | Enable operator dashboard (optional) |
| `dashboard.port` | number | Dashboard port (default: 3000) |
| `dashboard.host` | string | Dashboard host (default: localhost) |

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

### 4. Dry-Run Reclaim

Test reclaim logic without submitting transactions:

```bash
npm start -- reclaim --dry-run true
```

**ALWAYS run this first!** Review the output before proceeding.

### 5. Execute Live Reclaim

Once confident, execute actual transactions:

```bash
npm start -- reclaim --dry-run false
```

⚠️ **WARNING**: This submits real transactions! Ensure:
- `treasury` address is correct
- Keypair is secure
- Sufficient SOL for fees

### 6. Check Reports

View audit log summary:

```bash
npm start -- report
```

View indexer statistics:

```bash
npm start -- stats
```

### 7. Start Operator Dashboard (Phase 9)

Monitor operations with a real-time web dashboard:

```bash
npm start -- dashboard --config config.json
```

Access at `http://localhost:3000`

**Dashboard Features:**
- Real-time metrics and statistics
- Account tracking with detailed information
- Visual timeline of reclaim events
- Active warnings and alerts
- Read-only interface (no transaction signing)

See [PHASE_9_DASHBOARD.md](./docs/PHASE_9_DASHBOARD.md) for full documentation.

### 8. Telegram Alerting (Phase 10)

Receive real-time alerts on important events:

1. Create a Telegram bot via @BotFather
2. Get your chat ID
3. Update `config.json`:
   ```json
   {
     "telegram": {
       "enabled": true,
       "botToken": "YOUR_BOT_TOKEN",
       "chatId": "YOUR_CHAT_ID",
       "alerts": {
         "reclaimThreshold": 0.1,
         "idleThreshold": 0.5
       }
     }
   }
   ```

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
- [x] Phase 11: Advanced Monitoring & Metrics (enterprise-grade monitoring)
- [ ] Hardware wallet support
- [ ] Multi-signature treasury support
- [ ] Token account reclaim (with token burning)
- [ ] Advanced scheduling/automation
- [ ] GraphQL API integration
- [ ] Batch processing improvements

## References

- [Solana Rent Model](https://docs.solana.com/developing/programming-model/accounts#rent)
- [Kora Documentation](https://www.getkoralabs.com)
- [@solana/web3.js](https://solana-labs.github.io/solana-web3.js/)
- [SPL Token Program](https://github.com/solana-labs/solana-program-library)

---

**Built with ❤️ for Solana operators**
