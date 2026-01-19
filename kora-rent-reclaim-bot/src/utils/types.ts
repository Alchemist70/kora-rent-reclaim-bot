/**
 * Core type definitions for the Kora Rent Reclaim Bot
 * These types ensure type safety across the entire application
 */

import { PublicKey } from "@solana/web3.js";

/**
 * Represents a sponsored account we're tracking
 * This is created when we detect an account was created via Kora sponsorship
 */
export interface SponsoredAccount {
  /** The public key of the account */
  publicKey: PublicKey;
  
  /** The program that owns this account (e.g., System, SPL-Token, custom) */
  ownerProgram: PublicKey;
  
  /** Lamports locked as rent-exempt balance at creation */
  rentLamportsAtCreation: number;
  
  /** Slot number when the account was created */
  creationSlot: number;
  
  /** Signature of the transaction that created this account */
  creationTxSignature: string;
  
  /** Timestamp of account creation (unix epoch) */
  createdAt: number;
  
  /** Last time we checked this account */
  lastCheckedAt: number;
}

/**
 * Current state of an account as observed on-chain
 */
export interface AccountState {
  /** The public key of the account */
  publicKey: PublicKey;
  
  /** Current lamports balance */
  lamports: number;
  
  /** Indicates if account still exists on-chain */
  exists: boolean;
  
  /** Current owner program */
  owner: PublicKey;
  
  /** Whether this account is exempt from rent collection */
  rentExempt: boolean;
  
  /** Slot of last modification to this account */
  lastModifiedSlot: number;
  
  /** Raw account data (serialized) */
  data: Buffer;
  
  /** Is this a PDA? */
  isPda: boolean;
  
  /** Is this an associated token account? */
  isAta: boolean;
  
  /** Type of account (if determinable) */
  accountType: AccountType;
}

/**
 * Account types we can safely identify
 */
export enum AccountType {
  UNKNOWN = "UNKNOWN",
  SYSTEM = "SYSTEM",
  SPL_TOKEN_MINT = "SPL_TOKEN_MINT",
  SPL_TOKEN_ACCOUNT = "SPL_TOKEN_ACCOUNT",
  ATA = "ATA", // Associated Token Account
  PDA = "PDA", // Program Derived Address (generic)
  PROGRAM = "PROGRAM",
}

/**
 * Analysis result for a single account
 * Determines if it's safe to reclaim rent from this account
 */
export interface AccountAnalysis {
  /** The account being analyzed */
  publicKey: PublicKey;
  
  /** Can we safely reclaim rent? */
  isReclaimable: boolean;
  
  /** Why is it (not) reclaimable? */
  reason: string;
  
  /** Current state of the account */
  currentState: AccountState;
  
  /** Original creation info */
  sponsoredAccount: SponsoredAccount;
  
  /** How much rent could we reclaim (lamports) */
  reclaimableLamports: number;
  
  /** Inactivity period in slots */
  inactivitySlots: number;
  
  /** Was this flagged as risky? */
  riskFlags: RiskFlag[];
}

/**
 * Risk flags indicate potential issues with reclaiming
 */
export enum RiskFlag {
  PDA = "PDA",
  UNKNOWN_PROGRAM = "UNKNOWN_PROGRAM",
  HAS_TOKEN_BALANCE = "HAS_TOKEN_BALANCE",
  RECENT_ACTIVITY = "RECENT_ACTIVITY",
  BELOW_INACTIVITY_THRESHOLD = "BELOW_INACTIVITY_THRESHOLD",
  NON_EMPTY_SYSTEM_ACCOUNT = "NON_EMPTY_SYSTEM_ACCOUNT",
  CUSTOM_DATA = "CUSTOM_DATA",
}

/**
 * Safety check result
 * Determines if we should proceed with reclaim based on multiple factors
 */
export interface SafetyCheckResult {
  /** Should we proceed with reclaim? */
  approved: boolean;
  
  /** Why or why not? */
  reason: string;
  
  /** Individual check results */
  checks: SafetyCheck[];
  
  /** Timestamp of safety check */
  checkedAt: number;
}

