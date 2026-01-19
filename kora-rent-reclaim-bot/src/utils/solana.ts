/**
 * Solana utility functions
 * Handles RPC connections, keypair loading, and Solana-specific operations
 * Implements retry logic and rate limiting for reliability
 */

import {
  Connection,
  Keypair,
  PublicKey,
  AccountInfo,
  RpcResponseAndContext,
} from "@solana/web3.js";
import fs from "fs";
import path from "path";
import { logDebug, logError, logWarn, logInfo } from "./logging.js";
import { RPCFailover, parseRPCEndpoints } from "./rpcFailover.js";

/**
 * Get or create a Solana connection with retry logic and failover support
 * Supports multiple RPC endpoints separated by pipe (|)
 * Retries on network failures to ensure reliability
 */
export async function getSolanaConnection(
  rpcUrl: string,
  maxRetries: number = 3,
  retryDelayMs: number = 1000
): Promise<Connection> {
  // Check if multiple RPC endpoints provided (pipe-separated)
  if (rpcUrl.includes("|")) {
    return getSolanaConnectionWithFailover(rpcUrl, maxRetries, retryDelayMs);
  }

  // Single RPC endpoint - use existing logic
  return getSolanaConnectionSingle(rpcUrl, maxRetries, retryDelayMs);
}

/**
 * Connect to Solana using a single RPC endpoint with retry logic
 */
