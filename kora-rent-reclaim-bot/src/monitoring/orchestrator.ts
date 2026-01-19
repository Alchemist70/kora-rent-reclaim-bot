/**
 * Monitoring Orchestrator
 * Coordinates metrics collection, webhook delivery, and alert triggering
 * Provides a unified monitoring interface for the bot
 */

import { EventEmitter } from 'events';
import { getLogger } from '../utils/logging.js';
import {
  MetricsCollector,
  MetricsSnapshot,
  OperationMetrics,
  MetricsEventType
} from './metricsCollector.js';
import { WebhookIntegration, WebhookConfig, WebhookEndpoint } from './webhookIntegration.js';
import {
  AlertRulesEngine,
  AlertRule,
  TriggeredAlert,
  DEFAULT_ALERT_RULES
} from './alertRulesEngine.js';

const logger = getLogger();

/**
 * Monitoring configuration
 */
export interface MonitoringConfig {
  enabled: boolean;
  metricsIntervalMs: number;
  webhooks?: Partial<WebhookConfig>;
  alertRules?: AlertRule[];
}

/**
 * Monitoring status
 */
export interface MonitoringStatus {
  enabled: boolean;
  uptime: number;
  metricsCollected: number;
  alertsTriggered: number;
  webhooksSent: number;
  lastMetricsSnapshot: MetricsSnapshot | null;
  lastAlert: TriggeredAlert | null;
}

/**
 * Monitoring orchestrator
 * Coordinates all monitoring activities
 */
export class MonitoringOrchestrator extends EventEmitter {
  private config: MonitoringConfig;
  private metricsCollector: MetricsCollector;
  private webhookIntegration: WebhookIntegration;
  private alertRulesEngine: AlertRulesEngine;
  private metricsInterval: NodeJS.Timeout | null = null;
  private startTime: number;
  private metricsCollectedCount: number = 0;
  private alertsTriggeredCount: number = 0;
  private webhooksSentCount: number = 0;
  private lastMetricsSnapshot: MetricsSnapshot | null = null;
  private lastAlert: TriggeredAlert | null = null;

  constructor(config: MonitoringConfig) {
    super();
    this.config = config;
    this.metricsCollector = new MetricsCollector();
    this.webhookIntegration = new WebhookIntegration(config.webhooks);
    this.alertRulesEngine = new AlertRulesEngine();
    this.startTime = Date.now();

    this.setupEventListeners();
    this.initializeAlertRules();

    if (config.enabled) {
      this.start();
    }

    logger.info('Monitoring orchestrator initialized', {
      enabled: config.enabled,
      metricsInterval: config.metricsIntervalMs,
      webhooksEnabled: this.webhookIntegration.isEnabled()
    });
  }

  /**
   * Setup internal event listeners
   */
  private setupEventListeners(): void {
    // Listen to metrics events
    this.metricsCollector.on(MetricsEventType.RECLAIM_SUCCESSFUL, (data: any) => {
      this.emit('reclaim_success', data);
      this.webhookIntegration.sendReclaimSuccess(data);
    });

    this.metricsCollector.on(MetricsEventType.RECLAIM_FAILED, (data: any) => {
      this.emit('reclaim_failed', data);
      this.webhookIntegration.sendErrorAlert({
        type: 'reclaim_failure',
        message: data.reason
      });
    });

    this.metricsCollector.on(MetricsEventType.ERROR_OCCURRED, (data: any) => {
      this.emit('error', data);
      this.webhookIntegration.sendErrorAlert({
        type: 'system_error',
        message: data.message,
        context: data
      });
    });

    // Listen to alert triggers
    this.alertRulesEngine.on('alert_triggered', (alert: TriggeredAlert) => {
      this.lastAlert = alert;
      this.alertsTriggeredCount++;
      this.emit('alert', alert);
      // Send alert via webhook 
      this.webhookIntegration.sendCustomEvent(MetricsEventType.ERROR_OCCURRED, alert);
    });
  }

  /**
   * Initialize default alert rules
   */
  private initializeAlertRules(): void {
    const rules = this.config.alertRules || DEFAULT_ALERT_RULES;
    for (const rule of rules) {
      this.alertRulesEngine.addRule(rule);
    }
    logger.info('Alert rules initialized', { count: rules.length });
  }

