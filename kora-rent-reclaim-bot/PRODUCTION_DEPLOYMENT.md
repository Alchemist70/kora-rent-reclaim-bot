# Production Deployment Guide

**Last Updated:** January 19, 2026  
**Status:** Ready for Production  
**TypeScript Strict Mode:** ✅ Enabled  
**Build Errors:** 0

## Prerequisites

### Infrastructure
- Linux server or containerized environment
- At least 1GB RAM (2GB recommended)
- Private Solana RPC endpoint (Helius, Triton, Alchemy, or self-hosted)
- Secure secret storage (AWS Secrets Manager, HashiCorp Vault, or HSM)
- Log aggregation service (CloudWatch, DataDog, ELK, or Splunk)
- Monitoring/alerting system (PagerDuty, OpsGenie, or similar)

### Credentials & Keys
- Solana keypair (JSON format, stored securely)
- Treasury address (verified 5+ times)
- Telegram bot token (from @BotFather)
- Telegram chat ID (your team's private group)
- RPC endpoint credentials (if using API key)

### Team Access
- On-call rotation setup
- Runbook documentation
- Escalation procedures
- Audit log access for compliance

## Step 1: Environment Setup

### Clone Repository
```bash
cd /opt
git clone https://github.com/your-org/kora-rent-reclaim-bot.git
cd kora-rent-reclaim-bot
npm install
npm run build
```

### Create Data Directory
```bash
mkdir -p /var/lib/bot-data
chmod 700 /var/lib/bot-data
```

### Create Secrets File
Never commit secrets to git. Use environment variables:

```bash
# Create .env (add to .gitignore)
cat > /opt/kora-rent-reclaim-bot/.env << 'EOF'
# RPC Configuration
SOLANA_RPC_URL="https://your-private-rpc.example.com"

# Keypair & Treasury
KEYPAIR_PATH="/secure/vault/keypair.json"
TREASURY_ADDRESS="YOUR_TREASURY_PUBKEY"

# Telegram Alerts
TELEGRAM_BOT_TOKEN="YOUR_BOT_TOKEN"
TELEGRAM_CHAT_ID="YOUR_CHAT_ID"

# Data Directory
DATA_DIR="/var/lib/bot-data"
EOF

chmod 600 /opt/kora-rent-reclaim-bot/.env
```

### Load Environment
```bash
source /opt/kora-rent-reclaim-bot/.env
```

## Step 2: Configuration

Copy production template:
```bash
cp config.prod.example.json config.prod.json
```

This config uses environment variables (no hardcoded secrets). Key settings for production:

- `cluster: "mainnet-beta"` — Mainnet deployment
- `dryRun: false` — Live mode (submits real transactions)
- `logLevel: "info"` — Less verbose than debug
- `telegram.enabled: true` — Alerts enabled
- `telegram.alerts.reclaimThreshold: 0.5` — Only alert on significant amounts
- `minInactivitySlots: 1000000` — ~2.5 days on mainnet
- `maxRetries: 5` — More resilient to network issues

## Step 3: Test Connection

Before running live, test everything:

```bash
# Test Telegram connection
npm start -- test-telegram --config config.prod.json

# Expected output:
# ✓ Telegram connection test successful
# ✅ Alerts will be sent to your Telegram chat
```

## Step 4: Set Up Monitoring

### Application Logging

Configure log shipping to external service:

```bash
# Example: CloudWatch
npm install aws-sdk

# Then update logging to ship to CloudWatch
```

### Health Checks

Create a monitoring script:

```bash
#!/bin/bash
# check_bot_health.sh

# Check if bot process is running
if ! pgrep -f "npm start -- reclaim" > /dev/null; then
  echo "Bot is down!"
  curl -X POST -H 'Content-type: application/json' \
    --data '{"text":"🚨 Bot is down - immediate attention needed"}' \
    YOUR_SLACK_WEBHOOK_URL
fi

# Check audit log was updated recently
LAST_MODIFIED=$(stat -f %m /var/lib/bot-data/audit-log.json 2>/dev/null || stat -c %Y /var/lib/bot-data/audit-log.json)
CURRENT_TIME=$(date +%s)
TIME_DIFF=$((CURRENT_TIME - LAST_MODIFIED))

if [ $TIME_DIFF -gt 86400 ]; then  # 24 hours
  echo "Audit log not updated in 24 hours"
  curl -X POST -H 'Content-type: application/json' \
    --data '{"text":"⚠️ Bot may not be running - audit log stale"}' \
    YOUR_SLACK_WEBHOOK_URL
fi
```

Add to crontab:
```bash
*/5 * * * * /opt/kora-rent-reclaim-bot/check_bot_health.sh
```

## Step 5: Deploy with Systemd

Create service file:

```bash
sudo tee /etc/systemd/system/kora-bot.service > /dev/null << 'EOF'
[Unit]
Description=Solana Kora Rent Reclaim Bot
After=network.target

[Service]
Type=simple
User=solana
WorkingDirectory=/opt/kora-rent-reclaim-bot
EnvironmentFile=/opt/kora-rent-reclaim-bot/.env
ExecStart=/usr/bin/npm start -- reclaim --config config.prod.json
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

# Resource limits
MemoryLimit=2G
CPUQuota=50%

[Install]
WantedBy=multi-user.target
EOF
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable kora-bot
sudo systemctl start kora-bot
sudo systemctl status kora-bot
```

Check logs:
```bash
sudo journalctl -u kora-bot -f
```

## Step 6: Backup Strategy

### Automated Backups

Create backup script:

```bash
#!/bin/bash
# backup_bot_data.sh

BACKUP_DIR="/backups/bot"
DATA_DIR="/var/lib/bot-data"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup
mkdir -p $BACKUP_DIR
tar -czf $BACKUP_DIR/bot-data-$DATE.tar.gz $DATA_DIR/

# Upload to S3
aws s3 cp $BACKUP_DIR/bot-data-$DATE.tar.gz s3://your-backup-bucket/bot/

# Keep only last 7 days
find $BACKUP_DIR -name "bot-data-*.tar.gz" -mtime +7 -delete
```

Add to crontab (daily at 2 AM):
```bash
0 2 * * * /opt/kora-rent-reclaim-bot/backup_bot_data.sh
```

### Disaster Recovery

Test recovery monthly:
```bash
# 1. Stop bot
sudo systemctl stop kora-bot

# 2. Restore from backup
LATEST=$(ls -t /backups/bot/bot-data-*.tar.gz | head -1)
tar -xzf $LATEST -C /

# 3. Verify data
cat /var/lib/bot-data/audit-log.json | tail -20

# 4. Start bot
sudo systemctl start kora-bot
```

## Step 7: Monitoring & Alerting

### Dashboard Access

If using remote dashboard access:

```bash
# Nginx reverse proxy config
upstream kora_bot {
    server localhost:3000;
}

server {
    listen 443 ssl;
    server_name bot.yourcompany.com;
    
    ssl_certificate /etc/ssl/certs/your-cert.crt;
    ssl_certificate_key /etc/ssl/private/your-key.key;
    
    # Restrict to office IPs only
    allow 203.0.113.0/24;      # Your office IP range
    allow 198.51.100.0/24;     # Your VPN IP range
    deny all;
    
    location / {
        proxy_pass http://kora_bot;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Restart nginx:
```bash
sudo systemctl restart nginx
```

### Alert Rules

Set up alerts for:

1. **Bot Down** (critical)
   - If process not running for > 5 minutes
   - Escalate to on-call immediately

2. **Audit Log Stale** (warning)
   - If audit log not updated in > 24 hours
   - Check manually within 1 hour

3. **Reclaim Failures** (warning)
   - If > 3 failures in a row
   - Check RPC endpoint health

4. **High Error Rate** (critical)
   - If error rate > 5%
   - Investigate logs immediately

## Step 8: Runbook

### Normal Operation
```bash
# Start reclaim cycle
sudo systemctl start kora-bot

# Monitor (in new terminal)
sudo journalctl -u kora-bot -f

# Check dashboard
open https://bot.yourcompany.com
```

### Troubleshooting

**Bot won't start:**
```bash
# Check config syntax
npm run build
npx ts-node src/cli.ts test-telegram --config config.prod.json

# Check logs
sudo journalctl -u kora-bot -n 100
```

**No reclaims happening:**
```bash
# Verify RPC connection
curl $SOLANA_RPC_URL (should get JSON response)

# Check indexed accounts
cat /var/lib/bot-data/indexed-accounts.json | jq 'length'

# Run manual analysis
npm start -- analyze --config config.prod.json
```

**Telegram alerts not working:**
```bash
# Test connection
npm start -- test-telegram --config config.prod.json

# Check token and chat ID in config
grep -A5 "telegram" config.prod.json
```

### Emergency Stop
```bash
# Immediate shutdown
sudo systemctl stop kora-bot

# Verify stopped
sudo systemctl status kora-bot
```

## Step 9: Documentation

### Maintenance Log

Keep a log of all operations:

```
2024-01-20 10:30 - Deployed v1.0.0 to production
2024-01-20 11:45 - Reclaimed 2.5 SOL from 3 accounts
2024-01-21 02:00 - Routine backup completed successfully
2024-01-21 14:30 - Updated indexed accounts list (50 new accounts)
```

### Contact List

Keep updated:
- Primary on-call engineer
- Secondary on-call engineer
- DevOps/SRE contact
- Solana RPC provider support
- Telegram bot admin

### Escalation Procedures

1. **Minor Issues** (non-critical)
   - Alert to on-call
   - Investigate during business hours

2. **Major Issues** (bot down, data loss risk)
   - Alert to on-call immediately
   - Page secondary if primary doesn't respond in 5 min
   - Start incident response

3. **Critical Issues** (security, mainnet fund loss)
   - Immediate page all
   - Stop bot immediately
   - Page DevOps/infrastructure team
   - Call CTO/lead engineer

## Security Checklist

- [ ] Keypair file permissions: `chmod 600 keypair.json`
- [ ] Config files excluded from git: `.gitignore`
- [ ] Environment variables used for all secrets
- [ ] Backup encrypted and stored securely
- [ ] Dashboard access restricted to trusted IPs
- [ ] HTTPS/TLS enabled for all remote access
- [ ] Audit logs shipped to immutable storage
- [ ] Regular security updates applied
- [ ] 2FA enabled on all admin accounts
- [ ] VPN/bastion host for server access

## Performance Tuning

### For Large-Scale Operations (1000+ accounts)

**Increase resource allocation:**
```bash
# In kora-bot.service, increase:
MemoryLimit=4G
CPUQuota=100%
```

**Batch processing optimization:**
```json
{
  "maxRetries": 5,
  "retryDelayMs": 1000,
  "minInactivitySlots": 500000
}
```

**RPC Optimization:**
- Use private endpoint with higher rate limits
- Consider multiple RPC endpoints for redundancy
- Monitor RPC node health continuously

### Monitoring Metrics

Track these metrics:
- Reclaims per day
- Average reclaim amount
- Transaction fee percentage
- Error rate by type
- RPC latency
- Bot uptime percentage

## Support & Troubleshooting

See documentation:
- [README.md](../README.md) — Overview and architecture
- [GETTING_STARTED.md](../GETTING_STARTED.md) — Setup guide
- [TESTING_AND_REALTIME_OPS.md](../TESTING_AND_REALTIME_OPS.md) — Testing procedures
- [TELEGRAM_ALERTING_IMPLEMENTATION.md](../TELEGRAM_ALERTING_IMPLEMENTATION.md) — Alert configuration

## Compliance & Audit

### Audit Trail

All actions recorded in `audit-log.json`:
- Timestamp
- Action type (INDEX, ANALYZE, RECLAIM, etc.)
- Account public key
- Amount
- Transaction signature
- Status

Ship to immutable storage:
```bash
aws s3 cp /var/lib/bot-data/audit-log.json \
  s3://compliance-bucket/audit-logs/$(date +%Y-%m-%d).json \
  --sse AES256
```

### Compliance Reports

Generate monthly:
```bash
npm start -- report > /var/lib/bot-data/monthly-report-$(date +%Y-%m).txt
```

Archive:
```bash
aws s3 cp /var/lib/bot-data/monthly-report-*.txt \
  s3://compliance-bucket/reports/ \
  --sse AES256
```

## Summary

Your production bot is now:
- ✅ Running securely with no hardcoded secrets
- ✅ Monitored and alerting on issues
- ✅ Backed up regularly
- ✅ Logging all actions for audit
- ✅ Accessible via secure dashboard
- ✅ Ready for 24/7 operation

**Next Steps:**
1. Run on testnet-beta for 1+ week
2. Monitor carefully for issues
3. Scale to mainnet when confident
4. Document any custom modifications

---

**Questions?** See [README.md](../README.md) or open an issue on GitHub.
