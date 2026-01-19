# Advanced Scheduling & Batch Processing Guide

This guide covers the **Scheduler** and **Batch Processor** modules for automating and optimizing rent reclaim operations.

## Overview

- **Scheduler**: Execute operations on recurring schedules using cron expressions
- **Batch Processor**: Process large account sets efficiently with parallel batching and retry logic

## Table of Contents

1. [Scheduler](#scheduler)
2. [Batch Processor](#batch-processor)
3. [Usage Examples](#usage-examples)
4. [Configuration](#configuration)
5. [Monitoring & Alerts](#monitoring--alerts)
6. [Troubleshooting](#troubleshooting)

---

## Scheduler

### Purpose

The Scheduler enables automated, recurring execution of:
- Account analysis
- Rent reclaim operations
- Report generation

### How It Works

- Uses **node-cron** for cron expression scheduling
- Respects configurable concurrency limits
- Supports retry logic with exponential backoff
- Integrates with Telegram alerts (when configured)

### Command Syntax

```bash
npm start -- schedule \
  --cron <cron-expression> \
  --operation <analyze|reclaim|report> \
  [--dry-run]
```

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `--cron` | string | ✅ | - | Cron expression for schedule |
| `--operation` | string | ✅ | - | Operation to schedule |
| `--config` | string | ❌ | `config.json` | Path to config file |
| `--dry-run` | flag | ❌ | false | Simulate without executing |

### Cron Expression Guide

```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of week (0 - 6) (Sunday to Saturday)
│ │ │ │ │
│ │ │ │ │
* * * * *
```

### Common Cron Patterns

| Pattern | Description | Example |
|---------|-------------|---------|
| `0 2 * * *` | Daily at 2 AM | `--cron '0 2 * * *'` |
| `0 */6 * * *` | Every 6 hours | `--cron '0 */6 * * *'` |
| `0 0 * * 0` | Weekly (Sunday) | `--cron '0 0 * * 0'` |
| `0 0 1 * *` | Monthly (1st) | `--cron '0 0 1 * *'` |
| `*/30 * * * *` | Every 30 minutes | `--cron '*/30 * * * *'` |
| `0 9-17 * * 1-5` | Weekdays 9-5 | `--cron '0 9-17 * * 1-5'` |

### Operations

#### Analyze Operation

Analyze indexed accounts for reclaimability.

```bash
npm start -- schedule --cron '0 2 * * *' --operation analyze
```

**Output**: 
- Analyzes all tracked accounts
- Updates account status
- Logs results to audit log

#### Reclaim Operation

Execute rent reclaims on approved accounts.

```bash
npm start -- schedule --cron '0 */12 * * *' --operation reclaim
```

**Features**:
- Only processes accounts with APPROVED status
- Respects safety checks
- Logs all transactions
- Sends alerts on completion/failure

**Dry-run mode** (simulate without executing):

```bash
npm start -- schedule --cron '0 2 * * *' --operation reclaim --dry-run
```

#### Report Operation

Generate status reports.

```bash
npm start -- schedule --cron '0 0 * * 0' --operation report
```

**Output**:
- Total tracked accounts
- Total rent locked
- Total reclaimed SOL
- Success rate statistics

### Monitoring Scheduled Tasks

Check logs for scheduled execution:

```bash
tail -f logs/bot.log | grep "Scheduler"
```

Typical output:

```
[2025-01-19 14:00:00] info: Executing scheduled operations (0 2 * * *)
[2025-01-19 14:00:01] info: Starting operation: analyze
[2025-01-19 14:00:15] info: ✓ Operation complete: analyze
[2025-01-19 14:00:15] info: Notification sent for: analyze
```

---

## Batch Processor

### Purpose

Efficiently process large numbers of accounts with:
- Configurable batch sizing
- Parallel batch execution
- Automatic retry logic
- Progress tracking and reporting

### How It Works

1. **Batching**: Splits accounts into configurable-sized batches
2. **Parallelism**: Processes multiple batches concurrently
3. **Retry Logic**: Retries failed items with exponential backoff
4. **Progress Tracking**: Real-time progress bar and statistics

### Command Syntax

```bash
npm start -- batch \
  --operation <analyze|reclaim|check> \
  [--batch-size <number>] \
  [--parallelism <number>]
```

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `--operation` | string | ✅ | - | Operation to perform |
| `--batch-size` | number | ❌ | 100 | Items per batch |
| `--parallelism` | number | ❌ | 4 | Concurrent batches |
| `--config` | string | ❌ | `config.json` | Path to config file |

### Operations

#### Analyze Operation

```bash
npm start -- batch --operation analyze --batch-size 50 --parallelism 8
```

Analyzes accounts in batches of 50 with up to 8 concurrent batches.

#### Reclaim Operation

```bash
npm start -- batch --operation reclaim --batch-size 100 --parallelism 4
```

Executes reclaims in batches of 100 with up to 4 concurrent batches.

#### Check Operation

```bash
npm start -- batch --operation check --batch-size 200 --parallelism 6
```

Performs health checks on accounts in parallel batches.

### Output Example

```
📦 Starting batch processing: 500 accounts

  [████████████████████████░░░░░░░░░░░░░░░░░░░] 60.0% (300/500) 45.2 items/s

📊 BATCH PROCESSING SUMMARY
────────────────────────────
  Successful: 495
  Failed: 5
  Success Rate: 99.00%
  Duration: 11.05s
  Throughput: 45.25 items/sec
  Avg Time/Item: 22.10ms
```

### Performance Tuning

**For fast network & powerful machines:**
```bash
npm start -- batch --operation analyze --batch-size 200 --parallelism 12
```

**For slower/limited resources:**
```bash
npm start -- batch --operation analyze --batch-size 25 --parallelism 2
```

**Recommended starting point:**
- `--batch-size 100`
- `--parallelism 4`

---

## Usage Examples

### Scenario 1: Daily Analysis at 2 AM

```bash
npm start -- schedule --cron '0 2 * * *' --operation analyze
```

This runs analysis on all tracked accounts every day at 2 AM.

### Scenario 2: Six-Hourly Reclaiming

```bash
npm start -- schedule --cron '0 */6 * * *' --operation reclaim
```

Executes reclaims every 6 hours (midnight, 6 AM, noon, 6 PM).

### Scenario 3: Weekly Report on Sundays

```bash
npm start -- schedule --cron '0 0 * * 0' --operation report
```

Generates a summary report every Sunday at midnight.

### Scenario 4: Batch Process 1000 Accounts Quickly

```bash
npm start -- batch --operation analyze --batch-size 100 --parallelism 8
```

Processes 1000 accounts in batches of 100 with up to 8 concurrent operations.

### Scenario 5: Test Batch Operation Without Executing

First, test with analyze:

```bash
npm start -- batch --operation analyze --batch-size 50 --parallelism 4
```

This shows how the batch processor will work before committing to reclaiming.

---

## Configuration

Both modules are configured through:

1. **Command-line arguments** (override config file)
2. **Environment variables** (for scheduled operations)
3. **config.json** (default values)

### Environment Variables

For scheduled tasks, set these in your `.env`:

```bash
# Scheduler config
SCHEDULER_ENABLED=true
SCHEDULER_MAX_CONCURRENT=4
SCHEDULER_RETRY_ON_FAILURE=true
SCHEDULER_MAX_RETRIES=3

# Batch Processor config
BATCH_SIZE=100
BATCH_PARALLELISM=4
```

### config.json Section (Optional)

```json
{
  "schedule": {
    "enabled": true,
    "maxConcurrent": 4,
    "retryOnFailure": true,
    "maxRetries": 3,
    "notifyOnSuccess": true,
    "notifyOnFailure": true
  },
  "batch": {
    "defaultBatchSize": 100,
    "defaultParallelism": 4,
    "maxRetries": 3,
    "timeoutMs": 30000
  }
}
```

---

## Monitoring & Alerts

### Telegram Alerts

When Telegram is configured, the scheduler sends notifications:

**Analyze completion:**
```
📊 Scheduled Analysis Complete: 127 accounts analyzed
```

**Reclaim completion:**
```
💰 Scheduled Reclaim Complete: 45 successful, 2 failed
```

**Failures:**
```
❌ Scheduled Reclaim Failed: RPC connection timeout
```

### Logs

Check logs in `logs/bot.log`:

```bash
tail -f logs/bot.log
```

Filter by component:

```bash
grep "Scheduler" logs/bot.log
grep "BatchProcessor" logs/bot.log
```

### Dashboard

The dashboard shows:
- Last operation timestamp
- Total accounts processed
- Success/failure rates
- Timeline of all operations

```bash
npm start -- dashboard --port 3000
```

---

## Troubleshooting

### Issue: Scheduler doesn't execute at scheduled time

**Check:**
1. Node process is still running (`ps aux | grep node`)
2. Cron expression is valid (use [cron validator](https://crontab.guru/))
3. Check logs for errors: `grep "Scheduler" logs/bot.log | grep error`

**Solution:**
```bash
# Validate cron expression
npm start -- schedule --cron '0 * * * *' --operation analyze --dry-run
```

### Issue: Batch processing fails midway

**Check:**
1. Network connectivity
2. RPC endpoint health
3. Account state on-chain

**Solution:**
```bash
# Use smaller batch size
npm start -- batch --operation analyze --batch-size 25 --parallelism 2

# Check logs
tail -f logs/bot.log | grep "BatchProcessor"
```

### Issue: High memory usage during batch processing

**Reduce parallelism:**
```bash
npm start -- batch --operation analyze --batch-size 100 --parallelism 2
```

Or increase batch size to reduce total number of concurrent operations:
```bash
npm start -- batch --operation analyze --batch-size 200 --parallelism 4
```

### Issue: "Scheduler disabled via configuration"

**Fix:** Set `enabled: true` in config or ensure environment variables aren't disabling it.

Check logs:
```bash
grep "Scheduler disabled" logs/bot.log
```

### Issue: Retries not working

**Check:**
1. `retryOnFailure: true` is set
2. `maxRetries` is > 0
3. Check exponential backoff is applied

Check logs:
```bash
grep "Retry" logs/bot.log
```

---

## Advanced Usage

### Running Multiple Schedulers

Start multiple scheduler instances for different operations:

**Terminal 1:**
```bash
npm start -- schedule --cron '0 2 * * *' --operation analyze
```

**Terminal 2:**
```bash
npm start -- schedule --cron '0 */12 * * *' --operation reclaim
```

**Terminal 3:**
```bash
npm start -- schedule --cron '0 0 * * 0' --operation report
```

### Combining with Dashboard

Run the dashboard alongside scheduled operations:

**Terminal 1:**
```bash
npm start -- schedule --cron '0 2 * * *' --operation analyze
```

**Terminal 2:**
```bash
npm start -- dashboard --port 3000
```

Then open http://localhost:3000 to monitor in real-time.

### Performance Metrics

Both modules log detailed metrics:

```
Success Rate: 98.50%
Duration: 45.23s
Throughput: 1,234.56 items/sec
Avg Time/Item: 0.81ms
```

Use these to optimize batch sizes and parallelism for your infrastructure.

---

## See Also

- [GETTING_STARTED.md](./GETTING_STARTED.md) - Initial setup guide
- [DASHBOARD_GUIDE.md](./DASHBOARD_GUIDE.md) - Dashboard documentation
- [RPC Configuration](./CONFIG.md#rpc-configuration) - RPC failover settings
- [Safety Checks](./SAFETY.md) - Reclaim safety mechanisms

---

## Support

For issues or questions:

1. Check logs: `logs/bot.log`
2. Review this guide
3. Check GitHub issues
4. Contact support

---

**Last Updated:** January 19, 2026  
**Module Versions:** scheduler.ts v1.0, batchProcessor.ts v1.0
