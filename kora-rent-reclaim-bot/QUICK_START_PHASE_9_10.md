# Quick Start: Phase 9 & 10 Integration

This guide shows how to enable and use the dashboard and alerting features.

## 5-Minute Setup

### Step 1: Enable Features in Config

Edit `config.json`:

```json
{
  "rpcUrl": "https://api.devnet.solana.com",
  "cluster": "devnet",
  "keypairPath": "./keypair.json",
  "treasuryAddress": "11111111111111111111111111111111",
  "indexPath": "./data/indexed-accounts.json",
  "auditLogPath": "./data/audit-log.json",
  "minInactivitySlots": 100000,
  
  "dashboard": {
    "enabled": true,
    "port": 3000,
    "host": "localhost"
  },
  
  "telegram": {
    "enabled": true,
    "botToken": "YOUR_TELEGRAM_BOT_TOKEN",
    "chatId": "YOUR_TELEGRAM_CHAT_ID",
    "alerts": {
      "reclaimThreshold": 0.1,
      "idleThreshold": 0.5
    }
  }
}
```

### Step 2: Get Telegram Credentials (Optional)

1. Open Telegram → Search @BotFather
2. Send `/newbot` → Follow prompts → Copy **Bot Token**
3. Message your new bot → Visit `https://api.telegram.org/bot<TOKEN>/getUpdates`
4. Find "chat":{"id": **YOUR_CHAT_ID**}

### Step 3: Run the Bot

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Index your accounts
npx ts-node src/cli.ts index --import accounts.json --config config.json

# Start dashboard in one terminal
npx ts-node src/cli.ts dashboard --config config.json

# Run analysis/reclaim in another terminal
npx ts-node src/cli.ts reclaim --dry-run true --config config.json
```

### Step 4: Monitor Operations

- **Dashboard**: Open http://localhost:3000
- **Alerts**: Check Telegram for notifications

## What You'll See

### Dashboard (http://localhost:3000)

```
┌─────────────────────────────────────────────┐
│  Solana Rent Reclaim Bot Dashboard         │
└─────────────────────────────────────────────┘

📊 METRICS
├─ Total Tracked: 150
├─ Locked Rent: 5.25 SOL
├─ Reclaimed: 2.10 SOL
└─ Idle Accounts: 45

📈 STATUS
├─ Reclaimable: 45
├─ Reclaimed: 75
├─ Skipped: 30
└─ Failed: 5

📅 TABS
├─ Timeline (30-day chart)
├─ Accounts (searchable table)
└─ Warnings (system alerts)

🔍 AUDIT SUMMARY
├─ Indexed: 150
├─ Analyzed: 145
├─ Approved: 120
├─ Reclaimed: 75
├─ Skipped: 30
└─ Failed: 5
```

### Telegram Alerts

```
✅ Rent Reclaimed
🟢 INFO

Account: `EPjFWaLb...`
Rent Recovered: 0.1234 SOL
Tx: `5hq3Pw3Z...`

14:32:15
```

```
⏰ Idle Rent Detected
🟡 WARNING

Account: `Kx9mP2w...`
Rent Amount: 0.5500 SOL
Idle for 5 days
Status: Eligible for reclaim

14:35:22
```

```
❌ Reclaim Failed
🔴 CRITICAL

Account: `2PqwQ8x...`
Reason: Safety check failed
Error: Unknown program type

14:38:45
```

## Common Operations

### Start Only Dashboard

```bash
npx ts-node src/cli.ts dashboard --config config.json
# Open http://localhost:3000
```

### Run Reclaim with Alerts

```bash
npx ts-node src/cli.ts reclaim --config config.json
# Alerts sent automatically to Telegram
# Dashboard updates in real-time
```

### Run Analysis with Dashboard Monitoring

```bash
# Terminal 1: Start dashboard
npx ts-node src/cli.ts dashboard --config config.json

# Terminal 2: Run analysis
npx ts-node src/cli.ts analyze --config config.json
# Watch dashboard update with results
```

### Custom Dashboard Port

```bash
npx ts-node src/cli.ts dashboard --config config.json --port 8080
# Open http://localhost:8080
```

## API Endpoints

If you want to integrate dashboard data into your own tools:

```bash
# Get metrics
curl http://localhost:3000/api/metrics

# Get accounts
curl http://localhost:3000/api/accounts | jq '.' | head -20

# Get timeline events
curl http://localhost:3000/api/timeline

# Get warnings
curl http://localhost:3000/api/warnings

# Get audit summary
curl http://localhost:3000/api/audit-summary

# Health check
curl http://localhost:3000/health
```

## Troubleshooting

### Dashboard Won't Start

```bash
# Check if port 3000 is in use
netstat -ano | findstr :3000

# Use different port
npx ts-node src/cli.ts dashboard --port 8080
```

### No Telegram Alerts

1. Verify token and chat ID are correct
2. Check `telegram.enabled: true`
3. Check logs for errors
4. Test connection: Send `/start` to your bot

### Dashboard Shows No Data

1. Ensure accounts have been indexed:
   ```bash
   npx ts-node src/cli.ts index --import accounts.json
   ```

2. Check files exist:
   ```bash
   ls -la data/audit-log.json
   ls -la data/indexed-accounts.json
   ```

## Advanced Configuration

### Disable Dashboard, Enable Alerts

```json
{
  "dashboard": {
    "enabled": false
  },
  "telegram": {
    "enabled": true,
    "botToken": "YOUR_TOKEN",
    "chatId": "YOUR_ID"
  }
}
```

### Enable Dashboard, Disable Alerts

```json
{
  "dashboard": {
    "enabled": true,
    "port": 3000
  },
  "telegram": {
    "enabled": false
  }
}
```

### Run on Remote Server

```bash
# Start dashboard on 0.0.0.0 (all interfaces)
npx ts-node src/cli.ts dashboard --config config.json --host 0.0.0.0

# Access from another machine
# http://remote-server-ip:3000
```

### Docker Deployment

```dockerfile
FROM node:18
WORKDIR /app
COPY . .
RUN npm install && npm run build
EXPOSE 3000
CMD ["npx", "ts-node", "src/cli.ts", "dashboard", "--config", "config.json"]
```

```bash
docker build -t reclaim-dashboard .
docker run -p 3000:3000 -v $(pwd)/config.json:/app/config.json reclaim-dashboard
```

## Next Steps

1. **Monitor**: Keep dashboard open while running operations
2. **Adjust Thresholds**: Increase/decrease alert thresholds based on your needs
3. **Automate**: Add cron jobs or systemd services for regular operations
4. **Backup**: Archive audit logs and account indices regularly
5. **Scale**: Add multiple bots with different configurations

## Documentation

For more details, see:
- [Phase 9: Dashboard](../docs/PHASE_9_DASHBOARD.md)
- [Phase 10: Alerting](../docs/PHASE_10_ALERTING.md)
- [Full Completion Guide](../PHASE_9_10_COMPLETION.md)

## Support

- Check logs: `grep -i error logs/*.log`
- Review audit trail: `cat data/audit-log.json | jq '.'`
- Test endpoints: `curl http://localhost:3000/api/metrics`

---

**You're all set!** Start the dashboard and begin monitoring your Kora reclaim operations.
