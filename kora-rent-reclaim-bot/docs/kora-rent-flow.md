# Kora Rent Flow

## How Kora Sponsorship Works

### 1. Account Creation

**User Action:**
```
User wants to use Kora-enabled application
→ Application requests account creation
→ Kora operator creates account
→ Operator pays rent-exempt balance
```

**On-Chain:**
```
Transaction: SystemProgram.createAccount
Inputs:
  - from: operator_keypair
  - newAccount: user_pubkey
  - lamports: 890,880 (rent-exempt)
  - space: 0 (for system account)
  - owner: 11111111111111111111111111111111 (System)

Result:
  - Account exists at user_pubkey
  - Account has 890,880 lamports
  - Account is owned by System
  - Account has 0 bytes of data
```

### 2. Initial State

**Operator's Perspective:**
```
Cost: 890,880 lamports (~0.009 SOL)
Benefit: User gets account
ROI: Must be reclaimed or lost forever
```

**On-Chain State:**
```
Account: 6qNzjnzjDPmqMLhx1wbBWXEyuZ5EpwJnZZpQaZRvkrz
Lamports: 890,880
Owner: System Program
Data: 0 bytes
Rent-Exempt: Yes
Created: Slot 200,000
```

### 3. User Inactivity

**Months Pass:**
```
User never uses the account
Account sits dormant
890,880 lamports still locked
Operator has no way to recover it
```

### 4. Reclaim Opportunity

**Bot Analysis:**
```
After 100,000+ slots of inactivity...

Check 1: Account exists? YES ✓
Check 2: Is PDA? NO ✓
Check 3: Known owner? YES (System) ✓
Check 4: Empty? YES ✓
Check 5: Inactive? YES ✓
Check 6: Rent-exempt? YES ✓
Check 7: Has value? YES (890,880 lamports) ✓

Result: SAFE TO RECLAIM ✓
```

### 5. Reclaim Execution

**Transaction:**
```
Instruction: SystemProgram.transfer
From: 6qNzjnzjDPmqMLhx1wbBWXEyuZ5EpwJnZZpQaZRvkrz
To: treasury_address
Amount: 890,880 lamports

Result:
- Account is closed
- 890,880 lamports transferred to treasury
- Operator recovers capital
```

### 6. Post-Reclaim State

**On-Chain:**
```
Account: 6qNzjnzjDPmqMLhx1wbBWXEyuZ5EpwJnZZpQaZRvkrz
Status: DELETED (doesn't exist)
Lamports: 0
```

**Operator's Ledger:**
```
Spent: 890,880 lamports (at creation)
Reclaimed: 890,880 lamports (during reclaim)
Net: 0 lamports
Plus: Transaction fee (~5,000 lamports)
Cost: 5,000 lamports for entire lifecycle
```

## Multi-Step Reclaim Flow

### Scenario: 1,000 Accounts

**Week 1: Index**
```
Input: List of 1,000 sponsored account pubkeys
Output: Stored in indexed-accounts.json
  {
    "publicKey": "6qNzjnzjDPmqMLhx1wbBWXEyuZ5EpwJnZZpQaZRvkrz",
    "owner": "11111111111111111111111111111111",
    "rentLamports": 890,880,
    "createdAt": 1705689600
  }
```

**Week 2: Analyze**
```
For each account:
  1. Fetch on-chain state
  2. Determine type
  3. Check activity
  4. Mark reclaimable or reason

Results:
  - 800 accounts: RECLAIMABLE
  - 150 accounts: Recently active
  - 50 accounts: Unknown program owner
```

**Week 3: Dry-Run**
```
dry-run: true
For each of 800 reclaimable accounts:
  1. Build reclaim instruction
  2. Log what WOULD be sent
  3. Don't actually submit

Output:
  "Would reclaim: 800 * 0.89088 = 712.7 SOL"
```

**Week 4: Live Reclaim**
```
dry-run: false
For each of 800 accounts:
  1. Build reclaim instruction
  2. Sign with operator keypair
  3. Submit transaction
  4. Wait for confirmation
  5. Log to audit trail

Results:
  - Success: 795 accounts (0.71 SOL each = 712 SOL total)
  - Failed: 5 accounts (network issues)
```

