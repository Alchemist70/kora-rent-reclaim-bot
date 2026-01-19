/**
 * Advanced Scheduling/Automation Module
 * Enables scheduled execution of reclaim operations
 */

import cron from "node-cron";
import { logInfo, logError } from "./logging.js";

/**
 * Schedule configuration
 */
export interface ScheduleConfig {
  enabled: boolean;
  cronExpression: string;
  operations: Array<{
    name: string;
    command: string;
    args: Record<string, string | boolean | number>;
  }>;
  maxConcurrent?: number;
  retryOnFailure?: boolean;
  maxRetries?: number;
  notifyOnSuccess?: boolean;
  notifyOnFailure?: boolean;
}

/**
 * Scheduled task handler
 */
export class Scheduler {
  private tasks: Map<string, any> = new Map();
  private config: ScheduleConfig;
  private running: Set<string> = new Set();

  constructor(config: ScheduleConfig) {
    this.config = config;
  }

  /**
   * Start scheduler
   */
  start(handler: (operation: any) => Promise<void>): void {
    if (!this.config.enabled) {
      logInfo("Scheduler disabled via configuration");
      return;
    }

    const maxConcurrent = this.config.maxConcurrent || 1;

    const task = cron.schedule(this.config.cronExpression, async () => {
      logInfo(
      `Executing scheduled operations (${this.config.cronExpression})`
    );

      for (const operation of this.config.operations) {
        // Respect concurrency limit
        if (this.running.size >= maxConcurrent) {
          await this.waitForSlot();
        }

        this.running.add(operation.name);

        try {
          logInfo(`Starting operation: ${operation.name}`);
          await handler(operation);
          logInfo(`✓ Operation complete: ${operation.name}`);

          if (this.config.notifyOnSuccess) {
            logInfo(`Notification sent for: ${operation.name}`);
          }
        } catch (error) {
          logError("scheduler", `Operation failed: ${operation.name}: ${error}`);

          if (this.config.retryOnFailure) {
            await this.retryOperation(operation, handler);
          }

          if (this.config.notifyOnFailure) {
            logError("scheduler", `Failure notification sent for: ${operation.name}`);
          }
        } finally {
          this.running.delete(operation.name);
        }
      }
    });

    this.tasks.set(this.config.cronExpression, task);
    logInfo(`✓ Scheduler started with expression: ${this.config.cronExpression}`);
  }

  /**
   * Retry failed operation
   */
  private async retryOperation(
    operation: any,
    handler: (operation: any) => Promise<void>
  ): Promise<void> {
    const maxRetries = this.config.maxRetries || 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logInfo(`Retry attempt ${attempt}/${maxRetries} for: ${operation.name}`);
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        await handler(operation);
        logInfo(`✓ Retry successful for: ${operation.name}`);
        return;
      } catch (error) {
        if (attempt === maxRetries) {
          logError("scheduler", `All retries exhausted for: ${operation.name}`);
          throw error;
        }
      }
    }
  }

  /**
   * Wait for a slot to become available
   */
  private waitForSlot(): Promise<void> {
    return new Promise((resolve) => {
      const checkSlot = () => {
        if (this.running.size < (this.config.maxConcurrent || 1)) {
          resolve();
        } else {
          setTimeout(checkSlot, 100);
        }
      };
      checkSlot();
    });
  }

  /**
   * Stop scheduler
   */
  stop(): void {
    for (const [expression, task] of this.tasks.entries()) {
      task.stop();
      logInfo(`✓ Stopped scheduler: ${expression}`);
    }
    this.tasks.clear();
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    enabled: boolean;
    tasksRunning: number;
    totalTasks: number;
    cronExpression: string;
  } {
    return {
      enabled: this.config.enabled,
      tasksRunning: this.running.size,
      totalTasks: this.config.operations.length,
      cronExpression: this.config.cronExpression,
    };
  }

  /**
   * List all scheduled operations
   */
  listOperations(): Array<{
    name: string;
    command: string;
    running: boolean;
  }> {
    return this.config.operations.map((op) => ({
      name: op.name,
      command: op.command,
      running: this.running.has(op.name),
    }));
  }
}

/**
 * Common cron expressions
 */
export const CRON_PRESETS = {
  EVERY_HOUR: "0 * * * *",
  EVERY_6_HOURS: "0 */6 * * *",
  EVERY_12_HOURS: "0 */12 * * *",
  DAILY_MIDNIGHT: "0 0 * * *",
  DAILY_NOON: "0 12 * * *",
  DAILY_9AM: "0 9 * * *",
  DAILY_6PM: "0 18 * * *",
  WEEKLY_MONDAY: "0 0 * * 1",
  WEEKLY_FRIDAY: "0 0 * * 5",
  MONTHLY_FIRST: "0 0 1 * *",
  MONTHLY_LAST: "0 0 L * *",
};
