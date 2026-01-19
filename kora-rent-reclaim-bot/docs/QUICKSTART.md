# Quick Start Guide

This guide covers **development setup**. See [GETTING_STARTED.md](../GETTING_STARTED.md) for production deployment.

This quick start is intentionally minimal — follow the steps in order and you'll be running in ten minutes.

## Prerequisites

You'll need:
- Node.js 16 or higher
- npm or yarn
- A Solana keypair (JSON file) — **never use production keypair in dev!**
- Some devnet SOL (grab it from https://faucet.solana.com)

**For Production:**
- Use a separate keypair stored in a secure vault
- Use a private RPC endpoint (not public)
- Set up monitoring and logging
- See [GETTING_STARTED.md](../GETTING_STARTED.md) for full production checklist

## Step 1: Clone & Install

Get the code and set it up:
git clone https://github.com/your-org/kora-rent-reclaim-bot.git
cd kora-rent-reclaim-bot

# Install dependencies
npm install

# Build TypeScript
npm run build
```

## Step 2: Configure

Create and edit your config file:

```json
{
  "keypairPath": "./path/to/your/keypair.json",
  "treasuryAddress": "YOUR_TREASURY_PUBKEY_HERE",
  "rpcUrl": "https://api.devnet.solana.com",
  "cluster": "devnet",
  "dryRun": true
}
```

## Step 3: Create Accounts List

Create a file named `accounts-to-track.json`:

```json
[
  {
    "publicKey": "6qNzjnzjDPmqMLhx1wbBWXEyuZ5EpwJnZZpQaZRvkrz",
    "ownerProgram": "11111111111111111111111111111111",
    "rentLamportsAtCreation": 890880,
    "creationSlot": 200000,
    "creationTxSignature": "5qpXD4jnZzjDPmqMLhx1wbBWXEyuZ5EpwJnZZpQaZRvkrz",
    "createdAt": 1705689600
  }
]
```

## Step 4: Index Accounts

```bash
npm start -- index --import accounts-to-track.json
```

Expected output:
```
✓ Imported 1 account from accounts-to-track.json
Total rent locked: 0.8909 SOL
```

## Step 5: Analyze Accounts

```bash
npm start -- analyze
```

Expected output:
```
============================================================
Account: 6qNzjnzjDPmqMLhx1wbBWXEyuZ5EpwJnZZpQaZRvkrz
Status: ✓ APPROVABLE
Reason: All safety checks passed

✓ checkNotPda: Account is not a PDA
✓ checkKnownProgram: Program is known: 11111111...
✓ checkAccountType: Account type is allowed: SYSTEM
✓ checkNoTokenBalance: Account has no token balance
✓ checkEmpty: Account has no data
✓ checkInactivity: Account inactive for 150000 slots
✓ checkRentExempt: Account is rent-exempt
✓ checkHasValue: Account has 890880 lamports to reclaim
============================================================
```

## Step 6: Dry-Run Reclaim (ALWAYS DO THIS FIRST!)

```bash
npm start -- reclaim --dry-run true
```

Expected output:
```
[DRY-RUN] Would reclaim 0.89088 SOL from 6qNzjnzjDPmqMLhx1wbBWXEyuZ5EpwJnZZpQaZRvkrz

════════════════════════════════════════════════════════════════════════
KORA RENT RECLAIM BOT - REPORT
════════════════════════════════════════════════════════════════════════

Total Accounts Tracked:     1
Existing On-Chain:          1
Reclaimable:                1

Total Rent Locked:          0.8909 SOL
Total Reclaimed:            0.0000 SOL
Still Locked:               0.8909 SOL

Actions (Dry-Run):          1

════════════════════════════════════════════════════════════════════════
```

✅ **All looks good? Proceed to step 7**

## Step 7: Execute Live Reclaim

⚠️ **WARNING**: This submits real transactions!

```bash
npm start -- reclaim --dry-run false
```

Expected output:
```
[TX_SUBMITTED] 5qpXD4jnZzjDPmqMLhx1wbBWXEyuZ5EpwJnZZpQaZRvkrz
  account: 6qNzjnzjDPmqMLhx1wbBWXEyuZ5EpwJnZZpQaZRvkrz
  amount: 890880
  treasury: YOUR_TREASURY...

✓ Reclaim confirmed: 0.89088 SOL from 6qNzjnzjDPmqMLhx1wbBWXEyuZ5EpwJnZZpQaZRvkrz
  signature: 5qpXD4jnZzjDPmqMLhx1wbBWXEyuZ5EpwJnZZpQaZRvkrz
  treasury: YOUR_TREASURY...

════════════════════════════════════════════════════════════════════════
KORA RENT RECLAIM BOT - REPORT
════════════════════════════════════════════════════════════════════════

Total Accounts Tracked:     1
Existing On-Chain:          1
Reclaimable:                1

Total Rent Locked:          0.8909 SOL
Total Reclaimed:            0.8909 SOL
Still Locked:               0.0000 SOL

Actions Confirmed:          1

════════════════════════════════════════════════════════════════════════
```

✅ **Success!** 0.89 SOL reclaimed!

## Step 8: Check Reports

```bash
npm start -- report
```

```bash
npm start -- stats
```

## Common Issues

### "Cannot find module '@solana/web3.js'"

**Solution**: Run `npm install` again

### "Keypair file not found"

**Solution**: Check `keypairPath` in `config.json` is correct

### "Account does not exist"

**Solution**: The account was already closed or never existed. This is expected.

### "Recent activity"

**Solution**: Wait longer before reclaiming (increase `minInactivitySlots`)

### "Unknown program"

**Solution**: This is a custom program account. It's not safe to reclaim.

## Next Steps

1. **Scale**: Add more accounts to `accounts-to-track.json`
2. **Automate**: Run on a schedule with cron:
   ```bash
   0 */6 * * * cd /path/to/bot && npm start -- reclaim --dry-run false >> cron.log 2>&1
   ```
3. **Monitor**: Check audit logs regularly:
   ```bash
   cat data/audit-log.json | jq '.[0:10]'
   ```
4. **Backup**: Keep backups of indexed-accounts.json and audit-log.json

## Security Checklist

- [ ] Keypair file permissions: `chmod 600 keypair.json`
- [ ] Config file doesn't contain secrets
- [ ] Treasury address is correct
- [ ] Ran dry-run first
- [ ] Audit logs are being written
- [ ] RPC endpoint is reliable

## Getting Help

1. Read the full [README.md](../README.md)
2. Check [docs/solana-rent-explained.md](./solana-rent-explained.md)
3. Review [docs/kora-rent-flow.md](./kora-rent-flow.md)
4. Check logs: `cat logs/bot.log | tail -20`

---

**Congratulations!** You're now running the Kora Rent Reclaim Bot! 🎉