**Outcome:**
```
Initial Locked: 712.7 SOL
Reclaimed: 712.0 SOL
Operator Gain: 712.0 SOL
Cost: ~3,975 lamports (~0.004 SOL)
ROI: Very high
```

## Detailed Bot Flow

### Starting Point: Config
```
config.json
├── rpcUrl: "https://api.devnet.solana.com"
├── keypairPath: "./keypair.json"
├── treasuryAddress: "4MKJdJ9K4RzJ9nZKj3j..."
├── indexPath: "./data/indexed-accounts.json"
└── minInactivitySlots: 100,000
```

### Step 1: Index
```
CLI: npm start -- index --import accounts.json

Process:
  Read accounts.json (1,000 accounts)
  → For each account:
      Validate pubkey
      Validate owner
      Store in indexed-accounts.json
  → Save indexer state

Output:
  ✓ Imported 1,000 accounts
  Total rent locked: 890 SOL
```

### Step 2: Analyze
```
CLI: npm start -- analyze

Process:
  For each tracked account:
    1. Fetch on-chain with getAccountInfo()
    2. Determine type (System/Token/PDA)
    3. Calculate inactivity (current_slot - last_modified_slot)
    4. Identify risk flags
    5. Calculate reclaimable amount
  Store analyses

Output:
  [ANALYZED] Account: 6qNzjnzjDPmqMLhx1wbBWXEyuZ5EpwJnZZpQaZRvkrz
  reclaimable: true
  lamports: 890880
  inactivitySlots: 150000
  riskFlags: []
```

### Step 3: Safety Check
```
Safety Engine: For each analysis

Checks (all must pass):
  ✓ Account exists
  ✓ Not a PDA
  ✓ Known owner (System)
  ✓ Account type OK (System account)
  ✓ No token balance
  ✓ Empty (0 bytes)
  ✓ Inactive (>100k slots)
  ✓ Rent-exempt
  ✓ Has value (>0 lamports)

Decisions:
  800/1000 accounts: APPROVED
  150/1000: Rejected (recent activity)
  50/1000: Rejected (unknown owner)
```

### Step 4: Dry-Run (Recommended)
```
CLI: npm start -- reclaim --dry-run true

Process:
  For each approved account:
    1. Build SystemProgram.transfer instruction
    2. Don't sign or submit
    3. Log: "Would transfer X lamports to treasury"
    4. Mark as DRY_RUN

Output:
  [DRY-RUN] Would reclaim 0.89088 SOL from 6qNzjnzjDPmqMLhx1wbBWXEyuZ5EpwJnZZpQaZRvkrz
  ...
  Summary:
    Would reclaim: 712 SOL
    Transaction count: 800
    Estimated fee: 0.004 SOL
```

### Step 5: Review & Approve
```
Operator reviews logs:
  ✓ 800 accounts reclaimed
  ✓ 712 SOL recovered
  ✓ Zero errors
  ✓ Audit trail complete

Decision: PROCEED TO LIVE
```

### Step 6: Live Reclaim
```
CLI: npm start -- reclaim --dry-run false

Process:
  For each approved account:
    1. Load operator keypair
    2. Build transaction with transfer instruction
    3. Sign with operator keypair
    4. Submit via connection.sendTransaction()
    5. Wait for confirmation
    6. Update audit log

Output:
  [TX_SUBMITTED] 5qpXD4jnZzjDPmqMLhx1wbBWXEyuZ5EpwJnZZpQaZRvkrz
    account: 6qNzjnzjDPmqMLhx1wbBWXEyuZ5EpwJnZZpQaZRvkrz
    amount: 890880
    treasury: 4MKJdJ9K4RzJ9nZKj3j...

  [RECLAIM_CONFIRMED] ✓ APPROVED
    0.89088 SOL from 6qNzjnzjDPmqMLhx1wbBWXEyuZ5EpwJnZZpQaZRvkrz
    txSignature: 5qpXD4jnZzjDPmqMLhx1wbBWXEyuZ5EpwJnZZpQaZRvkrz
```

