# Telegram Alerting System

Short note: Alerts are tuned to reduce noise — they trigger on meaningful events. If you need custom rules, the examples below will help.

**For Production Alert Routing:** See [Production Alert Routing](#production-alert-routing) section below.

## Overview

The Telegram alerting system sends you alerts when important stuff happens with your bot. Reclaims succeed? You get a ping. Something fails? You know immediately.

## Features

You'll get notified about:

## Setup

### 1. Create a Telegram Bot

1. Open Telegram and search for `@BotFather`
2. Send `/newbot` command
3. Follow the prompts to create a new bot
4. Copy the **Bot Token** (e.g., `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`)

### 2. Get Your Chat ID

1. Start a chat with your new bot
2. Send any message to the bot
3. Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
4. Replace `<YOUR_BOT_TOKEN>` with your actual token
5. Look for `"chat":{"id":1234567890}` - that's your **Chat ID**

Alternatively, use the command-line approach:
```bash
# Get updates for your bot
curl "https://api.telegram.org/bot<TOKEN>/getUpdates"
```

### 3. Update Configuration

Edit `config.json`:

```json
{
  "telegram": {
    "enabled": true,
    "botToken": "YOUR_BOT_TOKEN",
    "chatId": "YOUR_CHAT_ID",
    "alerts": {
      "reclaimThreshold": 0.1,
      "idleThreshold": 0.5,
      "dailySummary": false
    }
  }
}
```

**Configuration Options:**

- `enabled` (boolean): Enable/disable Telegram alerting
- `botToken` (string): Bot token from BotFather
- `chatId` (string): Your Telegram chat ID
- `reclaimThreshold` (number, SOL): Minimum amount to alert on successful reclaim
- `idleThreshold` (number, SOL): Minimum idle amount to alert on detection
- `dailySummary` (boolean): Send daily summary (future feature)

### 4. Test Connection

```bash
npx ts-node src/cli.ts test-telegram --config config.json
```

You should receive a confirmation message in Telegram.

## Production Alert Routing

In production, you'll likely need alerts routed to multiple people/channels and severity-based routing.

### Multi-Channel Setup

Create separate bots for different severity levels:

```json
{
  "telegram": {
    "enabled": true,
    "channels": {
      "critical": {
        "botToken": "critical_bot_token",
        "chatId": "ops_team_group_id",
        "includeSeverities": ["ERROR", "CRITICAL"]
      },
      "warnings": {
        "botToken": "warnings_bot_token",
        "chatId": "team_channel_id",
        "includeSeverities": ["WARNING", "INFO"]
      },
      "debug": {
        "botToken": "debug_bot_token",
        "chatId": "debug_channel_id",
        "includeSeverities": ["DEBUG", "TRACE"]
      }
    }
  }
}
```

### Team Group vs. Channel

**Use a Private Group For:**
- Critical alerts (bot down, high failures)
- Team discussions and runbooks
- On-call rotation discussions

**Use a Channel For:**
- General info (reclaims, metrics)
- Audit trail (immutable record)
- Read-only summaries

### Alert Suppression During Maintenance

Create a maintenance mode to prevent alert noise:

```json
{
  "telegram": {
    "maintenance": {
      "enabled": false,
      "startTime": "2024-01-20 02:00:00",
      "endTime": "2024-01-20 03:00:00",
      "suppressedAlerts": ["INFO", "DEBUG"]
    }
  }
}
```

### Integration with PagerDuty (Enterprise)

Route critical alerts through PagerDuty:

```bash
# Use a webhook bridge to convert Telegram alerts to PagerDuty
# This requires an intermediate service or custom integration

# Option 1: Use AlertManager + PagerDuty integration
# Option 2: Custom webhook handler that routes to PagerDuty API
# Option 3: Use Telegram bot that forwards to PagerDuty via webhook
```

## Alert Types

### ✅ Rent Reclaimed

Triggered when a reclaim transaction is confirmed and the amount exceeds `reclaimThreshold`.

```
✅ Rent Reclaimed
🟢 INFO

Account: `7Qr1...`
Rent Recovered: 0.1234 SOL
Tx: `5hq3P...`

14:32:15
```

### ⏰ Idle Rent Detected

Triggered when accounts are found with idle rent above `idleThreshold`.

```
⏰ Idle Rent Detected
🟡 WARNING

Account: `Kx9m...`
Rent Amount: 0.7500 SOL
Idle for 5 days
Status: Eligible for reclaim

14:32:15
```

### ❌ Reclaim Failed

Triggered immediately when a reclaim transaction fails.

```
❌ Reclaim Failed
🔴 CRITICAL

Account: `2Pqw...`
Reason: Safety check failed
Error: Unknown program type

14:32:15
```

### 🛡️ Safety Check Failed

Triggered when an account fails multiple safety checks.

```
🛡️ Safety Check Failed
🟡 WARNING

Account: `Tx8k...`
Failed Checks:
• PDA account (cannot close)
• Unknown program

14:32:15
```

### 🚨 System Error

Triggered on operational issues like RPC failures or transaction errors.

```
🚨 System Error
🔴 CRITICAL

Operation: fetch_account
Error: Connection timeout
Please check logs for details

14:32:15
```

## Integration with Bot

The alerting system is integrated throughout the bot's operations:

### CLI Usage

#### Start Bot as Dedicated Telegram Responder
```bash
npm start -- start-bot --config config.json
```
Starts only Telegram polling to listen for commands: `/start`, `/testconnection`, `/status`

#### Run with Dashboard
```bash
npm start -- dashboard --config config.json
```
Runs dashboard + Telegram polling simultaneously.

#### Run with Reclaim Flow
```bash
npx ts-node src/cli.ts reclaim --config config.json
```
Alerts are sent automatically during reclaim operations.

#### Test Telegram Connection
```bash
npm start -- test-telegram --config config.json
```

### Programmatic Usage

```typescript
import { initializeAlertService } from './src/alerting/telegramAlertService';

const alertService = initializeAlertService({
  enabled: true,
  botToken: process.env.TELEGRAM_BOT_TOKEN,
  chatId: process.env.TELEGRAM_CHAT_ID,
  alerts: {
    reclaimThreshold: 0.1,
    idleThreshold: 0.5
  }
});

// Start polling to respond to commands
alertService.startPolling();

// Send alert
await alertService.alertRentReclaimed(
  'EPjFWaLb3odcccccccccccccccccccccccccccccccccc',
  0.1234,
  '5hq3Pw3zVDnqVfpqxVEqvzJ8W9...'
);
```

## API Reference

### TelegramAlertService

Main service class for sending alerts.

#### Methods

**`isEnabled(): boolean`**
Check if alerts are enabled and configured.

**`sendAlert(alert: Alert): Promise<boolean>`**
Send a custom alert to Telegram.

```typescript
await alertService.sendAlert({
  type: AlertType.RENT_RECLAIMED,
  severity: AlertSeverity.INFO,
  title: '✅ Rent Reclaimed',
  message: 'Account XYZ: 0.5 SOL',
  timestamp: new Date()
});
```

**`alertRentReclaimed(account, amountSol, txSignature): Promise<boolean>`**
Alert on successful rent reclaim.

**`alertIdleRentDetected(account, rentAmount, idleDays): Promise<boolean>`**
Alert when idle rent is detected.

**`alertReclaimFailed(account, reason, error): Promise<boolean>`**
Alert when a reclaim fails.

**`alertSafetyCheckFailed(account, checks): Promise<boolean>`**
Alert when safety checks fail.

**`sendAnalysisSummary(totalAnalyzed, reclaimable, rentAmount): Promise<boolean>`**
Send analysis completion summary.

**`alertSystemError(operation, error): Promise<boolean>`**
Alert on system-level errors.

**`testConnection(): Promise<boolean>`**
Test Telegram API connection.

## Best Practices

### 1. Set Appropriate Thresholds

Start with conservative thresholds:
- `reclaimThreshold`: 0.1 SOL (avoids spam for small reclaims)
- `idleThreshold`: 0.5 SOL (focuses on significant amounts)

Adjust based on your operational needs.

### 2. Use Categories for Multiple Bots

If running multiple bots, create separate Telegram bots and chats:

```json
{
  "telegram": {
    "botToken": "devnet-bot-token",
    "chatId": "devnet-chat-id"
  }
}
```

### 3. Monitor Alert Patterns

Watch for patterns in alerts:
- Repeated failures → investigate common issues
- Unusual idle amounts → potential configuration problems
- System errors → check RPC connectivity

### 4. Handle Alert Fatigue

If alerts are too frequent:
- Increase `reclaimThreshold`
- Increase `idleThreshold`
- Consider reducing alert frequency

### 5. Security Considerations

**Never share your bot token or chat ID:**
- Add to `.gitignore`:
  ```
  config.json
  config.*.json
  ```

- Use environment variables in production:
  ```bash
  TELEGRAM_BOT_TOKEN=xxx TELEGRAM_CHAT_ID=yyy npx ts-node src/cli.ts reclaim
  ```

- Load from secure environment:
  ```json
  {
    "telegram": {
      "botToken": "${TELEGRAM_BOT_TOKEN}",
      "chatId": "${TELEGRAM_CHAT_ID}"
    }
  }
  ```

## Troubleshooting

### "Failed to send Telegram alert"

**Causes:**
- Invalid bot token
- Invalid chat ID
- Network connectivity issue
- Telegram API rate limiting

**Solutions:**
1. Verify token and chat ID are correct
2. Test connection: `curl "https://api.telegram.org/bot<TOKEN>/getMe"`
3. Check network connectivity
4. Wait a few minutes (rate limit is ~30 msgs/second)

### "No alerts received"

**Causes:**
- Alerting disabled in config
- Threshold filters are too high
- No events matching alert criteria

**Solutions:**
1. Verify `telegram.enabled: true`
2. Lower thresholds to test
3. Check logs for alert filtering messages

### Bot doesn't respond to test

**Causes:**
- Bot token incorrect
- Bot hasn't been started
- Wrong chat ID

**Solutions:**
1. Verify bot was created in BotFather
2. Send a message to the bot first
3. Double-check chat ID format (should be numeric)

## Advanced Configuration

### Environment Variables

```bash
export TELEGRAM_BOT_TOKEN="your-token"
export TELEGRAM_CHAT_ID="your-chat-id"
export TELEGRAM_RECLAIM_THRESHOLD="0.1"
export TELEGRAM_IDLE_THRESHOLD="0.5"
```

Update config to use env vars:

```typescript
const config = {
  telegram: {
    enabled: process.env.TELEGRAM_BOT_TOKEN ? true : false,
    botToken: process.env.TELEGRAM_BOT_TOKEN || "",
    chatId: process.env.TELEGRAM_CHAT_ID || "",
    alerts: {
      reclaimThreshold: parseFloat(process.env.TELEGRAM_RECLAIM_THRESHOLD || "0.1"),
      idleThreshold: parseFloat(process.env.TELEGRAM_IDLE_THRESHOLD || "0.5")
    }
  }
};
```

### Custom Alert Formatting

You can create custom alerts for specific scenarios:

```typescript
// Custom alert for unusual activity
await alertService.sendAlert({
  type: AlertType.ANALYSIS_COMPLETED,
  severity: AlertSeverity.WARNING,
  title: '🔍 Unusual Pattern Detected',
  message: '100+ accounts with same owner detected',
  timestamp: new Date()
});
```

## Integration Examples

### With Existing CLI

Alerts are automatically integrated. Just enable in config:

```bash
npx ts-node src/cli.ts reclaim --config config.json
# Alerts sent automatically on success/failure
```

### With Dashboard

Dashboard displays warning when alerts are not properly configured:

```typescript
// Check in dashboard
if (!alertService.isEnabled()) {
  warnings.push({
    level: 'warning',
    message: 'Telegram alerting not configured'
  });
}
```

### With Custom Scripts

```typescript
import { TelegramAlertService } from './src/alerting/telegramAlertService';

const alerter = new TelegramAlertService({
  enabled: true,
  botToken: 'xxx',
  chatId: 'yyy'
});

// Send alerts from custom logic
for (const result of results) {
  if (result.failed) {
    await alerter.alertReclaimFailed(
      result.account,
      'Custom reason',
      result.error
    );
  }
}
```

## Maintenance

### Regular Checks

1. **Weekly**: Verify alerts are still being received
2. **Monthly**: Review alert patterns and adjust thresholds
3. **Quarterly**: Update Telegram bot settings if needed

### Log Inspection

Check logs for alert delivery:

```bash
# See all alert attempts
grep "Alert sent to Telegram" logs/*.log

# See alert failures
grep "Failed to send Telegram alert" logs/*.log
```

## Summary

The Telegram alerting system provides:
- ✅ Real-time notifications
- ✅ Multiple alert types
- ✅ Customizable thresholds
- ✅ Error handling
- ✅ Security considerations