  /**
   * Start monitoring
   */
  start(): void {
    if (this.metricsInterval) {
      logger.warn('Monitoring already running');
      return;
    }

    this.metricsInterval = setInterval(() => {
      this.collectAndProcessMetrics();
    }, this.config.metricsIntervalMs);

    logger.info('Monitoring started', {
      interval: this.config.metricsIntervalMs
    });
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
      logger.info('Monitoring stopped');
    }
  }

  /**
   * Collect metrics and process through webhooks and alerts
   */
  private async collectAndProcessMetrics(): Promise<void> {
    try {
      // Get metrics snapshot
      const snapshot = this.metricsCollector.getSnapshot();
      this.lastMetricsSnapshot = snapshot;
      this.metricsCollectedCount++;

      // Send to webhooks
      if (this.webhookIntegration.isEnabled()) {
        await this.webhookIntegration.sendMetricsSnapshot(snapshot);
        this.webhooksSentCount++;
      }

      // Evaluate alert rules
      const alerts = this.alertRulesEngine.evaluateMetrics(snapshot);
      if (alerts.length > 0) {
        for (const alert of alerts) {
          this.lastAlert = alert;
          this.alertsTriggeredCount++;
          this.emit('alert', alert);
        }
      }

      this.emit('metrics_snapshot', snapshot);
    } catch (error) {
      logger.error('Error processing metrics', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Get metrics collector
   */
  getMetricsCollector(): MetricsCollector {
    return this.metricsCollector;
  }

  /**
   * Get alert rules engine
   */
  getAlertRulesEngine(): AlertRulesEngine {
    return this.alertRulesEngine;
  }

  /**
   * Get webhook integration
   */
  getWebhookIntegration(): WebhookIntegration {
    return this.webhookIntegration;
  }

  /**
   * Get current monitoring status
   */
  getStatus(): MonitoringStatus {
    return {
      enabled: this.config.enabled,
      uptime: Date.now() - this.startTime,
      metricsCollected: this.metricsCollectedCount,
      alertsTriggered: this.alertsTriggeredCount,
      webhooksSent: this.webhooksSentCount,
      lastMetricsSnapshot: this.lastMetricsSnapshot,
      lastAlert: this.lastAlert
    };
  }

  /**
   * Add webhook endpoint
   */
  addWebhookEndpoint(endpoint: WebhookEndpoint): void {
    this.webhookIntegration.addEndpoint(endpoint);
  }

  /**
   * Remove webhook endpoint
   */
  removeWebhookEndpoint(url: string): void {
    this.webhookIntegration.removeEndpoint(url);
  }

  /**
   * Add alert rule
   */
  addAlertRule(rule: AlertRule): void {
    this.alertRulesEngine.addRule(rule);
  }

  /**
   * Remove alert rule
   */
  removeAlertRule(ruleId: string): void {
    this.alertRulesEngine.removeRule(ruleId);
  }

  /**
   * Enable alert rule
   */
  enableAlertRule(ruleId: string): void {
    this.alertRulesEngine.enableRule(ruleId);
  }

  /**
   * Disable alert rule
   */
  disableAlertRule(ruleId: string): void {
    this.alertRulesEngine.disableRule(ruleId);
  }

  /**
   * Export metrics as JSON
   */
  exportMetrics(): {
    status: MonitoringStatus;
    rulesCount: number;
    webhooksCount: number;
    rules: AlertRule[];
    webhooks: WebhookEndpoint[];
  } {
    return {
      status: this.getStatus(),
      rulesCount: this.alertRulesEngine.getRules().length,
      webhooksCount: this.webhookIntegration.getEndpoints().length,
      rules: this.alertRulesEngine.getRules(),
      webhooks: this.webhookIntegration.getEndpoints()
    };
  }

  /**
   * Get health check
   */
  getHealthCheck(): {
    healthy: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!this.config.enabled) {
      errors.push('Monitoring is disabled');
    }

    if (!this.metricsInterval) {
      errors.push('Metrics collection is not running');
    }

    const status = this.getStatus();
    if (status.lastAlert && status.lastAlert.severity === 'critical') {
      errors.push('Critical alert detected');
    }

    return {
      healthy: errors.length === 0,
      errors
    };
  }
}
