# Devnet Testing Guide

This guide describes how we test on devnet. It mirrors the steps we run before any mainnet attempt — small, repeatable, and well logged.

**For Production Deployment:** See [GETTING_STARTED.md](../GETTING_STARTED.md) for moving from devnet → testnet → mainnet. This guide covers development testing only.

## Testing Progression

Before going live on mainnet, follow this progression:

1. **Devnet** (this guide) — Free testing with fake SOL
2. **Testnet** (next) — Mirrors mainnet with free SOL from faucet
3. **Mainnet** (production) — Real SOL and real accounts

Each stage uses the same code and configuration, just different RPC endpoints and keypairs.

## Environment Setup

Let's get your devnet environment ready. Follow these steps in order.

### 1. Install Solana CLI

```bash
# macOS/Linux
sh -c "$(curl -sSfL https://release.solana.com/v1.17.0/install)"

# Windows (use WSL2 or Git Bash)
# Follow: https://docs.solana.com/cli/install-solana-cli-tools
```

### 2. Point Solana CLI to Devnet

Tell Solana CLI where to connect:

### 3. Create a Devnet Keypair

```bash
# Generate new keypair
solana-keygen new --outfile ~/.config/solana/devnet-keypair.json

# Verify keypair
solana address --keypair ~/.config/solana/devnet-keypair.json

# Expected output:
# EH5xS38eYEVqUfvkEYvtYyS3iAGxcWFtbdXohWBt2phW
```

### 4. Request Devnet SOL

```bash
# Using CLI
solana airdrop 10 --keypair ~/.config/solana/devnet-keypair.json

# Using faucet web UI
# https://faucet.solana.com/
# Paste your address: EH5xS38eYEVqUfvkEYvtYyS3iAGxcWFtbdXohWBt2phW

# Verify balance
solana balance --keypair ~/.config/solana/devnet-keypair.json

# Expected output:
# 10 SOL
```

## Test Scenario 1: Simple Reclaim

### Goal
Reclaim rent from a single inactive System account

### Setup

**1. Create bot config**

```bash
cp config.example.json config.json
```

**2. Edit config.json**

```json
{
  "rpcUrl": "https://api.devnet.solana.com",
  "cluster": "devnet",
  "keypairPath": "./devnet-keypair.json",
  "treasuryAddress": "EH5xS38eYEVqUfvkEYvtYyS3iAGxcWFtbdXohWBt2phW",
  "indexPath": "./data/indexed-accounts.json",
  "auditLogPath": "./data/audit-log.json",
  "minInactivitySlots": 100,
  "maxRetries": 3,
  "retryDelayMs": 1000,
  "allowedPrograms": [],
  "dryRun": true,
  "logLevel": "debug"
}
```

**3. Copy your keypair**

```bash
cp ~/.config/solana/devnet-keypair.json devnet-keypair.json
```

**4. Create test account**

```bash
# Create a new account with no funds
solana-keygen new --outfile test-account.json

# Get public key
solana address --keypair test-account.json

# Expected: ATestAccountPublicKeyHere...
```

**5. Fund test account (create it rent-exempt)**

```bash
# Send 1 SOL to the test account
solana transfer --keypair devnet-keypair.json test-account.json 1

# Verify it exists
solana account test-account-pubkey

# Expected: 1 SOL, owned by System
```

**6. Create accounts.json**

```json
[
  {
    "publicKey": "ATestAccountPublicKeyHere",
    "ownerProgram": "11111111111111111111111111111111",
    "rentLamportsAtCreation": 890880,
    "creationSlot": 0,
    "creationTxSignature": "test-tx-signature",
    "createdAt": 1705689600
  }
]
```

### Execute Test

