/**
 * Real-time Metrics Collector
 * Collects and aggregates operational metrics for monitoring and analytics
 * Provides KPIs for dashboard and external integrations
 */

import { EventEmitter } from 'events';
import { getLogger } from '../utils/logging.js';

const logger = getLogger();

/**
 * Operational metrics snapshot
 */
export interface MetricsSnapshot {
  timestamp: number;
  uptime: number;
  accountsTracked: number;
  accountsAnalyzed: number;
  accountsReclaimable: number;
  reclaimsAttempted: number;
  reclaimsSuccessful: number;
  reclaimsFailed: number;
  totalRentReclaimed: number;
  avgReclaimSize: number;
  successRate: number;
  gasSpent: number;
  costPerReclaim: number;
  transactionErrors: number;
  rpcErrors: number;
  analysisTime: number;
  lastReclaimTimestamp: number | null;
  lastErrorTimestamp: number | null;
  lastErrorMessage: string | null;
}

/**
 * Detailed operation metrics
 */
export interface OperationMetrics {
  operationType: 'analyze' | 'reclaim' | 'index';
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'pending' | 'success' | 'failed';
  itemsProcessed: number;
  itemsSuccessful: number;
  itemsFailed: number;
  errorMessage?: string;
  lamportsProcessed?: number;
}

/**
 * Performance statistics
 */
export interface PerformanceStats {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  p95Duration: number;
  p99Duration: number;
  operationsPerHour: number;
}

/**
 * Metrics event types
 */
export enum MetricsEventType {
  OPERATION_STARTED = 'operation_started',
  OPERATION_COMPLETED = 'operation_completed',
  OPERATION_FAILED = 'operation_failed',
  RECLAIM_ATTEMPTED = 'reclaim_attempted',
  RECLAIM_SUCCESSFUL = 'reclaim_successful',
  RECLAIM_FAILED = 'reclaim_failed',
  ACCOUNT_ANALYZED = 'account_analyzed',
  ERROR_OCCURRED = 'error_occurred',
  METRICS_SNAPSHOT = 'metrics_snapshot'
}

/**
 * Real-time metrics collector
 * Tracks all operational metrics and provides snapshots
 */
export class MetricsCollector extends EventEmitter {
  private startTime: number;
  private accountsTracked: number = 0;
  private accountsAnalyzed: number = 0;
  private accountsReclaimable: number = 0;
  private reclaimsAttempted: number = 0;
  private reclaimsSuccessful: number = 0;
  private reclaimsFailed: number = 0;
  private totalRentReclaimed: number = 0; // in lamports
  private transactionErrors: number = 0;
  private rpcErrors: number = 0;
  private lastReclaimTimestamp: number | null = null;
  private lastErrorTimestamp: number | null = null;
  private lastErrorMessage: string | null = null;
  private operations: OperationMetrics[] = [];
  private maxOperationsHistory: number = 1000;

  constructor() {
    super();
    this.startTime = Date.now();
    logger.info('Metrics collector initialized');
  }

  /**
   * Record a new operation
   */
  recordOperation(
    operationType: 'analyze' | 'reclaim' | 'index',
    itemsProcessed: number = 0
  ): OperationMetrics {
    const operation: OperationMetrics = {
      operationType,
      startTime: Date.now(),
      status: 'pending',
      itemsProcessed,
      itemsSuccessful: 0,
      itemsFailed: 0
    };

    this.operations.push(operation);
    if (this.operations.length > this.maxOperationsHistory) {
      this.operations.shift();
    }

    this.emit(MetricsEventType.OPERATION_STARTED, operation);
    return operation;
  }

  /**
   * Mark operation as complete
   */
  completeOperation(
    operation: OperationMetrics,
    itemsSuccessful: number,
    itemsFailed: number,
    lamportsProcessed?: number
  ): void {
    operation.endTime = Date.now();
    operation.duration = operation.endTime - operation.startTime;
    operation.status = 'success';
    operation.itemsSuccessful = itemsSuccessful;
    operation.itemsFailed = itemsFailed;
    if (lamportsProcessed !== undefined) {
      operation.lamportsProcessed = lamportsProcessed;
    }

    this.emit(MetricsEventType.OPERATION_COMPLETED, operation);
    logger.debug('Operation completed', {
      type: operation.operationType,
      duration: operation.duration,
      successful: itemsSuccessful,
      failed: itemsFailed
    });
  }

  /**
   * Mark operation as failed
   */
  failOperation(operation: OperationMetrics, errorMessage: string): void {
    operation.endTime = Date.now();
    operation.duration = operation.endTime - operation.startTime;
    operation.status = 'failed';
    operation.errorMessage = errorMessage;

    this.lastErrorTimestamp = Date.now();
    this.lastErrorMessage = errorMessage;

    this.emit(MetricsEventType.OPERATION_FAILED, operation);
    logger.warn('Operation failed', {
      type: operation.operationType,
      duration: operation.duration,
      error: errorMessage
    });
  }

  /**
   * Record account tracking
   */
  recordAccountTracked(): void {
    this.accountsTracked++;
  }

  /**
   * Record account analysis
   */
  recordAccountAnalyzed(isReclaimable: boolean): void {
    this.accountsAnalyzed++;
    if (isReclaimable) {
      this.accountsReclaimable++;
    }
  }

  /**
   * Record a reclaim attempt
   */
  recordReclaimAttempt(): void {
    this.reclaimsAttempted++;
  }

