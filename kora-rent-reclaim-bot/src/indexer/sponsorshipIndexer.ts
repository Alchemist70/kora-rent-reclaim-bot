/**
 * Sponsorship Indexer
 * 
 * This module tracks accounts created via Kora sponsorship.
 * It indexes transactions and extracts account creation instructions.
 * 
 * In production, this would typically:
 * - Query Kora's indexer API for sponsored transactions
 * - Or parse your operator's transaction history
 * - Extract SystemProgram.createAccount calls
 * - Track the created account pubkeys
 * 
 * For this bot, we implement a flexible system that can be extended
 * to work with various data sources.
 */

import fs from "fs";
import path from "path";
import { PublicKey, Connection } from "@solana/web3.js";
import {
  SponsoredAccount,
  IndexerState,
} from "../utils/types.js";
import {
  logInfo,
  logDebug,
  logError,
  logAccountAction,
} from "../utils/logging.js";

/**
 * SponsoredAccountIndexer tracks accounts created via Kora sponsorship
 */
export class SponsoredAccountIndexer {
  private indexFilePath: string;
  private state: IndexerState;

  constructor(indexFilePath: string) {
    this.indexFilePath = indexFilePath;
    this.state = this.loadIndexState();
  }

  /**
   * Load or create the index state file
   */
  private loadIndexState(): IndexerState {
    try {
      if (fs.existsSync(this.indexFilePath)) {
        const data = JSON.parse(fs.readFileSync(this.indexFilePath, "utf-8"));
        logDebug(`Loaded indexer state with ${data.sponsoredAccounts.length} accounts`);
        
        // Convert string keys back to PublicKey objects
        return {
          ...data,
          sponsoredAccounts: data.sponsoredAccounts.map((acc: any) => ({
            ...acc,
            publicKey: new PublicKey(acc.publicKey),
            ownerProgram: new PublicKey(acc.ownerProgram),
          })),
        };
      }
    } catch (error) {
      logError(
        "loadIndexState",
        error instanceof Error ? error.message : String(error)
      );
    }

    // Return empty state if file doesn't exist or fails to load
    return {
      sponsoredAccounts: [],
      lastIndexedSlot: 0,
      lastIndexedAt: Date.now(),
      totalIndexed: 0,
    };
  }

