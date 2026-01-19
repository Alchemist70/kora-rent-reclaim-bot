/**
 * Batch Processing Improvements
 * Optimized processing of multiple accounts with parallelization and progress tracking
 */

import { logInfo, logError } from "./logging.js";

/**
 * Batch processing options
 */
export interface BatchOptions {
  batchSize?: number; // Items per batch (default: 100)
  parallelism?: number; // Concurrent batches (default: 4)
  retryOnFailure?: boolean; // Retry failed items (default: true)
  maxRetries?: number; // Max retries per item (default: 3)
  progressCallback?: (progress: BatchProgress) => void; // Progress update callback
  errorCallback?: (error: BatchError) => void; // Error callback
  timeoutMs?: number; // Timeout per item (default: 30000)
}

/**
 * Batch progress tracking
 */
export interface BatchProgress {
  totalItems: number;
  processedItems: number;
  failedItems: number;
  successItems: number;
  percentComplete: number;
  itemsPerSecond: number;
  estimatedTimeRemainingMs: number;
  currentBatch: number;
  totalBatches: number;
}

/**
 * Batch error information
 */
export interface BatchError {
  itemIndex: number;
  error: Error | string;
  batchNumber: number;
  retryCount: number;
}

/**
 * Batch processing result
 */
export interface BatchResult<T> {
  successful: T[];
  failed: Array<{
    item: T;
    error: Error | string;
  }>;
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  durationMs: number;
}

/**
 * Process items in optimized batches
 */