  /**
   * Record successful reclaim
   */
  recordReclaimSuccess(lamportsReclaimed: number, transactionFee: number): void {
    this.reclaimsSuccessful++;
    this.totalRentReclaimed += lamportsReclaimed;
    this.lastReclaimTimestamp = Date.now();

    this.emit(MetricsEventType.RECLAIM_SUCCESSFUL, {
      lamportsReclaimed,
      transactionFee,
      netReclaimed: lamportsReclaimed - transactionFee,
      timestamp: this.lastReclaimTimestamp
    });

    logger.info('Reclaim successful', {
      lamports: lamportsReclaimed,
      fee: transactionFee,
      net: lamportsReclaimed - transactionFee
    });
  }

  /**
   * Record failed reclaim
   */
  recordReclaimFailure(reason: string): void {
    this.reclaimsFailed++;
    this.lastErrorTimestamp = Date.now();
    this.lastErrorMessage = reason;

    this.emit(MetricsEventType.RECLAIM_FAILED, {
      reason,
      timestamp: this.lastErrorTimestamp
    });

    logger.warn('Reclaim failed', { reason });
  }

  /**
   * Record transaction error
   */
  recordTransactionError(): void {
    this.transactionErrors++;
    this.lastErrorTimestamp = Date.now();
    this.lastErrorMessage = 'Transaction error';
  }

  /**
   * Record RPC error
   */
  recordRpcError(): void {
    this.rpcErrors++;
    this.lastErrorTimestamp = Date.now();
    this.lastErrorMessage = 'RPC error';
  }

  /**
   * Get current metrics snapshot
   */
  getSnapshot(): MetricsSnapshot {
    const uptime = Date.now() - this.startTime;
    const successRate =
      this.reclaimsAttempted > 0
        ? (this.reclaimsSuccessful / this.reclaimsAttempted) * 100
        : 0;
    const avgReclaimSize =
      this.reclaimsSuccessful > 0
        ? this.totalRentReclaimed / this.reclaimsSuccessful
        : 0;
    const totalGasSpent =
      this.transactionErrors * 5000 + this.reclaimsAttempted * 5000;
    const costPerReclaim =
      this.reclaimsSuccessful > 0 ? totalGasSpent / this.reclaimsSuccessful : 0;

    const snapshot: MetricsSnapshot = {
      timestamp: Date.now(),
      uptime,
      accountsTracked: this.accountsTracked,
      accountsAnalyzed: this.accountsAnalyzed,
      accountsReclaimable: this.accountsReclaimable,
      reclaimsAttempted: this.reclaimsAttempted,
      reclaimsSuccessful: this.reclaimsSuccessful,
      reclaimsFailed: this.reclaimsFailed,
      totalRentReclaimed: this.totalRentReclaimed,
      avgReclaimSize: Math.round(avgReclaimSize),
      successRate: Math.round(successRate * 100) / 100,
      gasSpent: totalGasSpent,
      costPerReclaim: Math.round(costPerReclaim),
      transactionErrors: this.transactionErrors,
      rpcErrors: this.rpcErrors,
      analysisTime: this.calculateAverageAnalysisTime(),
      lastReclaimTimestamp: this.lastReclaimTimestamp,
      lastErrorTimestamp: this.lastErrorTimestamp,
      lastErrorMessage: this.lastErrorMessage
    };

    this.emit(MetricsEventType.METRICS_SNAPSHOT, snapshot);
    return snapshot;
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): PerformanceStats {
    const durations = this.operations
      .filter(op => op.duration !== undefined)
      .map(op => op.duration!) 
      .sort((a, b) => a - b);

    const totalOperations = this.operations.length;
    const successfulOperations = this.operations.filter(
      op => op.status === 'success'
    ).length;
    const failedOperations = this.operations.filter(
      op => op.status === 'failed'
    ).length;

    const averageDuration =
      durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0;
    const minDuration = durations.length > 0 ? durations[0] : 0;
    const maxDuration =
      durations.length > 0 ? durations[durations.length - 1] : 0;
    const p95Index = Math.floor(durations.length * 0.95);
    const p99Index = Math.floor(durations.length * 0.99);
    const p95Duration = durations[p95Index] || 0;
    const p99Duration = durations[p99Index] || 0;

    const uptime = Date.now() - this.startTime;
    const operationsPerHour =
      (totalOperations / uptime) * 3600000;

    return {
      totalOperations,
      successfulOperations,
      failedOperations,
      averageDuration: Math.round(averageDuration),
      minDuration,
      maxDuration,
      p95Duration,
      p99Duration,
      operationsPerHour: Math.round(operationsPerHour * 100) / 100
    };
  }

  /**
   * Get detailed operation history
   */
  getOperationHistory(limit: number = 50): OperationMetrics[] {
    return this.operations.slice(-limit);
  }

  /**
   * Reset metrics (useful for periodic snapshots)
   */
  reset(): void {
    this.startTime = Date.now();
    this.accountsTracked = 0;
    this.accountsAnalyzed = 0;
    this.accountsReclaimable = 0;
    this.reclaimsAttempted = 0;
    this.reclaimsSuccessful = 0;
    this.reclaimsFailed = 0;
    this.totalRentReclaimed = 0;
    this.transactionErrors = 0;
    this.rpcErrors = 0;
    this.operations = [];
    this.lastReclaimTimestamp = null;
    this.lastErrorTimestamp = null;
    this.lastErrorMessage = null;
    logger.info('Metrics collector reset');
  }

  /**
   * Calculate average analysis time
   */
  private calculateAverageAnalysisTime(): number {
    const analyzeOps = this.operations.filter(op => op.operationType === 'analyze');
    if (analyzeOps.length === 0) return 0;

    const totalTime = analyzeOps.reduce((sum, op) => sum + (op.duration || 0), 0);
    return Math.round(totalTime / analyzeOps.length);
  }
}