  /**
   * Save the index state to disk
   * This persists our tracking across bot restarts
   */
  private saveIndexState(): void {
    try {
      const dir = path.dirname(this.indexFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Convert PublicKey objects to strings for JSON serialization
      const serializable = {
        ...this.state,
        sponsoredAccounts: this.state.sponsoredAccounts.map((acc) => ({
          ...acc,
          publicKey: acc.publicKey.toString(),
          ownerProgram: acc.ownerProgram.toString(),
        })),
      };

      fs.writeFileSync(
        this.indexFilePath,
        JSON.stringify(serializable, null, 2)
      );
      logDebug(`Saved indexer state: ${this.state.sponsoredAccounts.length} accounts`);
    } catch (error) {
      logError(
        "saveIndexState",
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Register a sponsored account
   * This is called when we detect a new account creation
   */
  public registerAccount(account: SponsoredAccount): void {
    try {
      // Check if already tracked
      const existing = this.state.sponsoredAccounts.find(
        (acc) => acc.publicKey.equals(account.publicKey)
      );

      if (existing) {
        logDebug(`Account ${account.publicKey.toString()} already tracked`);
        return;
      }

      this.state.sponsoredAccounts.push(account);
      this.state.totalIndexed++;
      this.saveIndexState();

      logAccountAction("INDEXED", account.publicKey.toString(), {
        owner: account.ownerProgram.toString(),
        rentLamports: account.rentLamportsAtCreation,
        creationSlot: account.creationSlot,
      });
    } catch (error) {
      logError(
        "registerAccount",
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Get all tracked accounts
   */
  public getTrackedAccounts(): SponsoredAccount[] {
    return [...this.state.sponsoredAccounts];
  }

  /**
   * Get accounts by owner program
   */
  public getAccountsByOwner(owner: PublicKey): SponsoredAccount[] {
    return this.state.sponsoredAccounts.filter((acc) =>
      acc.ownerProgram.equals(owner)
    );
  }

  /**
   * Update last checked time for an account
   */
  public updateAccountLastChecked(accountPubkey: PublicKey): void {
    const account = this.state.sponsoredAccounts.find((acc) =>
      acc.publicKey.equals(accountPubkey)
    );

    if (account) {
      account.lastCheckedAt = Date.now();
      this.saveIndexState();
    }
  }

  /**
   * Remove an account from tracking (e.g., after successful reclaim)
   */
  public removeAccount(accountPubkey: PublicKey): void {
    const originalLength = this.state.sponsoredAccounts.length;
    this.state.sponsoredAccounts = this.state.sponsoredAccounts.filter(
      (acc) => !acc.publicKey.equals(accountPubkey)
    );

    if (this.state.sponsoredAccounts.length < originalLength) {
      this.saveIndexState();
      logAccountAction("REMOVED_FROM_INDEX", accountPubkey.toString(), {
        reason: "Successfully reclaimed or no longer relevant",
      });
    }
  }

  /**
   * Import accounts from an external source
   * This allows integration with Kora's indexer or other data sources
   * 
   * Format expected:
   * [
   *   {
   *     "publicKey": "...",
   *     "ownerProgram": "...",
   *     "rentLamportsAtCreation": 890880,
   *     "creationSlot": 123456,
   *     "creationTxSignature": "...",
   *     "createdAt": 1705689600
   *   }
   * ]
   */
  public importAccountsFromFile(importPath: string): number {
    try {
      if (!fs.existsSync(importPath)) {
        throw new Error(`Import file not found: ${importPath}`);
      }

      const importData = JSON.parse(fs.readFileSync(importPath, "utf-8"));

      if (!Array.isArray(importData)) {
        throw new Error("Import data must be an array of accounts");
      }

      let imported = 0;

      for (const item of importData) {
        try {
          const account: SponsoredAccount = {
            publicKey: new PublicKey(item.publicKey),
            ownerProgram: new PublicKey(item.ownerProgram),
            rentLamportsAtCreation: item.rentLamportsAtCreation,
            creationSlot: item.creationSlot,
            creationTxSignature: item.creationTxSignature,
            createdAt: item.createdAt,
            lastCheckedAt: Date.now(),
          };

          this.registerAccount(account);
          imported++;
        } catch (error) {
          logError("importAccountsFromFile", `Failed to import account: ${error}`);
        }
      }

      logInfo(`✓ Imported ${imported} accounts from ${importPath}`);
      return imported;
    } catch (error) {
      logError(
        "importAccountsFromFile",
        error instanceof Error ? error.message : String(error)
      );
      return 0;
    }
  }

  /**
   * Export tracked accounts to a file
   * Useful for backup or integration with other tools
   */
  public exportAccountsToFile(exportPath: string): void {
    try {
      const dir = path.dirname(exportPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const exportData = this.state.sponsoredAccounts.map((acc) => ({
        publicKey: acc.publicKey.toString(),
        ownerProgram: acc.ownerProgram.toString(),
        rentLamportsAtCreation: acc.rentLamportsAtCreation,
        creationSlot: acc.creationSlot,
        creationTxSignature: acc.creationTxSignature,
        createdAt: acc.createdAt,
        lastCheckedAt: acc.lastCheckedAt,
      }));

      fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));
      logInfo(`✓ Exported ${exportData.length} accounts to ${exportPath}`);
    } catch (error) {
      logError(
        "exportAccountsToFile",
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Get statistics about tracked accounts
   */
  public getStatistics(): {
    totalTracked: number;
    totalRentLocked: number;
    accountsByOwner: Map<string, number>;
    oldestCreation: number;
    newestCreation: number;
  } {
    const stats = {
      totalTracked: this.state.sponsoredAccounts.length,
      totalRentLocked: this.state.sponsoredAccounts.reduce(
        (sum, acc) => sum + acc.rentLamportsAtCreation,
        0
      ),
      accountsByOwner: new Map<string, number>(),
      oldestCreation: Date.now(),
      newestCreation: 0,
    };

    for (const account of this.state.sponsoredAccounts) {
      const owner = account.ownerProgram.toString();
      stats.accountsByOwner.set(
        owner,
        (stats.accountsByOwner.get(owner) || 0) + 1
      );

      stats.oldestCreation = Math.min(stats.oldestCreation, account.createdAt);
      stats.newestCreation = Math.max(stats.newestCreation, account.createdAt);
    }

    return stats;
  }
}