```bash
# 1. Index the account
npm start -- index --import accounts.json

# Expected:
# ✓ Imported 1 account
# Total rent locked: 0.8909 SOL

# 2. Analyze
npm start -- analyze

# Expected:
# ✓ APPROVABLE - Account is empty, inactive, etc.

# 3. Dry-run reclaim
npm start -- reclaim --dry-run true

# Expected:
# [DRY-RUN] Would reclaim 0.89088 SOL...

# 4. Live reclaim
npm start -- reclaim --dry-run false

# Expected:
# ✓ Reclaim confirmed: 0.89088 SOL
# txSignature: [signature]

# 5. Verify on blockchain
solana account test-account-pubkey

# Expected: ERROR - account doesn't exist (successfully closed!)
```

### Validation

```bash
# Check treasury received funds
solana balance EH5xS38eYEVqUfvkEYvtYyS3iAGxcWFtbdXohWBt2phW

# Should be higher than before

# Check audit log
cat data/audit-log.json | jq '.[-1]'

# Should show RECLAIM_CONFIRMED
```

---

## Test Scenario 2: Multiple Accounts (10+)

### Goal
Test bulk reclaim on many accounts

### Setup

**1. Create multiple test accounts**

```bash
#!/bin/bash
# create-test-accounts.sh

for i in {1..10}; do
  # Create account
  solana-keygen new --outfile test-account-$i.json
  PUBKEY=$(solana address --keypair test-account-$i.json)
  
  # Fund with 1 SOL
  solana transfer --keypair devnet-keypair.json $PUBKEY 1
  
  echo "Created: $PUBKEY"
done
```

**2. Create accounts.json with all pubkeys**

```bash
#!/bin/bash
# generate-accounts-json.sh

echo "[" > accounts.json

for i in {1..10}; do
  PUBKEY=$(solana address --keypair test-account-$i.json)
  
  if [ $i -lt 10 ]; then
    COMMA=","
  else
    COMMA=""
  fi
  
  cat >> accounts.json <<EOF
  {
    "publicKey": "$PUBKEY",
    "ownerProgram": "11111111111111111111111111111111",
    "rentLamportsAtCreation": 890880,
    "creationSlot": 0,
    "creationTxSignature": "test-tx-$i",
    "createdAt": 1705689600
  }$COMMA
EOF
done

echo "]" >> accounts.json
```

### Execute

```bash
# 1. Index all
npm start -- index --import accounts.json
# ✓ Imported 10 accounts
# Total rent locked: 8.9088 SOL

# 2. Analyze all
npm start -- analyze
# [ANALYZED] Account 1: reclaimable: true
# [ANALYZED] Account 2: reclaimable: true
# ... (10 total)

# 3. Stats
npm start -- stats
# Total Tracked: 10
# Total Rent Locked: 8.9088 SOL

# 4. Dry-run
npm start -- reclaim --dry-run true
# [DRY-RUN] Would reclaim 0.89088 SOL from account 1
# ... (10 total)
# Summary: Would reclaim 8.9088 SOL

# 5. Live reclaim
npm start -- reclaim --dry-run false
# [TX_SUBMITTED] signature1
# ✓ Reclaim confirmed: 0.89088 SOL
# ... (10 total)
# Actions Confirmed: 10

# 6. Check report
npm start -- report
# Total Accounts Tracked: 10
# Total Reclaimed: 8.9088 SOL
```

---

## Test Scenario 3: Safety Checks (Rejection Cases)

### Goal
Verify safety engine rejects unsafe accounts

### Setup

**1. Create a token account**

```bash
# Use SPL token CLI
spl-token create-mint

# Create associated account
spl-token create-account <MINT_ADDRESS>

# Get the token account address
TOKEN_ACCOUNT=$(spl-token accounts | grep -o '[A-Za-z0-9]*' | head -1)

# Add to accounts.json
```

**2. Create PDA-like account**

```bash
# Create account with custom owner
# This would be rejected by the bot

# Add to accounts.json with:
# "ownerProgram": "CustomProgramIDHere"
```

**3. Create recently-active account**