/**
 * Individual safety check
 */
export interface SafetyCheck {
  /** Name of the check (e.g., "isPda", "hasTokenBalance") */
  name: string;
  
  /** Did it pass? */
  passed: boolean;
  
  /** Details about the check */
  details: string;
}

/**
 * A reclaim action to be executed or that was executed
 */
export interface ReclaimAction {
  /** Account to reclaim from */
  accountPubkey: PublicKey;
  
  /** Where to send the reclaimed SOL */
  treasuryAddress: PublicKey;
  
  /** How much to reclaim (lamports) */
  amount: number;
  
  /** Reason for the reclaim */
  reason: string;
  
  /** Transaction signature (null if not executed yet) */
  txSignature: string | null;
  
  /** Status of the action */
  status: ReclaimStatus;
  
  /** Timestamp when this action was created */
  createdAt: number;
  
  /** Timestamp when it was executed (if applicable) */
  executedAt?: number;
  
  /** Error message if it failed */
  errorMessage?: string;
}

/**
 * Status of a reclaim action
 */
export enum ReclaimStatus {
  PENDING = "PENDING",
  SUBMITTED = "SUBMITTED",
  CONFIRMED = "CONFIRMED",
  FAILED = "FAILED",
  DRY_RUN = "DRY_RUN",
}

/**
 * Summary report of reclaim results
 */
export interface ReclaimReport {
  /** Timestamp of the report */
  timestamp: number;
  
  /** Total accounts tracked */
  totalTracked: number;
  
  /** Accounts found to exist on-chain */
  existingAccounts: number;
  
  /** Accounts found reclaimable */
  reclaimableAccounts: number;
  
  /** Total rent locked (lamports) */
  totalRentLocked: number;
  
  /** Total rent reclaimed (lamports) */
  totalReclaimedLamports: number;
  
  /** Total rent still locked (lamports) */
  totalStillLocked: number;
  
  /** Actions that were executed */
  actions: ReclaimAction[];
  
  /** Summary by reason */
  reasonSummary: Map<string, number>;
  
  /** Dry-run mode? */
  isDryRun: boolean;
}

/**
 * Configuration for the bot
 */
export interface BotConfig {
  /** Solana RPC endpoint */
  rpcUrl: string;
  
  /** Network cluster (devnet, testnet, mainnet-beta) */
  cluster: "devnet" | "testnet-beta" | "mainnet-beta";
  
  /** Path to operator keypair JSON file */
  keypairPath: string;
  
  /** Treasury address to receive reclaimed SOL */
  treasuryAddress: PublicKey;
  
  /** Path to sponsored accounts index file */
  indexPath: string;
  
  /** Path to audit log */
  auditLogPath: string;
  
  /** Minimum inactivity in slots before reclaim is allowed */
  minInactivitySlots: number;
  
  /** Maximum retries for RPC calls */
  maxRetries: number;
  
  /** Retry delay in milliseconds */
  retryDelayMs: number;
  
  /** Allowed programs (if empty, none allowed except system) */
  allowedPrograms: PublicKey[];
  
  /** Dry-run mode (don't submit transactions) */
  dryRun: boolean;
  
  /** Log level */
  logLevel: "debug" | "info" | "warn" | "error";
  
  /** Telegram alerting configuration (optional) */
  telegram?: {
    enabled: boolean;
    botToken: string;
    chatId: string;
    alerts?: {
      reclaimThreshold?: number;  // Min SOL to alert on reclaim
      idleThreshold?: number;      // Min idle SOL to alert
      dailySummary?: boolean;      // Send daily summary
    };
  };
  
  /** Dashboard server configuration */
  dashboard?: {
    enabled: boolean;
    port: number;
    host: string;
  };
}

/**
 * State of the indexer - persisted to disk
 */
export interface IndexerState {
  /** All accounts we're tracking */
  sponsoredAccounts: SponsoredAccount[];
  
  /** Last slot we indexed up to */
  lastIndexedSlot: number;
  
  /** Last time we indexed */
  lastIndexedAt: number;
  
  /** Total accounts ever indexed */
  totalIndexed: number;
}
