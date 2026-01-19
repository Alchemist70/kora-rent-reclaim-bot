/**
 * Advanced Alerting Rules Engine
 * Evaluates custom conditions and triggers alerts based on configurable rules
 * Supports complex rule logic with comparisons, aggregations, and escalation
 */

import { EventEmitter } from 'events';
import { getLogger } from '../utils/logging.js';
import { MetricsSnapshot } from './metricsCollector.js';

const logger = getLogger();

/**
 * Alert severity levels
 */
export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical'
}

/**
 * Comparison operators for rules
 */
export enum ComparisonOp {
  EQUAL = '==',
  NOT_EQUAL = '!=',
  GREATER_THAN = '>',
  LESS_THAN = '<',
  GREATER_EQUAL = '>=',
  LESS_EQUAL = '<=',
  CONTAINS = 'contains',
  NOT_CONTAINS = 'not_contains'
}

/**
 * Aggregation functions
 */
export enum AggregationFunc {
  AVG = 'avg',
  SUM = 'sum',
  MAX = 'max',
  MIN = 'min',
  COUNT = 'count'
}

/**
 * Rule condition for evaluation
 */
export interface RuleCondition {
  field: string;
  operator: ComparisonOp;
  value: any;
  aggregation?: AggregationFunc;
}

/**
 * Alert rule definition
 */
export interface AlertRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  severity: AlertSeverity;
  conditions: RuleCondition[];
  logicalOp: 'AND' | 'OR';
  cooldownMs: number;
  maxAlerts: number;
  throttleWindowMs: number;
}

/**
 * Triggered alert
 */
export interface TriggeredAlert {
  ruleId: string;
  ruleName: string;
  severity: AlertSeverity;
  timestamp: number;
  message: string;
  matchedConditions: RuleCondition[];
  metricsSnapshot: Partial<MetricsSnapshot>;
}

/**
 * Alert rule engine
 * Evaluates metrics against configurable rules
 */
export class AlertRulesEngine extends EventEmitter {
  private rules: Map<string, AlertRule> = new Map();
  private lastAlertTime: Map<string, number> = new Map();
  private alertCount: Map<string, number> = new Map();
  private metricsHistory: MetricsSnapshot[] = [];
  private maxHistorySize: number = 100;

  constructor() {
    super();
    logger.info('Alert rules engine initialized');
  }

  /**
   * Add a new alert rule
   */
  addRule(rule: AlertRule): void {
    if (this.rules.has(rule.id)) {
      logger.warn('Rule already exists', { ruleId: rule.id });
      return;
    }

    this.rules.set(rule.id, rule);
    this.lastAlertTime.set(rule.id, 0);
    this.alertCount.set(rule.id, 0);

    logger.info('Alert rule added', {
      ruleId: rule.id,
      name: rule.name,
      severity: rule.severity
    });
  }