### Step 7: Report
```
CLI: npm start -- report

Output:
═════════════════════════════════════════════════════════
KORA RENT RECLAIM BOT - REPORT
═════════════════════════════════════════════════════════
Total Accounts Tracked:     1,000
Existing On-Chain:          800
Reclaimable:                795

Total Rent Locked:          890.8 SOL
Total Reclaimed:            712.0 SOL
Still Locked:               178.8 SOL

Actions Confirmed:          795
Actions Failed:             5
```

## Safety Layers

### Layer 1: Config Validation
```
Load config.json
Validate:
  ✓ RPC URL is valid
  ✓ Cluster is recognized
  ✓ Keypair file exists
  ✓ Treasury address is valid PubKey
  ✓ Paths are writable

Fail fast if invalid
```

### Layer 2: Indexer Validation
```
For each account to import:
  ✓ PublicKey format valid
  ✓ Owner program valid PubKey
  ✓ Rent lamports > 0
  ✓ Creation slot > 0

Skip invalid, continue with valid
```

### Layer 3: On-Chain Verification
```
For each indexed account:
  ✓ Fetch on-chain with retry
  ✓ Parse account data safely
  ✓ Determine type with heuristics
  ✓ Check rent exemption with calculation

Graceful handling if not found
```

### Layer 4: Safety Checks
```
All of:
  ✓ NOT a PDA
  ✓ NOT unknown program
  ✓ NOT has token balance
  ✓ NOT recently modified
  ✓ IS empty data

Any failure → reject completely
```

### Layer 5: Transaction Safety
```
Before signing:
  ✓ Verify operator keypair loaded
  ✓ Verify treasury address not self
  ✓ Calculate fees
  ✓ Verify sufficient balance

Before submitting:
  ✓ Serialize correctly
  ✓ Sign with operator keypair
  ✓ Verify signature

After submission:
  ✓ Poll for confirmation
  ✓ Check tx meta.err
  ✓ Log result
```

### Layer 6: Audit Trail
```
Every action logged:
  timestamp, action, account, details
  → audit-log.json (append-only)
  → logs/* (daily rotation)
  → console (real-time)
```

## Error Handling

### Graceful Degradation

```
Scenario: Account doesn't exist
  Expected: Account was closed already
  Action: Skip silently
  Log: ACCOUNT_NOT_FOUND

Scenario: Recent activity detected
  Expected: User might still use it
  Action: Reject, add to skip list
  Log: REJECTED_RECENT_ACTIVITY

Scenario: Unknown program owner
  Expected: Custom program state
  Action: Reject absolutely
  Log: REJECTED_UNKNOWN_PROGRAM

Scenario: Transaction fails
  Expected: Network issues or insufficient fees
  Action: Log failure, continue
  Log: RECLAIM_FAILED

Scenario: Keypair missing
  Expected: Configuration error
  Action: Stop immediately
  Log: FATAL_ERROR, exit(1)
```

## Audit Trail Example

```json
[
  {
    "timestamp": "2024-01-20T10:30:00.000Z",
    "unix_timestamp": 1705754400000,
    "action": "INDEX_IMPORTED",
    "account": null,
    "details": { "count": 1000, "source": "accounts.json" }
  },
  {
    "timestamp": "2024-01-20T10:35:00.000Z",
    "unix_timestamp": 1705754500000,
    "action": "ANALYZED",
    "account": "6qNzjnzjDPmqMLhx1wbBWXEyuZ5EpwJnZZpQaZRvkrz",
    "details": { "reclaimable": true, "lamports": 890880, "inactivitySlots": 150000 }
  },
  {
    "timestamp": "2024-01-20T10:40:00.000Z",
    "unix_timestamp": 1705754600000,
    "action": "SAFETY_CHECK_PASSED",
    "account": "6qNzjnzjDPmqMLhx1wbBWXEyuZ5EpwJnZZpQaZRvkrz",
    "details": { "checks": 9, "all_passed": true }
  },
  {
    "timestamp": "2024-01-20T10:45:00.000Z",
    "unix_timestamp": 1705754700000,
    "action": "RECLAIM_EXECUTED",
    "account": "6qNzjnzjDPmqMLhx1wbBWXEyuZ5EpwJnZZpQaZRvkrz",
    "details": { "amount": 890880, "txSignature": "5qpXD4j..." }
  }
]
```

---

**Key Principle**: Every decision is auditable. Every transaction is logged. Every action is reversible or documented.
