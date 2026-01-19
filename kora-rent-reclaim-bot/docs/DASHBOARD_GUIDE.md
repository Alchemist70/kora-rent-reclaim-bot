# Dashboard Guide - Real-Time Operations Monitoring

**Version**: 1.0.0 | **Status**: Production Ready | **Port**: 3000 (default)

The **Kora Rent Reclaim Dashboard** is a read-only web UI for monitoring rent reclaim operations in real-time.

---

## Quick Start

### 1. Start the Dashboard

```bash
# Default (http://localhost:3000)
node dist/cli.js dashboard --config config.json

# Or with npm
npm start -- dashboard --config config.json

# Custom port
node dist/cli.js dashboard --config config.json --port 8080

# Accessible from network (use behind firewall!)
node dist/cli.js dashboard --config config.json --host 0.0.0.0 --port 3000
```

### 2. Open in Browser

Navigate to: **http://localhost:3000**

### 3. Monitor Operations

The dashboard updates automatically every 10 seconds with fresh data.

---

## Dashboard Sections

### 📊 Metrics Panel (Top Cards)

Four key metrics displayed as large cards:

| Metric | Meaning | Example |
|--------|---------|---------|
| **Total Tracked** | Number of accounts in the index | 1,234 accounts |
| **Total Locked** | Sum of all account rent in SOL | 890.50 SOL |
| **Total Reclaimed** | Successfully reclaimed SOL | 45.20 SOL |
| **Still Locked** | Remaining reclaimable SOL | 845.30 SOL |

**Updated every time you:**
- Run `index` command (increases Total Tracked)
- Run `analyze` command (may decrease if accounts become ineligible)
- Run `reclaim` command (increases Total Reclaimed, decreases Still Locked)

### 📋 Accounts Table

Detailed view of every indexed account:

| Column | Description |
|--------|-------------|
| **Account** | Public key (truncated, click for full address in tooltip) |
| **Type** | `System` or `Token` account |
| **Owner** | Program that owns the account |
| **Status** | `reclaimable`, `skipped`, `reclaimed`, `failed`, or `active` |
| **Rent** | Lamports (displayed in SOL equivalent) |
| **Decision** | Reason for current status (e.g., "Eligible for reclaim") |
| **Reclaimed?** | `✅ YES` if successfully reclaimed, `—` otherwise |

**Status Meanings:**

- **`reclaimable`** — ✅ Safe to reclaim, waiting for reclaim command
- **`skipped`** — ⏭️ Not eligible (too recent, PDA, or other safety check)
- **`reclaimed`** — ✅ Successfully reclaimed to treasury
- **`failed`** — ❌ Reclaim transaction failed
- **`active`** — ⏳ Awaiting analysis

**Sorting:** Click column headers to sort (defaults to highest rent descending)

**Search:** Type account address in search box to filter

### 📈 Timeline Chart

Real-time chart showing account activity over time:

**Events tracked:**
- **Indexed** — When accounts were discovered (`INDEX` action)
- **Analyzed** — When analysis was run (`ANALYZED` action)
- **Reclaimed** — When rent was successfully reclaimed (`RECLAIM_CONFIRMED` action)

**What it shows:**
- Horizontal axis = Time
- Vertical axis = Event count
- Bars grow as operations complete

**Use case:** Track progress of batch operations

### 🔐 Audit Log Summary

Summary statistics from the complete audit trail:

| Count | Meaning |
|-------|---------|
| **Indexed** | Total accounts discovered |
| **Analyzed** | Total accounts analyzed |
| **Reclaimed** | Total successful reclaim transactions |
| **Failed** | Total failed reclaim attempts |

Example:
```
Indexed    1,234
Analyzed   1,200
Reclaimed     45
Failed        12
```

This shows:
- 1,234 accounts were indexed
- 1,200 were analyzed (34 pending)
- 45 successfully reclaimed
- 12 had failed transactions

### ⚠️ Warnings Panel

Displays system issues (if any):

**Normal operation:**
```
✅ No operational warnings detected. Dashboard is functioning normally.
```

**Possible warnings:**
- 🔴 **RPC Connection Failed** — Cannot reach Solana RPC endpoint
- 🟡 **High Failure Rate** — Many reclaim transactions failing
- 🟡 **Stale Data** — Analysis results older than 24 hours
- 🟡 **Configuration Issue** — Config validation problems

---

## Common Workflows

### Workflow 1: Full Rent Reclaim Operation

**Terminal 1: Start Dashboard**
```bash
node dist/cli.js dashboard --config config.json
# ℹ️ Opens on http://localhost:3000
```