  /**
   * Remove an alert rule
   */
  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
    this.lastAlertTime.delete(ruleId);
    this.alertCount.delete(ruleId);
    logger.info('Alert rule removed', { ruleId });
  }

  /**
   * Enable rule
   */
  enableRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = true;
      logger.info('Alert rule enabled', { ruleId });
    }
  }

  /**
   * Disable rule
   */
  disableRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = false;
      logger.info('Alert rule disabled', { ruleId });
    }
  }

  /**
   * Evaluate all rules against metrics
   */
  evaluateMetrics(metrics: MetricsSnapshot): TriggeredAlert[] {
    // Add to history
    this.metricsHistory.push(metrics);
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory.shift();
    }

    const triggeredAlerts: TriggeredAlert[] = [];

    for (const [ruleId, rule] of this.rules.entries()) {
      if (!rule.enabled) continue;

      // Check cooldown
      if (!this.canTriggerAlert(ruleId, rule)) {
        continue;
      }

      // Evaluate rule conditions
      const matchedConditions = this.evaluateRule(rule, metrics);

      if (matchedConditions.length > 0) {
        const alert: TriggeredAlert = {
          ruleId,
          ruleName: rule.name,
          severity: rule.severity,
          timestamp: Date.now(),
          message: this.generateAlertMessage(rule, matchedConditions, metrics),
          matchedConditions,
          metricsSnapshot: {
            timestamp: metrics.timestamp,
            accountsReclaimable: metrics.accountsReclaimable,
            reclaimsSuccessful: metrics.reclaimsSuccessful,
            reclaimsFailed: metrics.reclaimsFailed,
            totalRentReclaimed: metrics.totalRentReclaimed,
            successRate: metrics.successRate,
            transactionErrors: metrics.transactionErrors,
            rpcErrors: metrics.rpcErrors
          }
        };

        triggeredAlerts.push(alert);
        this.recordAlert(ruleId, rule);
        this.emit('alert_triggered', alert);

        logger.warn('Alert triggered', {
          ruleId,
          ruleName: rule.name,
          severity: rule.severity,
          message: alert.message
        });
      }
    }

    return triggeredAlerts;
  }

  /**
   * Evaluate a single rule
   */
  private evaluateRule(rule: AlertRule, metrics: MetricsSnapshot): RuleCondition[] {
    const matchedConditions: RuleCondition[] = [];

    for (const condition of rule.conditions) {
      if (this.evaluateCondition(condition, metrics)) {
        matchedConditions.push(condition);
      }
    }

    // Check logical operator
    if (rule.logicalOp === 'AND') {
      return matchedConditions.length === rule.conditions.length
        ? matchedConditions
        : [];
    } else {
      return matchedConditions.length > 0 ? matchedConditions : [];
    }
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(condition: RuleCondition, metrics: MetricsSnapshot): boolean {
    const metricValue = this.getMetricValue(condition.field, metrics);

    if (metricValue === undefined) {
      logger.debug('Metric field not found', { field: condition.field });
      return false;
    }

    let value = condition.value;

    // Apply aggregation if specified
    if (condition.aggregation && this.metricsHistory.length > 0) {
      value = this.aggregateMetrics(condition.field, condition.aggregation);
    }

    return this.compareValues(metricValue, condition.operator, value);
  }

  /**
   * Get metric value from snapshot
   */
  private getMetricValue(field: string, metrics: MetricsSnapshot): any {
    const parts = field.split('.');
    let value: any = metrics;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = (value as Record<string, any>)[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Aggregate metrics from history
   */
  private aggregateMetrics(field: string, func: AggregationFunc): number {
    const values = this.metricsHistory.map(m => this.getMetricValue(field, m)).filter(v => v !== undefined && typeof v === 'number') as number[];

    if (values.length === 0) return 0;

    switch (func) {
      case AggregationFunc.AVG:
        return values.reduce((a, b) => a + b, 0) / values.length;
      case AggregationFunc.SUM:
        return values.reduce((a, b) => a + b, 0);
      case AggregationFunc.MAX:
        return Math.max(...values);
      case AggregationFunc.MIN:
        return Math.min(...values);
      case AggregationFunc.COUNT:
        return values.length;
    }
  }

  /**
   * Compare two values using operator
   */
  private compareValues(value: any, operator: ComparisonOp, compareValue: any): boolean {
    switch (operator) {
      case ComparisonOp.EQUAL:
        return value === compareValue;
      case ComparisonOp.NOT_EQUAL:
        return value !== compareValue;
      case ComparisonOp.GREATER_THAN:
        return Number(value) > Number(compareValue);
      case ComparisonOp.LESS_THAN:
        return Number(value) < Number(compareValue);
      case ComparisonOp.GREATER_EQUAL:
        return Number(value) >= Number(compareValue);
      case ComparisonOp.LESS_EQUAL:
        return Number(value) <= Number(compareValue);
      case ComparisonOp.CONTAINS:
        return String(value).includes(String(compareValue));
      case ComparisonOp.NOT_CONTAINS:
        return !String(value).includes(String(compareValue));
      default:
        return false;
    }
  }

  /**
   * Check if rule can trigger alert (respects cooldown)
   */
  private canTriggerAlert(ruleId: string, rule: AlertRule): boolean {
    const lastTrigger = this.lastAlertTime.get(ruleId) || 0;
    const timeSinceLastAlert = Date.now() - lastTrigger;

    if (timeSinceLastAlert < rule.cooldownMs) {
      return false;
    }

    const count = this.alertCount.get(ruleId) || 0;
    if (count >= rule.maxAlerts) {
      if (timeSinceLastAlert > rule.throttleWindowMs) {
        this.alertCount.set(ruleId, 0);
        return true;
      }
      return false;
    }

    return true;
  }

  /**
   * Record alert trigger
   */
  private recordAlert(ruleId: string, rule: AlertRule): void {
    this.lastAlertTime.set(ruleId, Date.now());
    const count = (this.alertCount.get(ruleId) || 0) + 1;
    this.alertCount.set(ruleId, count);

    if (count > rule.maxAlerts) {
      logger.warn('Alert throttled - max alerts reached', { ruleId });
    }
  }

  /**
   * Generate alert message
   */
  private generateAlertMessage(
    rule: AlertRule,
    conditions: RuleCondition[],
    metrics: MetricsSnapshot
  ): string {
    const conditions_str = conditions
      .map(c => `${c.field} ${c.operator} ${c.value}`)
      .join(` ${rule.logicalOp} `);

    return `Rule "${rule.name}" triggered: ${conditions_str}. Success rate: ${metrics.successRate}%, Reclaims: ${metrics.reclaimsSuccessful}/${metrics.reclaimsAttempted}`;
  }

  /**
   * Get all rules
   */
  getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get rule by ID
   */
  getRule(ruleId: string): AlertRule | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(): MetricsSnapshot[] {
    return [...this.metricsHistory];
  }

  /**
   * Clear metrics history
   */
  clearHistory(): void {
    this.metricsHistory = [];
  }
}

/**
 * Default alert rules for common scenarios
 */
export const DEFAULT_ALERT_RULES: AlertRule[] = [
  {
    id: 'high_failure_rate',
    name: 'High Reclaim Failure Rate',
    description: 'Alert when reclaim success rate drops below 80%',
    enabled: true,
    severity: AlertSeverity.WARNING,
    conditions: [
      {
        field: 'successRate',
        operator: ComparisonOp.LESS_THAN,
        value: 80
      }
    ],
    logicalOp: 'AND',
    cooldownMs: 300000, // 5 minutes
    maxAlerts: 5,
    throttleWindowMs: 3600000 // 1 hour
  },
  {
    id: 'repeated_errors',
    name: 'Repeated Transaction Errors',
    description: 'Alert when transaction errors exceed 10',
    enabled: true,
    severity: AlertSeverity.CRITICAL,
    conditions: [
      {
        field: 'transactionErrors',
        operator: ComparisonOp.GREATER_THAN,
        value: 10
      }
    ],
    logicalOp: 'AND',
    cooldownMs: 600000, // 10 minutes
    maxAlerts: 3,
    throttleWindowMs: 3600000
  },
  {
    id: 'rpc_connectivity',
    name: 'RPC Connectivity Issues',
    description: 'Alert when RPC errors occur',
    enabled: true,
    severity: AlertSeverity.WARNING,
    conditions: [
      {
        field: 'rpcErrors',
        operator: ComparisonOp.GREATER_THAN,
        value: 0
      }
    ],
    logicalOp: 'AND',
    cooldownMs: 600000,
    maxAlerts: 5,
    throttleWindowMs: 3600000
  },
  {
    id: 'no_activity',
    name: 'No Recent Reclaim Activity',
    description: 'Alert when no reclaims in last hour',
    enabled: false,
    severity: AlertSeverity.INFO,
    conditions: [
      {
        field: 'reclaimsSuccessful',
        operator: ComparisonOp.EQUAL,
        value: 0
      }
    ],
    logicalOp: 'AND',
    cooldownMs: 3600000, // 1 hour
    maxAlerts: 1,
    throttleWindowMs: 3600000
  }
];