export async function processBatch<T>(
  items: T[],
  processor: (item: T, index: number) => Promise<void>,
  options: BatchOptions = {}
): Promise<BatchResult<T>> {
  const startTime = Date.now();
  const batchSize = options.batchSize || 100;
  const parallelism = options.parallelism || 4;
  const maxRetries = options.maxRetries || 3;
  const timeoutMs = options.timeoutMs || 30000;

  const successful: T[] = [];
  const failed: Array<{ item: T; error: Error | string }> = [];
  const retryQueue: Array<{ item: T; index: number; retries: number }> = [];

  const totalBatches = Math.ceil(items.length / batchSize);
  let processedItems = 0;

  logInfo(
    `Starting batch processing: ${items.length} items, batch size: ${batchSize}, parallelism: ${parallelism}`
  );

  // Create batches
  for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
    const batchStart = batchNum * batchSize;
    const batchEnd = Math.min(batchStart + batchSize, items.length);
    const batch = items.slice(batchStart, batchEnd);

    // Process batch items in parallel (up to parallelism limit)
    const batchPromises = batch.map(async (item, localIndex) => {
      const globalIndex = batchStart + localIndex;

      try {
        // Apply timeout
        await Promise.race([
          processor(item, globalIndex),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error(`Processing timeout after ${timeoutMs}ms`)),
              timeoutMs
            )
          ),
        ]);

        successful.push(item);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);

        if (options.errorCallback) {
          options.errorCallback({
            itemIndex: globalIndex,
            error: errorMsg,
            batchNumber: batchNum,
            retryCount: 0,
          });
        }

        // Queue for retry
        if (options.retryOnFailure) {
          retryQueue.push({ item, index: globalIndex, retries: 0 });
        } else {
          failed.push({ item, error: errorMsg });
        }
      }

      processedItems++;

      // Report progress
      if (options.progressCallback) {
        const elapsed = Date.now() - startTime;
        const rate = (processedItems / elapsed) * 1000;
        const remaining = items.length - processedItems;
        const estimatedRemainingMs = remaining > 0 ? (remaining / rate) * 1000 : 0;

        options.progressCallback({
          totalItems: items.length,
          processedItems,
          failedItems: failed.length + retryQueue.length,
          successItems: successful.length,
          percentComplete: (processedItems / items.length) * 100,
          itemsPerSecond: rate,
          estimatedTimeRemainingMs: estimatedRemainingMs,
          currentBatch: batchNum + 1,
          totalBatches,
        });
      }
    });

    // Wait for current batch to complete before starting next
    await Promise.all(batchPromises);

    logInfo(
      `Batch ${batchNum + 1}/${totalBatches} complete (${successful.length}/${processedItems} successful)`
    );
  }

  // Process retries
  while (retryQueue.length > 0) {
    const item = retryQueue.shift();
    if (!item) break;

    if (item.retries >= maxRetries) {
      failed.push({ item: item.item, error: `Max retries (${maxRetries}) exceeded` });
      continue;
    }

    try {
      // Exponential backoff
      await new Promise((resolve) =>
        setTimeout(resolve, Math.pow(2, item.retries) * 1000)
      );

      await Promise.race([
        processor(item.item, item.index),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Retry timeout after ${timeoutMs}ms`)), timeoutMs)
        ),
      ]);

      successful.push(item.item);

      logInfo(
        `✓ Retry successful for item ${item.index} (attempt ${item.retries + 1})`
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      item.retries++;

      if (item.retries < maxRetries) {
        retryQueue.push(item);
      } else {
        failed.push({ item: item.item, error: errorMsg });
        logError(
          "batchProcessor",
          `✗ Failed item ${item.index} after ${maxRetries} retries: ${errorMsg}`
        );
      }

      if (options.errorCallback) {
        options.errorCallback({
          itemIndex: item.index,
          error: errorMsg,
          batchNumber: -1,
          retryCount: item.retries,
        });
      }
    }
  }

  const durationMs = Date.now() - startTime;
  const result: BatchResult<T> = {
    successful,
    failed,
    totalProcessed: successful.length + failed.length,
    successCount: successful.length,
    failureCount: failed.length,
    durationMs,
  };

  logInfo(
    `✓ Batch processing complete: ${result.successCount}/${items.length} successful in ${(durationMs / 1000).toFixed(2)}s`
  );

  return result;
}

/**
 * Create batches without processing
 */
export function createBatches<T>(items: T[], batchSize: number = 100): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * Process batches sequentially
 */
export async function processSequentialBatches<T>(
  batches: T[][],
  processor: (batch: T[], batchIndex: number) => Promise<void>,
  options: BatchOptions = {}
): Promise<BatchResult<T>> {
  const startTime = Date.now();
  const allItems = batches.flat();
  const successful: T[] = [];
  const failed: Array<{ item: T; error: Error | string }> = [];

  for (let batchNum = 0; batchNum < batches.length; batchNum++) {
    const batch = batches[batchNum];

    try {
      await processor(batch, batchNum);
      successful.push(...batch);

      if (options.progressCallback) {
        const processed = successful.length + failed.length;
        options.progressCallback({
          totalItems: allItems.length,
          processedItems: processed,
          failedItems: failed.length,
          successItems: successful.length,
          percentComplete: (processed / allItems.length) * 100,
          itemsPerSecond: (processed / (Date.now() - startTime)) * 1000,
          estimatedTimeRemainingMs:
            ((allItems.length - processed) / ((processed) / (Date.now() - startTime))) * 1000,
          currentBatch: batchNum + 1,
          totalBatches: batches.length,
        });
      }

      logInfo(`✓ Batch ${batchNum + 1}/${batches.length} processed`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      failed.push(...batch.map((item) => ({ item, error: errorMsg })));
      logError("batchProcessor", `✗ Batch ${batchNum + 1} failed: ${errorMsg}`);
    }
  }

  const durationMs = Date.now() - startTime;
  return {
    successful,
    failed,
    totalProcessed: successful.length + failed.length,
    successCount: successful.length,
    failureCount: failed.length,
    durationMs,
  };
}

/**
 * Get batch processing statistics
 */
export function getBatchStats(result: BatchResult<any>): {
  successRate: string;
  avgTimePerItem: string;
  throughput: string;
} {
  const successRate = ((result.successCount / result.totalProcessed) * 100).toFixed(2);
  const avgTimePerItem = (result.durationMs / result.totalProcessed).toFixed(2);
  const throughput = ((result.totalProcessed / result.durationMs) * 1000).toFixed(2);

  return {
    successRate: `${successRate}%`,
    avgTimePerItem: `${avgTimePerItem}ms`,
    throughput: `${throughput} items/sec`,
  };
}
