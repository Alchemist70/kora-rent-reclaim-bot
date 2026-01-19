# Phase 11: Advanced Monitoring & Metrics

**Status**: ✅ Complete  
**Version**: 1.0.0  
**Date**: January 19, 2026

## Overview

Phase 11 extends the Kora Rent Reclaim Bot with enterprise-grade monitoring, real-time metrics collection, webhook integrations, and advanced alerting rules. This phase provides operational visibility and enables proactive monitoring of bot performance.

## Features Implemented

### 1. Real-Time Metrics Collection

**File**: `src/monitoring/metricsCollector.ts`

Comprehensive metrics tracking for all bot operations:

- **Account Metrics**:
  - Total accounts tracked
  - Accounts analyzed
  - Accounts reclaimable
  
- **Reclaim Metrics**:
  - Reclaims attempted
  - Reclaims successful
  - Reclaims failed
  - Total rent reclaimed (lamports)
  - Average reclaim size
  - Success rate %
  
- **Performance Metrics**:
  - Gas spent
  - Cost per reclaim
  - Analysis time
  - Transaction errors
  - RPC errors
  
- **Operational Events**:
  - Operation started/completed/failed
  - Reclaim attempts/successes/failures
  - Account analysis
  - Error tracking
  - Metrics snapshots

**Usage**:
```typescript
import { MetricsCollector } from './monitoring/metricsCollector.js';

const collector = new MetricsCollector();

// Record operations
const operation = collector.recordOperation('analyze', 100);
collector.completeOperation(operation, 95, 5, 890000);

// Record reclaim
collector.recordReclaimSuccess(890880, 5000);
collector.recordReclaimFailure('Account already active');

// Get current metrics
const snapshot = collector.getSnapshot();
console.log(`Success Rate: ${snapshot.successRate}%`);
console.log(`Total Reclaimed: ${snapshot.totalRentReclaimed} lamports`);

// Get performance stats
const perf = collector.getPerformanceStats();
console.log(`P95 Duration: ${perf.p95Duration}ms`);
```

### 2. Webhook Integration

**File**: `src/monitoring/webhookIntegration.ts`

Send metrics and events to external systems:

- **Multiple Endpoints**: Support unlimited webhook URLs
- **Event Filtering**: Subscribe to specific event types
- **Retry Logic**: Exponential backoff with configurable attempts
- **Custom Headers**: Add authentication or tracking headers
- **Throttling**: Built-in rate limiting and cooldown
- **Error Handling**: Graceful degradation with logging

**Supported Events**:
- Metrics snapshots
- Operation events (started/completed/failed)
- Reclaim success/failure
- System errors
- Custom events

**Configuration**:
```json
{
  "webhooks": {
    "enabled": true,
    "retryAttempts": 3,
    "retryDelayMs": 1000,
    "timeout": 10000,
    "endpoints": [
      {
        "url": "https://your-system.com/webhooks/metrics",
        "events": ["metrics_snapshot", "reclaim_successful"],
        "headers": {
          "Authorization": "Bearer YOUR_TOKEN",
          "X-Source": "kora-bot"
        },
        "active": true
      }
    ]
  }
}
```

**Usage**:
```typescript
import { WebhookIntegration } from './monitoring/webhookIntegration.js';

const webhooks = new WebhookIntegration({
  enabled: true,
  endpoints: [
    {
      url: 'https://api.example.com/webhooks/metrics',
      events: ['metrics_snapshot', 'reclaim_successful'],
      active: true
    }
  ]
});

// Send metrics
await webhooks.sendMetricsSnapshot(metricsSnapshot);

// Send reclaim success
await webhooks.sendReclaimSuccess({
  lamportsReclaimed: 890880,
  transactionFee: 5000,
  txSignature: '...',
  account: '...'
});

// Test connectivity
const isHealthy = await webhooks.testEndpoint('https://api.example.com/webhooks/metrics');
```

