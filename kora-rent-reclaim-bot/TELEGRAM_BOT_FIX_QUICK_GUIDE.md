# Telegram Bot Fix - Quick Reference

## What Was Fixed

✅ **Problem**: Bot was receiving commands but not responding  
✅ **Solution**: Added automatic command polling and response handlers  
✅ **Status**: Complete and tested (0 TypeScript errors)

## What Changed

### In `src/alerting/telegramAlertService.ts`:

1. **Added Polling State**
   - Tracks which updates have been processed
   - Manages polling timer lifecycle
   - Handles polling on/off state

2. **Added Polling Loop**
   - Checks Telegram API every 3 seconds
   - Processes incoming messages automatically
   - Runs in background while bot operates

3. **Added Command Handlers**
   - `/start` → Welcome message + command list
   - `/testconnection` → Connection confirmation
   - `/status` → Bot status report
   - Unknown commands → Helpful error message

4. **Automatic Activation**
   - Polling starts when `testConnection()` succeeds
   - No configuration needed
   - Works automatically with existing code

## How to Test

### Step 1: Configure Telegram (if not already done)

Edit `config.json`:
```json
{
  "telegram": {
    "enabled": true,
    "botToken": "YOUR_BOT_TOKEN",      // From BotFather
    "chatId": "YOUR_CHAT_ID",            // From getUpdates API
    "alerts": {
      "reclaimThreshold": 0.1,
      "idleThreshold": 0.5
    }
  }
}
```

### Step 2: Test Connection

```bash
npm start -- test-telegram
```

Expected output:
```
[timestamp] info: ✓ Config loaded successfully
[timestamp] info: Testing Telegram connection...
[timestamp] info: Telegram connection test successful
[timestamp] info: Starting Telegram command polling
✓ Telegram connection test successful

✅ Alerts will be sent to your Telegram chat
```

### Step 3: Send Commands to Bot in Telegram

Open Telegram chat with your bot and send:

```
/start                  ← Shows welcome + command list
/testconnection         ← Confirms bot is connected
/status                 ← Shows bot status
```

Bot should respond instantly!

## The Polling Mechanism

```
┌─────────────────────────────────────┐
│ User Sends Command in Telegram      │
│ (e.g., /start, /testconnection)    │
└─────────────────────┬───────────────┘
                      │
                      ↓
    ┌─────────────────────────────────┐
    │ Polling Loop Detects Command    │
    │ (checks every 3 seconds)        │
    └─────────────────┬───────────────┘
                      │
                      ↓
    ┌─────────────────────────────────┐
    │ Bot Processes Command           │
    │ (handler routes to response)    │
    └─────────────────┬───────────────┘
                      │
                      ↓
    ┌─────────────────────────────────┐
    │ Bot Sends Response              │
    │ (formatted message back to user)│
    └─────────────────┬───────────────┘
                      │
                      ↓
┌─────────────────────────────────────┐
│ User Receives Response in Telegram  │
│ (within 3 seconds of sending)       │
└─────────────────────────────────────┘
```

## Key Features

| Feature | Details |
|---------|---------|
| **Response Speed** | Within 3 seconds (polling interval) |
| **Reliability** | Works behind firewalls (no webhook needed) |
| **Scalability** | Lightweight API calls, ~20/minute when polling |
| **Compatibility** | Works with existing code, no changes needed |
| **Commands** | 3 built-in + support for future custom commands |
| **Logging** | Full debug logging for troubleshooting |

## Command Reference

### `/start`
Shows welcome message and lists available commands

**Response:**
```
👋 Welcome to Solana Rent Reclaim Bot!

This bot sends alerts about rent reclaim operations.

Available commands:
/start - Show this message
/testconnection - Test bot connectivity
/status - Get current bot status
```

### `/testconnection`
Confirms bot is connected and receiving alerts

**Response:**
```
✅ Solana Rent Reclaim Bot is connected!

Status: Online and receiving alerts
```

### `/status`
Shows detailed bot status

**Response:**
```
🔄 Solana Rent Reclaim Bot Status

Status: Online
Connected: Yes
Alerts: Enabled

This bot sends notifications for:
• Rent reclaim events
• Idle rent detection
• System errors
```

## Troubleshooting

### Bot doesn't respond to commands

**Check 1**: Configuration is correct
```bash
npm start -- test-telegram
```
Should show "✓ Telegram connection test successful"

**Check 2**: Bot token and chat ID are valid
- Bot token: Should start with numbers, followed by colon and letters
- Chat ID: Should be a number (e.g., `123456789`)

**Check 3**: Enable debug logging
```json
{
  "logLevel": "debug"
}
```
Then check logs for polling errors.

**Check 4**: Network connectivity
- Verify you can reach `https://api.telegram.org` from your system
- No proxy/firewall blocking Telegram API

### Response is slow (takes more than 5 seconds)

This is expected behavior due to 3-second polling interval:
- Command sent at t=0
- Polled at t=3 (detected)
- Response sent at t=3-4
- **Total: ~3-4 seconds** ✓

To speed up response: Change polling interval in code (advanced)

### Multiple responses to same command

This shouldn't happen. If it does:
1. Check that polling is running only once
2. Restart the bot process
3. Clear Telegram cache on phone

## Files Modified

| File | Changes |
|------|---------|
| `src/alerting/telegramAlertService.ts` | +120 lines (polling + commands) |
| `docs/ALERTING.md` | +30 lines (command documentation) |
| `TELEGRAM_BOT_FIX_SUMMARY.md` | Created (full technical details) |

## Build Status

✅ **TypeScript**: 0 errors  
✅ **Tests**: All passing  
✅ **Compilation**: Success  
✅ **Backward Compatible**: Yes (no breaking changes)

## Next Steps

1. **If already running**: Restart the bot to pick up changes
   ```bash
   npm run build
   npm start -- reclaim-rent
   ```

2. **If first time**: Set up Telegram config and test
   ```bash
   npm start -- test-telegram
   ```

3. **For production**: Enable Telegram alerts in production config and test thoroughly

## Questions?

Refer to:
- **Full Details**: See `TELEGRAM_BOT_FIX_SUMMARY.md`
- **Telegram Setup**: See `docs/ALERTING.md`
- **General Help**: See `GETTING_STARTED.md`

---

**Summary**: Your Telegram bot now responds to commands! It polls for incoming messages every 3 seconds and responds with welcome, connection status, and bot status messages. No changes needed to existing configuration—just rebuild and restart.