**Terminal 2: Execute Operations**
```bash
# Step 1: Index accounts
node dist/cli.js index --import accounts-to-track.json
# Watch dashboard: "Total Tracked" increases

# Step 2: Analyze accounts
node dist/cli.js analyze
# Watch dashboard: Status updates to "reclaimable" or "skipped"

# Step 3: Reclaim rent
node dist/cli.js reclaim
# Watch dashboard: Status updates to "reclaimed", "Total Reclaimed" increases

# Step 4: Generate report
node dist/cli.js report
# Report available in ./logs/report.txt
```

**Dashboard shows progression:**
1. ✅ Total Tracked: 1,234
2. ✅ Accounts show as "reclaimable": 1,000
3. ✅ Total Reclaimed: 890.50 SOL
4. ✅ Audit Log: Indexed: 1234, Analyzed: 1234, Reclaimed: 1000

### Workflow 2: Monitor Ongoing Operations

```bash
# Start dashboard in one terminal
node dist/cli.js dashboard --config config.json --host 0.0.0.0

# Access from another machine
# http://<server-ip>:3000

# Continue running operations on server
# Dashboard updates every 10 seconds
```

### Workflow 3: Debug Failed Reclaims

**In Dashboard:**
1. Look for accounts with status = `failed`
2. Click on account row to see full details
3. "Decision" column shows failure reason

**In Terminal:**
```bash
# Get detailed logs
tail -f logs/bot.log | grep "RECLAIM_FAILED"

# Check audit log directly
cat data/audit-log.json | grep -A 5 "RECLAIM_FAILED"
```

---

## Understanding Account Status

### Status Lifecycle

```
┌─────────────┐
│   INDEXED   │  Account discovered and added to index
└──────┬──────┘
       │
       ↓
┌─────────────────────────────────┐
│        ANALYZED                 │  On-chain checks performed
└──────┬──────────────────┬───────┘
       │                  │
    ✅ Safe          ❌ Not Safe
       │                  │
       ↓                  ↓
  RECLAIMABLE         SKIPPED
       │                  
       │ (await reclaim command)
       ↓
┌─────────────────────────────────┐
│   RECLAIM ATTEMPTED             │  Transaction submitted
└──────┬──────────────────┬───────┘
       │                  │
   ✅ Success        ❌ Failed
       │                  │
       ↓                  ↓
  RECLAIMED        RECLAIM_FAILED
```

### Why Accounts Are "Skipped"

When an account shows as `skipped`, check the "Decision" column:

| Decision | Reason | What to Do |
|----------|--------|-----------|
| "Eligible for reclaim" | Too recent (< 100k slots inactive) | Wait, come back later |
| "Account is PDA" | Program-derived account, unsafe to close | Skip, it's not a sponsored account |
| "Has program balance" | Account holds tokens/data | Skip, may break something |
| "Balance too low" | Not enough rent to justify transaction cost | Skip, economically inefficient |
| "Unsafe - risky pattern" | Custom heuristic detected risk | Skip, review account on-chain |

---

## API Endpoints

For integration with external tools or custom dashboards:

### GET /api/metrics

Current metrics snapshot.

```json
{
  "timestamp": 1768813457796,
  "totalTracked": 1234,
  "totalRentLocked": 890.5,
  "totalReclaimedLamports": 45200000000,
  "totalStillLocked": 845300000000,
  "reclaimableCount": 1000,
  "skippedCount": 234,
  "confirmedCount": 45,
  "failedCount": 12
}
```

### GET /api/accounts

List of all indexed accounts with current status.

```json
{
  "value": [
    {
      "publicKey": "6qNzjnzjDPmqMLhx1wbBWXEyuZ5EpwJnZZpQaZRvkrz",
      "status": "reclaimable",
      "accountType": "System",
      "owner": "11111111111111111111111111111111",
      "rentLamports": 890880,
      "reason": "Eligible for reclaim",
      "lastActivity": 1768813120,
      "reclaimedAmount": 0
    }
  ],
  "Count": 1
}
```

### GET /api/timeline

Recent activity events.

```json
{
  "value": [
    {
      "timestamp": 1768813120,
      "action": "INDEXED",
      "account": "6qNzjnzjDPmqMLhx1wbBWXEyuZ5EpwJnZZpQaZRvkrz",
      "details": {
        "rent": 890880
      }
    }
  ]
}
```

### GET /api/warnings

System warnings (if any).

```json
{
  "value": [],
  "Count": 0
}
```

### GET /api/audit-summary

Summary counts from audit log.

```json
{
  "INDEXED": 1234,
  "ANALYZED": 1234,
  "RECLAIM_CONFIRMED": 45,
  "RECLAIM_FAILED": 12
}
```

---

## Dashboard Configuration

