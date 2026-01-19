/**
 * Webhook Integration Service
 * Sends metrics and events to external systems via HTTP webhooks
 * Supports multiple webhook endpoints with filtering and retries
 */

import axios, { AxiosInstance } from 'axios';
import { getLogger } from '../utils/logging.js';
import { MetricsSnapshot, OperationMetrics, MetricsEventType } from './metricsCollector.js';

const logger = getLogger();

/**
 * Webhook configuration
 */
export interface WebhookConfig {
  enabled: boolean;
  endpoints: WebhookEndpoint[];
  retryAttempts: number;
  retryDelayMs: number;
  timeout: number;
}

/**
 * Individual webhook endpoint
 */
export interface WebhookEndpoint {
  url: string;
  events: MetricsEventType[];
  headers?: Record<string, string>;
  active: boolean;
}

/**
 * Webhook payload wrapper
 */
export interface WebhookPayload {
  timestamp: number;
  source: 'kora-rent-reclaim-bot';
  version: string;
  eventType: MetricsEventType;
  data: any;
}

/**
 * Webhook integration service
 * Manages HTTP webhooks for external integrations
 */
export class WebhookIntegration {
  private config: WebhookConfig;
  private httpClient: AxiosInstance;

  constructor(config?: Partial<WebhookConfig>) {
    this.config = {
      enabled: config?.enabled ?? false,
      endpoints: config?.endpoints ?? [],
      retryAttempts: config?.retryAttempts ?? 3,
      retryDelayMs: config?.retryDelayMs ?? 1000,
      timeout: config?.timeout ?? 10000
    };

    this.httpClient = axios.create({
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'kora-rent-reclaim-bot/1.0.0'
      }
    });

    if (this.config.enabled && this.config.endpoints.length > 0) {
      logger.info('Webhook integration enabled', {
        endpoints: this.config.endpoints.length
      });
    }
  }

  /**
   * Send metrics snapshot to webhooks
   */
  async sendMetricsSnapshot(metrics: MetricsSnapshot): Promise<void> {
    if (!this.config.enabled) return;

    const payload: WebhookPayload = {
      timestamp: Date.now(),
      source: 'kora-rent-reclaim-bot',
      version: '1.0.0',
      eventType: MetricsEventType.METRICS_SNAPSHOT,
      data: metrics
    };

    await this.broadcastToEndpoints(payload);
  }

  /**
   * Send operation event to webhooks
   */
  async sendOperationEvent(
    eventType: MetricsEventType,
    operation: OperationMetrics
  ): Promise<void> {
    if (!this.config.enabled) return;

    const payload: WebhookPayload = {
      timestamp: Date.now(),
      source: 'kora-rent-reclaim-bot',
      version: '1.0.0',
      eventType,
      data: operation
    };

    await this.broadcastToEndpoints(payload);
  }

  /**
   * Send custom event to webhooks
   */
  async sendCustomEvent(eventType: MetricsEventType, data: any): Promise<void> {
    if (!this.config.enabled) return;

    const payload: WebhookPayload = {
      timestamp: Date.now(),
      source: 'kora-rent-reclaim-bot',
      version: '1.0.0',
      eventType,
      data
    };

    await this.broadcastToEndpoints(payload);
  }

  /**
   * Send reclaim success event
   */
  async sendReclaimSuccess(reclaimData: {
    lamportsReclaimed: number;
    transactionFee: number;
    txSignature: string;
    account: string;
  }): Promise<void> {
    await this.sendCustomEvent(MetricsEventType.RECLAIM_SUCCESSFUL, reclaimData);
  }

  /**
   * Send error alert
   */
  async sendErrorAlert(error: {
    type: string;
    message: string;
    context?: any;
  }): Promise<void> {
    await this.sendCustomEvent(MetricsEventType.ERROR_OCCURRED, error);
  }

  /**
   * Broadcast payload to all enabled endpoints
   */
  private async broadcastToEndpoints(payload: WebhookPayload): Promise<void> {
    const activeEndpoints = this.config.endpoints.filter(ep => ep.active);

    if (activeEndpoints.length === 0) {
      logger.debug('No active webhook endpoints');
      return;
    }

    const promises = activeEndpoints.map(endpoint =>
      this.sendToEndpoint(endpoint, payload)
    );

    await Promise.allSettled(promises);
  }

  /**
   * Send payload to single endpoint with retry logic
   */
  private async sendToEndpoint(
    endpoint: WebhookEndpoint,
    payload: WebhookPayload,
    attempt: number = 1
  ): Promise<void> {
    try {
      // Check if endpoint is subscribed to this event type
      if (!endpoint.events.includes(payload.eventType)) {
        return;
      }

      const headers = {
        ...endpoint.headers,
        'X-Webhook-Event': payload.eventType,
        'X-Webhook-Delivery': `${payload.timestamp}-${Math.random().toString(36).substr(2, 9)}`
      };

      const response = await this.httpClient.post(endpoint.url, payload, {
        headers
      });

      if (response.status >= 200 && response.status < 300) {
        logger.debug('Webhook delivered', {
          url: endpoint.url,
          eventType: payload.eventType,
          status: response.status
        });
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      if (attempt < this.config.retryAttempts) {
        logger.debug('Webhook retry', {
          url: endpoint.url,
          attempt,
          nextRetryIn: this.config.retryDelayMs
        });

        await this.delay(this.config.retryDelayMs);
        return this.sendToEndpoint(endpoint, payload, attempt + 1);
      }

      logger.warn('Webhook delivery failed', {
        url: endpoint.url,
        eventType: payload.eventType,
        attempts: attempt,
        error: errorMsg
      });
    }
  }

  /**
   * Add a webhook endpoint
   */
  addEndpoint(endpoint: WebhookEndpoint): void {
    this.config.endpoints.push(endpoint);
    logger.info('Webhook endpoint added', { url: endpoint.url });
  }

  /**
   * Remove a webhook endpoint
   */
  removeEndpoint(url: string): void {
    const index = this.config.endpoints.findIndex(ep => ep.url === url);
    if (index >= 0) {
      this.config.endpoints.splice(index, 1);
      logger.info('Webhook endpoint removed', { url });
    }
  }

  /**
   * Update endpoint status
   */
  setEndpointActive(url: string, active: boolean): void {
    const endpoint = this.config.endpoints.find(ep => ep.url === url);
    if (endpoint) {
      endpoint.active = active;
      logger.info('Webhook endpoint status updated', { url, active });
    }
  }

  /**
   * Get all endpoints
   */
  getEndpoints(): WebhookEndpoint[] {
    return this.config.endpoints;
  }

  /**
   * Test webhook endpoint connectivity
   */
  async testEndpoint(url: string): Promise<boolean> {
    try {
      const testPayload: WebhookPayload = {
        timestamp: Date.now(),
        source: 'kora-rent-reclaim-bot',
        version: '1.0.0',
        eventType: MetricsEventType.METRICS_SNAPSHOT,
        data: { test: true }
      };

      const response = await this.httpClient.post(url, testPayload);
      logger.info('Webhook test successful', {
        url,
        status: response.status
      });
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.warn('Webhook test failed', { url, error: errorMsg });
      return false;
    }
  }

  /**
   * Helper for delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if webhooks are enabled
   */
  isEnabled(): boolean {
    return this.config.enabled && this.config.endpoints.length > 0;
  }
}
