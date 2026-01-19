# Solana Rent Explained

A short aside: this is the essential background we assume operators understand. It's short and practical — no academic fluff.

## What is Rent?

Data on Solana's blockchain costs money to store. That cost is called **rent**.

### Key Principles

1. **All accounts pay rent** (unless they're exempt). You need a minimum SOL balance to stay exempt
2. **Bigger accounts need more SOL** locked up as rent
3. **If you don't have enough**, Solana charges you rent
4. **Hit the minimum?** Your account becomes permanent. Rent stops.

## Rent Calculation

### Formula

```
Minimum Rent = (account_size + 20,480) * annual_rent_rate * (years until collection)
```

Where:
- `account_size` = Size of account data (in bytes)
- `20,480` = Fixed overhead per account
- `annual_rent_rate` ≈ 3.5% per year (varies by network)
- Collections happen every 2 years

### Example Calculation

**System Account (0 bytes):**
```
Minimum = (0 + 20,480) * 0.00036 * 2 = 14.75 SOL (annually)
Per-epoch = 14.75 / 432 epochs ≈ 0.034 SOL per epoch (~3 days)
For rent-exemption = 890,880 lamports ≈ 0.89 SOL (for 2 years)
```

**Token Mint (82 bytes):**
```
Minimum = (82 + 20,480) * 0.00036 * 2 = 14.9 SOL
```

## Why Kora Sponsors Account Creation

### The Problem

Creating an account on Solana is pricey:
1. Transaction fee (~5,000 lamports)
2. Plus you need that rent-exempt balance

Total cost per account: ~895,000 lamports (~0.009 SOL)

For large-scale applications (like marketplaces), creating thousands of accounts is expensive.

### The Solution

Kora operators sponsor account creation:
- Operator pays the rent-exempt balance
- User gets a ready-to-use account
- Operator later reclaims the SOL when the account is no longer needed

## Rent Reclaim Mechanism

### What is Reclaim?

When an account is closed:
1. Its data is erased
2. All its lamports are transferred to a designated account
3. The account no longer exists on-chain

### Reclaim Example

**Initial State:**
- Account: 0.89 SOL (rent-exempt balance)
- Owner: Unknown/inactive user

**After Reclaim:**
- Account: Deleted (0 SOL)
- Treasury: +0.89 SOL
- Operator gains: 0.89 SOL

## Why Reclaim Isn't Simple

### Problem 1: PDA Safety

**Program Derived Addresses (PDAs)** are special:
- Controlled entirely by a program
- Never have an associated keypair
- Contain program state
- **MUST NEVER BE CLOSED**

If you close a PDA, you break the program.

### Problem 2: Token Accounts

**SPL Token Accounts** are special:
- Store token balances (not just SOL)
- Have specific structure
- Closing requires special instruction (`CloseAccount`)
- Can only be closed if empty

### Problem 3: Custom Programs

Some accounts are owned by custom programs:
- Could be program state
- Could be unsafe to close
- Could break program functionality

### Problem 4: Activity Detection

**How do you know an account isn't being used?**
- On-chain, there's no definitive "last activity" timestamp
- Accounts can be dormant but still important
- Must infer from slot numbers (imperfect)

## Reclaim Rules

### Safe to Reclaim

✓ **System accounts with:**
- No data (length = 0)
- No token balance
- Not recently modified
- Not a PDA
- Owner is known/trusted

### NOT Safe to Reclaim

✗ **PDAs** - Program controlled
✗ **Token accounts with balance** - Need token burn first
✗ **Unknown program accounts** - Could break program
✗ **Recently modified accounts** - Still in use
✗ **Accounts with custom data** - Unknown purpose

## Solana Slot Time

Understanding activity requires understanding slots:

```
1 Slot ≈ 400ms
400 Slots ≈ 2.67 minutes (1 leader rotation)
~432,000 Slots ≈ 5 days (1 epoch)
```

### Example Inactivity Threshold

```
minInactivitySlots = 100,000
100,000 slots ≈ 40,000 seconds ≈ 11 hours
```

On devnet (fast, variable): ~46 hours
On mainnet-beta (slower): ~38 hours

## On-Chain Accounts Structure

### System Account (0 bytes data)
```
Owner: System Program (11111111...)
Lamports: 890,880 (rent-exempt minimum)
Data: (empty)
Executable: false
```

### SPL Token Mint
```
Owner: Token Program (TokenkegQfeZyiNwAJsyFbPVwwQQfuCS3nWknj3HWetQf)
Lamports: Varies (~2 SOL for 200+ years rent exemption)
Data: 82 bytes (supply, decimals, owner, etc.)
Executable: false
```

### SPL Token Account
```
Owner: Token Program (TokenkegQfeZyiNwAJsyFbPVwwQQfuCS3nWknj3HWetQf)
Lamports: Varies (~2 SOL)
Data: 165 bytes (balance, owner, mint, authority)
Executable: false
```

## Detecting Account Type

### System Account
- Owner = `11111111111111111111111111111111`
- Data length = 0
- Lamports = minimum rent

### PDA (Program Derived Address)
- No associated keypair
- "Off the Ed25519 curve"
- Deterministically derived from: `program_id + seeds + bump`
- Detection: Check if address would pass curve check (complex)

### Token Account
- Owner = Token Program (`TokenkegQfeZyiNwAJsyFbPVwwQQfuCS3nWknj3HWetQf`)
- Data length = 165 bytes (token account) or 82 bytes (mint)
- Can check balance field at offset 64 (8 bytes, little-endian)

## Rent Exemption Check

To verify an account is rent-exempt:

```typescript
const accountInfo = await connection.getAccountInfo(pubkey);
const minRent = await connection.getMinimumBalanceForRentExemption(
  accountInfo.data.length
);
const isRentExempt = accountInfo.lamports >= minRent;
```

## References

- [Solana Docs: Rent](https://docs.solana.com/developing/programming-model/accounts#rent)
- [Solana Docs: PDAs](https://docs.solana.com/developing/programming-model/calling-between-programs#program-derived-addresses)
- [SPL Token Spec](https://github.com/solana-labs/solana-program-library/tree/master/token/program/src)
- [Ed25519 Curve](https://en.wikipedia.org/wiki/EdDSA)

---

**Key Takeaway**: Reclaiming rent is efficient but dangerous. Always use conservative safety checks.
