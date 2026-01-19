/**
 * RPC Failover System
 * Automatically switches between multiple Solana RPC endpoints
 * on connection failures to ensure high availability
 */

import { Connection } from "@solana/web3.js";
import { logWarn, logInfo, logError, logDebug } from "./logging.js";

export interface RPCEndpoint {
  url: string;
  name: string;
  weight?: number; // 0-100, higher = prioritized
}

export class RPCFailover {
  private endpoints: RPCEndpoint[];
  private currentIndex: number = 0;
  private failureCount: Map<string, number> = new Map();
  private lastSuccessful: RPCEndpoint | null = null;

  constructor(endpoints: RPCEndpoint[]) {
    if (endpoints.length === 0) {
      throw new Error("At least one RPC endpoint required");
    }
    
    // Sort by weight (higher weight = prioritized)
    this.endpoints = [...endpoints].sort((a, b) => 
      (b.weight || 50) - (a.weight || 50)
    );
    
    logDebug(`Initialized RPC failover with ${endpoints.length} endpoints`);
  }

  /**
   * Get the next working RPC endpoint with automatic failover
   */
  async getNextWorkingEndpoint(
    timeout: number = 5000
  ): Promise<{ connection: Connection; endpoint: RPCEndpoint }> {
    const maxAttempts = this.endpoints.length;
    const startIndex = this.currentIndex;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const endpoint = this.endpoints[this.currentIndex];
      const failures = this.failureCount.get(endpoint.url) || 0;

      logDebug(
        `Testing RPC endpoint: ${endpoint.name} ` +
        `(${endpoint.url.substring(0, 50)}...) ` +
        `[Failures: ${failures}]`
      );

      try {
        const connection = new Connection(endpoint.url, "confirmed");

        // Test connection with timeout
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Connection timeout")), timeout)
        );

        await Promise.race([connection.getSlot(), timeoutPromise]);

        // Success
        this.failureCount.set(endpoint.url, 0);
        this.lastSuccessful = endpoint;

        logInfo(`✓ Connected to ${endpoint.name}`);

        return { connection, endpoint };
      } catch (error) {
        const newFailureCount = failures + 1;
        this.failureCount.set(endpoint.url, newFailureCount);

        const errorMessage =
          error instanceof Error ? error.message : String(error);

        logWarn(
          `RPC endpoint ${endpoint.name} failed ` +
          `(attempt ${newFailureCount}): ${errorMessage}`
        );

        // Move to next endpoint
        this.currentIndex = (this.currentIndex + 1) % this.endpoints.length;
      }
    }

    // All endpoints failed
    const endpointNames = this.endpoints.map((e) => e.name).join(", ");
    const errorMsg = `All RPC endpoints failed. Tried: ${endpointNames}`;

    logError("RPC Failover", errorMsg);

    throw new Error(errorMsg);
  }

  /**
   * Get current endpoint status
   */
  getStatus() {
    return this.endpoints.map((endpoint) => ({
      name: endpoint.name,
      url: endpoint.url,
      weight: endpoint.weight || 50,
      failures: this.failureCount.get(endpoint.url) || 0,
      isLastSuccessful: this.lastSuccessful?.url === endpoint.url,
    }));
  }

  /**
   * Reset all failure counters and state
   */
  reset() {
    logInfo("Resetting RPC failover state");
    this.failureCount.clear();
    this.currentIndex = 0;
    this.lastSuccessful = null;
  }

  /**
   * Get last successfully connected endpoint
   */
  getLastSuccessful(): RPCEndpoint | null {
    return this.lastSuccessful;
  }

  /**
   * Mark an endpoint as failed manually
   */
  markFailed(url: string) {
    const failures = (this.failureCount.get(url) || 0) + 1;
    this.failureCount.set(url, failures);
    logWarn(`Manually marked endpoint as failed: ${url} (${failures} failures)`);
  }

  /**
   * Mark an endpoint as successful
   */
  markSuccessful(url: string) {
    this.failureCount.set(url, 0);
    const endpoint = this.endpoints.find((e) => e.url === url);
    if (endpoint) {
      this.lastSuccessful = endpoint;
    }
    logInfo(`Marked endpoint as successful: ${url}`);
  }

  /**
   * Get the total number of endpoints
   */
  getEndpointCount(): number {
    return this.endpoints.length;
  }

  /**
   * Get list of endpoints
   */
  getEndpoints(): RPCEndpoint[] {
    return [...this.endpoints];
  }
}

/**
 * Parse multiple RPC endpoints from pipe-separated string
 * Example: "https://rpc1.com|https://rpc2.com|https://rpc3.com"
 */
export function parseRPCEndpoints(rpcString: string): RPCEndpoint[] {
  return rpcString
    .split("|")
    .map((url, index) => ({
      url: url.trim(),
      name: `RPC-${index + 1}`,
      weight: 100 - index * 10, // First is highest priority
    }))
    .filter((endpoint) => endpoint.url.length > 0);
}

/**
 * Create a failover instance from comma or pipe-separated RPC URLs
 */
export function createRPCFailover(rpcString: string): RPCFailover {
  const endpoints = parseRPCEndpoints(rpcString);

  if (endpoints.length === 0) {
    throw new Error("No valid RPC endpoints provided");
  }

  return new RPCFailover(endpoints);
}