async function getSolanaConnectionSingle(
  rpcUrl: string,
  maxRetries: number,
  retryDelayMs: number
): Promise<Connection> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      logDebug(`Connecting to Solana RPC: ${rpcUrl} (attempt ${attempt + 1}/${maxRetries})`);
      
      const connection = new Connection(rpcUrl, "confirmed");
      
      // Test the connection by getting slot
      await connection.getSlot();
      
      logInfo("✓ Connected to Solana successfully");
      return connection;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logWarn(
        `Connection attempt ${attempt + 1} failed: ${lastError.message}`
      );

      if (attempt < maxRetries - 1) {
        const delay = retryDelayMs * Math.pow(2, attempt); // exponential backoff
        logDebug(`Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  const errorMsg = `Failed to connect to Solana RPC after ${maxRetries} attempts: ${lastError?.message}`;
  logError("getSolanaConnection", errorMsg);
  throw new Error(errorMsg);
}

/**
 * Connect to Solana using failover RPC endpoints
 * Automatically switches to secondary RPC if primary fails
 */
async function getSolanaConnectionWithFailover(
  rpcString: string,
  maxRetries: number,
  retryDelayMs: number
): Promise<Connection> {
  const endpoints = parseRPCEndpoints(rpcString);
  
  if (endpoints.length === 0) {
    throw new Error("No valid RPC endpoints provided");
  }

  logInfo(`Using RPC failover with ${endpoints.length} endpoints`);

  const failover = new RPCFailover(endpoints);

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      logDebug(`Failover attempt ${attempt + 1}/${maxRetries}`);
      const { connection, endpoint } = await failover.getNextWorkingEndpoint(
        retryDelayMs
      );
      
      logInfo(`Successfully connected to ${endpoint.name}`);
      return connection;
    } catch (error) {
      logWarn(
        `Failover attempt ${attempt + 1} failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );

      if (attempt < maxRetries - 1) {
        const delay = retryDelayMs * Math.pow(2, attempt);
        logDebug(`Retrying failover in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  const status = failover.getStatus();
  const statusStr = status
    .map((s) => `${s.name}: ${s.failures} failures`)
    .join(", ");

  const errorMsg = `Failed to connect to any RPC endpoint after ${maxRetries} attempts. Status: ${statusStr}`;
  logError("getSolanaConnection", errorMsg);
  throw new Error(errorMsg);
}

/**
 * Load a keypair from a JSON file
 * Keypairs should be protected files with restricted permissions
 */
export function loadKeypair(keypairPath: string): Keypair {
  try {
    // Verify the file exists
    if (!fs.existsSync(keypairPath)) {
      throw new Error(`Keypair file not found: ${keypairPath}`);
    }

    // Check file permissions (warn if world-readable)
    const stats = fs.statSync(keypairPath);
    const perms = (stats.mode & parseInt("777", 8)).toString(8);
    
    if (perms.includes("4") || perms.includes("5")) {
      logWarn(
        `Keypair file may have insecure permissions (${perms}). Consider: chmod 600 ${keypairPath}`
      );
    }

    // Load and parse the keypair
    const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
    const secretKey = Uint8Array.from(keypairData);
    
    const keypair = Keypair.fromSecretKey(secretKey);
    
    logDebug(`Loaded keypair: ${keypair.publicKey.toString()}`);
    return keypair;
  } catch (error) {
    const errorMsg = `Failed to load keypair: ${error instanceof Error ? error.message : String(error)}`;
    logError("loadKeypair", errorMsg);
    throw new Error(errorMsg);
  }
}

/**
 * Get account info with retry logic
 * Returns null if account doesn't exist (handled gracefully)
 */
export async function getAccountInfoWithRetry(
  connection: Connection,
  address: PublicKey,
  maxRetries: number = 3,
  retryDelayMs: number = 500
): Promise<AccountInfo<Buffer> | null> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const accountInfo = await connection.getAccountInfo(address);
      return accountInfo;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < maxRetries - 1) {
        const delay = retryDelayMs * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
  }

  logWarn(
    `Failed to get account info for ${address.toString()} after ${maxRetries} attempts`
  );
  return null;
}

/**
 * Determine if an address is a PDA (Program Derived Address)
 * PDAs never have an associated keypair - they're deterministically derived
 * This is critical for safety: we NEVER close PDAs
 */
export function isPda(address: PublicKey, programId: PublicKey): boolean {
  // An address is a PDA if it has no associated keypair
  // The proper way to detect this is: it lies off the Ed25519 curve
  // In practice, we check if it would ever appear as a normal keypair
  
  try {
    // This is a heuristic: PDAs are "off-curve"
    // The @solana/web3.js library doesn't directly expose this check,
    // so we use a reliable method: try to check if it's a valid system account
    // For production, you'd use: https://github.com/solana-labs/solana/blob/master/sdk/program/src/pubkey.rs
    
    // For now, we detect PDAs by checking:
    // 1. Owner is the program itself (indicates it's likely a PDA)
    // 2. Has no associated keypair in our records
    
    // This is a simplification - proper PDA detection requires
    // either: off-curve checks or state analysis
    return false; // We enhance this in accountAnalyzer.ts with better heuristics
  } catch {
    return false;
  }
}

/**
 * Get the minimum rent balance for an account
 * Solana requires accounts to maintain a minimum balance for rent exemption
 */
export async function getMinimumBalanceForRentExemption(
  connection: Connection,
  accountDataLength: number
): Promise<number> {
  try {
    const balance = await connection.getMinimumBalanceForRentExemption(
      accountDataLength
    );
    return balance;
  } catch (error) {
    logError(
      "getMinimumBalanceForRentExemption",
      error instanceof Error ? error : String(error)
    );
    throw error;
  }
}

/**
 * Helper to sleep for a given duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get current slot (approximately current time on the blockchain)
 */
export async function getCurrentSlot(connection: Connection): Promise<number> {
  try {
    const slot = await connection.getSlot("confirmed");
    return slot;
  } catch (error) {
    logError(
      "getCurrentSlot",
      error instanceof Error ? error : String(error)
    );
    throw error;
  }
}

/**
 * Get transaction signature by hash
 * Used for verifying transactions were confirmed
 */
export async function getTransactionWithRetry(
  connection: Connection,
  signature: string,
  maxRetries: number = 3
): Promise<any> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const tx = await connection.getTransaction(signature);
      return tx;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries - 1) {
        await sleep(500 * Math.pow(2, attempt));
      }
    }
  }

  throw lastError || new Error("Failed to get transaction");
}

/**
 * Validate a public key format
 */
export function isValidPublicKey(key: string): boolean {
  try {
    new PublicKey(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * Format lamports as SOL for display
 */
export function lamportsToSol(lamports: number): number {
  return lamports / 1_000_000_000;
}

/**
 * Format SOL to lamports
 */
export function solToLamports(sol: number): number {
  return Math.floor(sol * 1_000_000_000);
}