```bash
# Use very recent slot
# Bot should reject due to activity threshold

# Add to accounts.json with:
# "creationSlot": (current_slot - 50)  # Too recent
```

### Execute

```bash
# Analyze
npm start -- analyze

# Check output - accounts should be flagged:
# ✗ BLOCKED
# Reason: Rejected: HAS_TOKEN_BALANCE
# Reason: Rejected: UNKNOWN_PROGRAM
# Reason: Rejected: RECENT_ACTIVITY
```

---

## Test Scenario 4: Error Handling

### Goal
Verify graceful error handling

### Tests

**1. Missing keypair**

```bash
# Modify config.json to point to non-existent keypair
npm start -- reclaim

# Expected: Clear error message, exit 1
```

**2. Invalid treasury address**

```bash
# Modify treasury address to invalid value
npm start -- reclaim

# Expected: Config validation error
```

**3. Network error (disconnect RPC)**

```bash
# Change RPC to non-existent URL
npm start -- analyze

# Expected: Retry logic, then timeout with clear message
```

**4. Insufficient funds for fees**

```bash
# Use near-empty keypair
npm start -- reclaim

# Expected: Transaction fails gracefully, logged
```

---

## Monitoring & Debugging

### View Logs

```bash
# Real-time
tail -f logs/bot.log

# Last 20 lines
tail -20 logs/bot.log

# Search for errors
grep ERROR logs/bot.log

# Follow JSON format
cat logs/bot.log | jq '.'
```

### Check Audit Trail

```bash
# Pretty print
cat data/audit-log.json | jq '.'

# Get latest entry
cat data/audit-log.json | jq '.[-1]'

# Count actions
cat data/audit-log.json | jq '[.[] | .action] | group_by(.) | map({action: .[0], count: length})'
```

### Query On-Chain State

```bash
# Check account exists
solana account <PUBKEY>

# Check balance
solana balance <PUBKEY>

# Check transaction
solana confirm <SIGNATURE>

# Get token balance
spl-token accounts
```

---

## Performance Testing

### Load Test: 100 Accounts

```bash
# Generate 100 test accounts (takes ~10 minutes)
for i in {1..100}; do
  solana-keygen new --outfile test-$i.json
  PUBKEY=$(solana address --keypair test-$i.json)
  solana transfer --keypair devnet-keypair.json $PUBKEY 0.9
done

# Create accounts.json with all 100
# Run through full workflow

# Measure time:
time npm start -- reclaim --dry-run false

# Expected: < 5 minutes for 100 accounts
```

### Metrics to Track

- Time to analyze 100 accounts
- Time to reclaim 100 accounts
- RPC call success rate
- Transaction confirmation time
- Memory usage

---

## Cleanup

### Reset Everything

```bash
# Remove data
rm -rf data/ logs/

# Remove test accounts
rm -f test-*.json

# Remove generated files
rm accounts.json config.json

# Keep only source
git status  # Should show clean working directory
```

### Cleanup One Account

```bash
# Remove from index
# Edit indexed-accounts.json and remove the account entry

# Or re-create the index:
rm data/indexed-accounts.json
npm start -- index --import accounts.json
```

---

## Troubleshooting Devnet Tests

### "Account not found"
- Devnet resets frequently
- Create new accounts
- Use shorter inactivity threshold

### "Insufficient lamports"
- Request more from faucet
- Reduce test account count

### "RPC rate limited"
- Increase `retryDelayMs` in config
- Use private RPC endpoint
- Stagger requests

### "Transaction failed"
- Check keypair permissions
- Verify sufficient SOL for fees
- Check treasury address is valid

---

## Next Steps After Testing

1. **Mainnet-beta test** (with small amounts)
2. **Set up automation** (cron job)
3. **Production deployment**
4. **Monitoring & alerts**
5. **Documentation updates**

---

**Always test on devnet first! Never go to mainnet without thorough devnet validation.**