### 3. Advanced Alerting Rules Engine

**File**: `src/monitoring/alertRulesEngine.ts`

Sophisticated rule-based alerting with flexible logic:

- **Complex Conditions**: AND/OR logic, multiple comparisons
- **Aggregations**: Average, sum, max, min, count over history
- **Cooldown Period**: Prevent alert spam
- **Throttling**: Max alerts per window
- **Severity Levels**: INFO, WARNING, CRITICAL
- **Historical Context**: Metrics history for trending

**Built-in Alert Rules**:

1. **High Failure Rate** (WARNING)
   - Triggers when success rate < 80%
   - Cooldown: 5 minutes
   - Max 5 alerts per hour

2. **Repeated Errors** (CRITICAL)
   - Triggers when transaction errors > 10
   - Cooldown: 10 minutes
   - Max 3 alerts per hour

3. **RPC Connectivity Issues** (WARNING)
   - Triggers when RPC errors > 0
   - Cooldown: 10 minutes

4. **No Recent Activity** (INFO)
   - Triggers when no reclaims in hour
   - Cooldown: 1 hour
   - Disabled by default

**Comparison Operators**:
- `==` (Equal)
- `!=` (Not Equal)
- `>` (Greater Than)
- `<` (Less Than)
- `>=` (Greater or Equal)
- `<=` (Less or Equal)
- `contains` (String contains)
- `not_contains` (String doesn't contain)

**Aggregation Functions**:
- `avg` - Average over history
- `sum` - Sum over history
- `max` - Maximum value in history
- `min` - Minimum value in history
- `count` - Number of items in history

**Usage**:
```typescript
import { 
  AlertRulesEngine, 
  AlertSeverity, 
  ComparisonOp,
  AggregationFunc 
} from './monitoring/alertRulesEngine.js';

const engine = new AlertRulesEngine();

// Add custom rule
engine.addRule({
  id: 'low_reclaim_rate',
  name: 'Low Reclaim Rate',
  description: 'Alert when average success rate drops',
  enabled: true,
  severity: AlertSeverity.WARNING,
  conditions: [
    {
      field: 'successRate',
      operator: ComparisonOp.LESS_THAN,
      value: 70,
      aggregation: AggregationFunc.AVG
    }
  ],
  logicalOp: 'AND',
  cooldownMs: 600000,  // 10 minutes
  maxAlerts: 5,
  throttleWindowMs: 3600000  // 1 hour
});

// Evaluate metrics
const alerts = engine.evaluateMetrics(metricsSnapshot);
for (const alert of alerts) {
  console.log(`[${alert.severity.toUpperCase()}] ${alert.message}`);
}
```

### 4. Monitoring Orchestrator

**File**: `src/monitoring/orchestrator.ts`

Unified interface coordinating all monitoring activities:

- **Metrics Collection**: Periodic snapshots
- **Event Processing**: Webhook delivery and alert triggering
- **Status Tracking**: Comprehensive health checks
- **Management API**: Add/remove rules and webhooks
- **Export**: JSON export of monitoring state

**Configuration**:
```json
{
  "monitoring": {
    "enabled": true,
    "metricsIntervalMs": 30000,
    "webhooks": { ... },
    "alertRules": [ ... ]
  }
}
```

**Usage**:
```typescript
import { MonitoringOrchestrator } from './monitoring/orchestrator.js';

const monitoring = new MonitoringOrchestrator({
  enabled: true,
  metricsIntervalMs: 30000  // Collect metrics every 30s
});

// Start monitoring
monitoring.start();

// Listen to events
monitoring.on('alert', (alert) => {
  console.log(`Alert: ${alert.message}`);
});

monitoring.on('reclaim_success', (data) => {
  console.log(`Reclaimed ${data.lamportsReclaimed} lamports`);
});

monitoring.on('metrics_snapshot', (snapshot) => {
  console.log(`Success Rate: ${snapshot.successRate}%`);
});

// Add webhook endpoint
monitoring.addWebhookEndpoint({
  url: 'https://your-system.com/webhooks',
  events: ['metrics_snapshot', 'reclaim_successful'],
  active: true
});

// Get status
const status = monitoring.getStatus();
console.log(`Uptime: ${status.uptime}ms`);
console.log(`Alerts Triggered: ${status.alertsTriggered}`);

// Health check
const health = monitoring.getHealthCheck();
console.log(`Healthy: ${health.healthy}`);
if (!health.healthy) {
  console.log('Errors:', health.errors);
}

// Stop monitoring
monitoring.stop();
```

## Integration with Dashboard

The monitoring system integrates with the Phase 9 dashboard to provide real-time visibility:

### Dashboard Enhancements (Future)

```typescript
// Metrics API endpoint
GET /api/metrics
{
  "timestamp": 1234567890,
  "accountsTracked": 150,
  "reclaimsSuccessful": 42,
  "reclaimsFailed": 3,
  "successRate": 93.3,
  "totalRentReclaimed": 37393160,
  "uptime": 86400000
}

// Alerts endpoint
GET /api/alerts
[
  {
    "ruleId": "high_failure_rate",
    "ruleName": "High Failure Rate",
    "severity": "warning",
    "timestamp": 1234567890,
    "message": "..."
  }
]

// Performance statistics
GET /api/performance
{
  "successfulOperations": 142,
  "failedOperations": 8,
  "averageDuration": 1234,
  "p95Duration": 5000,
  "p99Duration": 8000,
  "operationsPerHour": 45.3
}
```

## Configuration Examples

### Minimal Monitoring
```json
{
  "monitoring": {
    "enabled": true,
    "metricsIntervalMs": 60000
  }
}
```

### With Webhooks
```json
{
  "monitoring": {
    "enabled": true,
    "metricsIntervalMs": 30000,
    "webhooks": {
      "enabled": true,
      "endpoints": [
        {
          "url": "https://datadog.example.com/api/events",
          "events": ["metrics_snapshot"],
          "headers": {
            "DD-API-KEY": "your_key"
          },
          "active": true
        }
      ]
    }
  }
}
```

### With Custom Alert Rules
```json
{
  "monitoring": {
    "enabled": true,
    "metricsIntervalMs": 30000,
    "alertRules": [
      {
        "id": "critical_error_threshold",
        "name": "Critical Error Threshold",
        "enabled": true,
        "severity": "critical",
        "conditions": [
          {
            "field": "transactionErrors",
            "operator": ">",
            "value": 50
          }
        ],
        "logicalOp": "AND",
        "cooldownMs": 300000,
        "maxAlerts": 3,
        "throttleWindowMs": 3600000
      }
    ]
  }
}
```

## Event Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│ Bot Operations                                          │
│ (Reclaim, Analysis, etc.)                               │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ MetricsCollector                                        │
│ - Records operations                                    │
│ - Tracks KPIs                                           │
│ - Emits events                                          │
└────────────────┬────────────────────────────────────────┘
                 │
      ┌──────────┴──────────┐
      │                     │
      ▼                     ▼
┌──────────────┐    ┌──────────────┐
│ AlertRules   │    │ Webhooks     │
│ Engine       │    │ Integration  │
└──────┬───────┘    └──────┬───────┘
       │                   │
       ▼                   ▼
   Alerts         External Systems
   (Slack,        (Datadog, PagerDuty,
    Email)        Custom APIs)
```

## Performance Considerations

- **Low Overhead**: Minimal impact on bot performance
- **Async Operations**: Non-blocking webhook delivery
- **Metrics History**: Configurable retention (default: 100 snapshots)
- **Memory Efficient**: Automatic cleanup of old data
- **Scalable**: Supports unlimited webhook endpoints

## Security Notes

- **Webhook Authentication**: Use `headers` for API keys/tokens
- **HTTPS Only**: All webhooks should use HTTPS
- **Timeout**: 10-second default timeout prevents hanging
- **Input Validation**: All metrics are validated before processing
- **No Sensitive Data**: Metrics exclude keypairs, private keys

## API Reference

### MetricsCollector

```typescript
// Recording operations
recordOperation(type, itemsProcessed): OperationMetrics
completeOperation(operation, successful, failed, lamports?)
failOperation(operation, errorMessage)

// Recording reclaims
recordReclaimAttempt()
recordReclaimSuccess(lamports, fee)
recordReclaimFailure(reason)

// Error tracking
recordTransactionError()
recordRpcError()

// Metrics
getSnapshot(): MetricsSnapshot
getPerformanceStats(): PerformanceStats
getOperationHistory(limit): OperationMetrics[]
reset()
```

### WebhookIntegration

```typescript
// Sending data
sendMetricsSnapshot(metrics)
sendOperationEvent(eventType, operation)
sendCustomEvent(eventType, data)
sendReclaimSuccess(data)
sendErrorAlert(error)

// Endpoint management
addEndpoint(endpoint)
removeEndpoint(url)
setEndpointActive(url, active)
getEndpoints(): WebhookEndpoint[]
testEndpoint(url): boolean

// Status
isEnabled(): boolean
```

### AlertRulesEngine

```typescript
// Rule management
addRule(rule)
removeRule(ruleId)
enableRule(ruleId)
disableRule(ruleId)

// Evaluation
evaluateMetrics(metrics): TriggeredAlert[]

// Data access
getRules(): AlertRule[]
getRule(ruleId): AlertRule | undefined
getMetricsHistory(): MetricsSnapshot[]
clearHistory()
```

### MonitoringOrchestrator

```typescript
// Lifecycle
start()
stop()
getStatus(): MonitoringStatus
getHealthCheck(): { healthy: boolean; errors: string[] }

// Component access
getMetricsCollector(): MetricsCollector
getAlertRulesEngine(): AlertRulesEngine
getWebhookIntegration(): WebhookIntegration

// Management
addWebhookEndpoint(endpoint)
removeWebhookEndpoint(url)
addAlertRule(rule)
removeAlertRule(ruleId)
enableAlertRule(ruleId)
disableAlertRule(ruleId)

// Export
exportMetrics()
```

## Testing

To test the monitoring system:

```bash
# Build monitoring features
npm run build

# Run unit tests (when available)
npm test

# Check metrics collection
node -e "
  const { MetricsCollector } = require('./dist/monitoring/metricsCollector.js');
  const collector = new MetricsCollector();
  collector.recordAccountTracked();
  collector.recordReclaimSuccess(890880, 5000);
  console.log(JSON.stringify(collector.getSnapshot(), null, 2));
"
```

## Troubleshooting

### Webhooks not sending
- Check endpoint is active: `endpoint.active === true`
- Verify URL is HTTPS and accessible
- Check authentication headers are correct
- Look at logs for retry attempts

### Alerts not triggering
- Verify rule is enabled: `rule.enabled === true`
- Check cooldown period hasn't been exceeded
- Check metrics have history data
- Verify field names match snapshot structure

### Memory usage increasing
- Monitor `metricsHistory` size
- Call `reset()` periodically
- Reduce `metricsIntervalMs` if needed
- Check for webhook retries

## Future Enhancements

- [ ] Alert routing (PagerDuty, Slack, Email)
- [ ] Metrics aggregation and reporting
- [ ] Performance trending and forecasting
- [ ] Custom metric definitions
- [ ] Distributed tracing
- [ ] Advanced anomaly detection
- [ ] Cost analysis and optimization

## Summary

Phase 11 provides comprehensive monitoring capabilities for operational visibility and proactive incident management. The system is designed to be extensible, scalable, and production-ready with minimal performance overhead.
