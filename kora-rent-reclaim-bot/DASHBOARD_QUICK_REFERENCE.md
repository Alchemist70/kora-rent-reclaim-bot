# Dashboard Quick Reference

## Starting the Dashboard

```bash
# Default: http://localhost:3000
node dist/cli.js dashboard --config config.json

# Custom port
node dist/cli.js dashboard --config config.json --port 8080

# Network accessible (behind firewall only!)
node dist/cli.js dashboard --config config.json --host 0.0.0.0 --port 3000
```

## Key Commands

| Operation | Command |
|-----------|---------|
| **Index Accounts** | `npm start -- index --import accounts-to-track.json` |
| **Analyze Accounts** | `npm start -- analyze` |
| **Reclaim Rent** | `npm start -- reclaim` |
| **Start Dashboard** | `npm start -- dashboard` |
| **View Help** | `npm start -- dashboard --help` |

## Dashboard Sections

| Section | What It Shows | Update Frequency |
|---------|--------------|------------------|
| **Metrics Cards** | Total tracked, locked, reclaimed, still locked | Every 10 seconds |
| **Accounts Table** | Account status, rent, reason, reclaim status | Every 10 seconds |
| **Timeline Chart** | Account activity over time (indexed, analyzed, reclaimed) | Every 10 seconds |
| **Audit Log** | Summary counts (Indexed, Analyzed, Reclaimed, Failed) | Every 10 seconds |
| **Warnings Panel** | System issues or warnings (if any) | Every 10 seconds |

## Understanding Account Status

```
Status Flow:
INDEXED → ANALYZED → RECLAIMABLE (or SKIPPED)
                            ↓
                      RECLAIMED (or FAILED)
```

| Status | Color | Meaning |
|--------|-------|---------|
| `reclaimable` | 🟢 | Can be reclaimed |
| `skipped` | 🟡 | Not eligible (too recent, PDA, etc.) |
| `reclaimed` | ✅ | Successfully reclaimed |
| `failed` | ❌ | Reclaim transaction failed |
| `active` | ⏳ | Awaiting analysis |

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Dashboard won't start | Check port not in use: `netstat -tuln` |
| "Loading..." won't stop | Restart dashboard, check RPC connection |
| Accounts show "Pending analysis" | Run analyze command: `npm start -- analyze` |
| Can't access from another machine | Start with `--host 0.0.0.0` (behind firewall!) |
| Old data showing | Wait 10 seconds (auto-refresh) or press Ctrl+R |

## API Endpoints

```bash
# Metrics
curl http://localhost:3000/api/metrics

# Accounts list
curl http://localhost:3000/api/accounts

# Timeline events
curl http://localhost:3000/api/timeline

# System warnings
curl http://localhost:3000/api/warnings

# Audit log summary
curl http://localhost:3000/api/audit-summary
```

## Documentation

- 📖 **Full Dashboard Guide**: [docs/DASHBOARD_GUIDE.md](./docs/DASHBOARD_GUIDE.md)
- 🚀 **Quick Start Setup**: [GETTING_STARTED.md](./GETTING_STARTED.md)
- 📋 **All Docs Index**: [DOCUMENTATION_INDEX.txt](./DOCUMENTATION_INDEX.txt)
- ⚙️ **Architecture**: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)

## Dashboard Design Philosophy

✅ **Intentionally Read-Only**
- Prevents accidental fund loss from UI clicks
- All transactions execute via CLI (explicit consent)
- Separates monitoring from execution
- Ensures audit trail of all actions

✅ **Real-Time Monitoring**
- Updates every 10 seconds
- Complete account status visibility
- Audit trail of all operations
- API access for integrations

✅ **Production Ready**
- Runs behind nginx reverse proxy
- Supports authentication via reverse proxy
- Logs all access for compliance
- Scales to thousands of accounts

## Configuration

Edit `config.json`:

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

---

**Last Updated**: 2026-01-19 | For more info see [docs/DASHBOARD_GUIDE.md](./docs/DASHBOARD_GUIDE.md)