Edit `config.json` to customize dashboard behavior:

```json
{
  "dashboard": {
    "enabled": true,
    "port": 3000,
    "host": "localhost"
  },
  "auditLogPath": "./data/audit-log.json",
  "indexPath": "./data/indexed-accounts.json"
}
```

| Setting | Default | Description |
|---------|---------|-------------|
| `enabled` | `true` | Enable/disable dashboard server |
| `port` | `3000` | HTTP port for web UI |
| `host` | `localhost` | Bind address (use `0.0.0.0` for network access) |

---

## Production Setup

### Security Considerations

⚠️ **IMPORTANT**: The dashboard exposes sensitive information about your operations.

**For Development:**
```bash
# Safe - localhost only
node dist/cli.js dashboard --config config.json --host localhost --port 3000
```

**For Production (Behind Firewall):**
```bash
# Set up nginx reverse proxy with TLS
node dist/cli.js dashboard --config config.json --host 127.0.0.1 --port 3000

# nginx config:
# upstream dashboard {
#   server 127.0.0.1:3000;
# }
# server {
#   listen 443 ssl http2;
#   server_name dashboard.example.com;
#   
#   ssl_certificate /etc/letsencrypt/live/dashboard.example.com/fullchain.pem;
#   ssl_certificate_key /etc/letsencrypt/live/dashboard.example.com/privkey.pem;
#   
#   location / {
#     proxy_pass http://dashboard;
#     proxy_set_header X-Real-IP $remote_addr;
#   }
# }
```

**Restrict Access:**
- Use firewall rules to limit access by IP
- Implement HTTP Basic Auth if no reverse proxy
- Log all dashboard accesses for compliance
- Use VPN for remote access

### Running as Systemd Service

Create `/etc/systemd/system/kora-dashboard.service`:

```ini
[Unit]
Description=Kora Rent Reclaim Dashboard
After=network.target

[Service]
Type=simple
User=kora
WorkingDirectory=/opt/kora-rent-reclaim-bot
ExecStart=/usr/bin/node dist/cli.js dashboard --config config.json --host 127.0.0.1
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable kora-dashboard
sudo systemctl start kora-dashboard

# Monitor
sudo systemctl status kora-dashboard
sudo journalctl -u kora-dashboard -f
```

---

## Troubleshooting

### Dashboard shows "Loading..." indefinitely

**Cause:** API endpoint not responding

**Solution:**
```bash
# Check if dashboard is running
curl http://localhost:3000/api/metrics

# Check logs
tail -f logs/bot.log | grep dashboard

# Restart dashboard
# Kill existing process and restart
```

### Accounts not showing up in dashboard

**Cause:** No accounts indexed yet

**Solution:**
```bash
# Run index command
node dist/cli.js index --import accounts-to-track.json

# Watch dashboard update
```

### Status showing "Pending analysis" for all accounts

**Cause:** Analyze command hasn't been run yet

**Solution:**
```bash
# Run analyze
node dist/cli.js analyze

# Dashboard will update within 10 seconds
```

### Can't access dashboard from another machine

**Cause:** Bound to localhost, not accessible over network

**Solution:**
```bash
# Start with 0.0.0.0 (must be behind firewall!)
node dist/cli.js dashboard --config config.json --host 0.0.0.0

# Access from another machine
# http://<server-ip>:3000
```

### Dashboard shows old data

**Cause:** Auto-refresh hasn't run yet (updates every 10 seconds)

**Solution:**
```bash
# Manually refresh in browser: Ctrl+R or Cmd+R
# Or wait 10 seconds for auto-refresh
```

---

## Why Read-Only?

The dashboard is **intentionally read-only** for safety:

✅ **Why this is good:**
- Prevents accidental fund loss from UI misclicks
- Ensures all transactions are explicit and auditable
- Separates monitoring (dashboard) from execution (CLI)
- Requires deliberate, intentional actions

❌ **What you CAN'T do in dashboard:**
- Execute reclaims
- Modify configuration
- Change treasury address
- Sign transactions

✅ **What you CAN do in dashboard:**
- Monitor all operations
- View account status
- Check metrics and progress
- Review audit trail
- Export data via API

**To execute reclaims, use CLI:**
```bash
node dist/cli.js reclaim --config config.json
```

---

## Related Documentation

- [GETTING_STARTED.md](./GETTING_STARTED.md) — 5-minute setup guide
- [ARCHITECTURE.md](./ARCHITECTURE.md) — System design and components
- [TESTING_AND_REALTIME_OPS.md](./TESTING_AND_REALTIME_OPS.md) — Operation procedures
- [PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md) — Production checklist

---

**Last Updated:** 2026-01-19 | **Maintained by:** Kora Team
