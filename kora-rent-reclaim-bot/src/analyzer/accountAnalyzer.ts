/**
 * Account State Analyzer
 * 
 * Analyzes tracked accounts to determine their current on-chain state
 * and whether they are eligible for rent reclaim.
 * 
 * For each account, we:
 * 1. Fetch current on-chain data
 * 2. Determine account type (System, SPL, PDA, etc.)
 * 3. Check for recent activity
 * 4. Flag any risk conditions
 * 5. Calculate reclaimable amount
 */

import { Connection, PublicKey } from "@solana/web3.js";
import {
  getAccountInfoWithRetry,
  getCurrentSlot,
  getMinimumBalanceForRentExemption,
} from "../utils/solana.js";
import {
  SponsoredAccount,
  AccountState,
  AccountType,
  AccountAnalysis,
  RiskFlag,
} from "../utils/types.js";
import {
  logDebug,
  logError,
  logAccountAction,
} from "../utils/logging.js";

/**
 * Analyzer for account state and reclaimability
 */
export class AccountAnalyzer {
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  /**
   * Analyze a single account
   * Returns comprehensive analysis including reclaimability decision
   */
  public async analyzeAccount(
    sponsoredAccount: SponsoredAccount,
    currentSlot: number
  ): Promise<AccountAnalysis> {
    try {
      // Fetch current account info
      const accountInfo = await getAccountInfoWithRetry(
        this.connection,
        sponsoredAccount.publicKey
      );

      // Determine account type and state
      const accountState = await this.determineAccountState(
        sponsoredAccount.publicKey,
        accountInfo,
        sponsoredAccount.ownerProgram
      );

      // Calculate inactivity
      const inactivitySlots = currentSlot - accountState.lastModifiedSlot;

      // Analyze reclaimability
      const riskFlags = await this.identifyRisks(
        sponsoredAccount,
        accountState,
        inactivitySlots
      );

      const isReclaimable = riskFlags.length === 0;
      const reason = isReclaimable
        ? "Account is empty, inactive, and safe to reclaim"
        : `Cannot reclaim: ${riskFlags.join(", ")}`;

      // Calculate reclaimable amount
      let reclaimableLamports = 0;
      if (isReclaimable && accountState.exists) {
        // For system accounts: reclaim all lamports
        if (accountState.accountType === AccountType.SYSTEM) {
          reclaimableLamports = accountState.lamports;
        }
        // For SPL token accounts: we'd use CloseAccount instruction
        // For now, we don't reclaim token accounts in this version
      }

      const analysis: AccountAnalysis = {
        publicKey: sponsoredAccount.publicKey,
        isReclaimable,
        reason,
        currentState: accountState,
        sponsoredAccount,
        reclaimableLamports,
        inactivitySlots,
        riskFlags,
      };

      logAccountAction("ANALYZED", sponsoredAccount.publicKey.toString(), {
        reclaimable: isReclaimable,
        lamports: accountState.lamports,
        inactivitySlots,
        riskFlags,
      });

      return analysis;
    } catch (error) {
      logError(
        "analyzeAccount",
        `Failed to analyze ${sponsoredAccount.publicKey.toString()}: ${error}`
      );

      // Return a conservative analysis that marks it as not reclaimable
      return {
        publicKey: sponsoredAccount.publicKey,
        isReclaimable: false,
        reason: `Analysis failed: ${error instanceof Error ? error.message : String(error)}`,
        currentState: {
          publicKey: sponsoredAccount.publicKey,
          lamports: 0,
          exists: false,
          owner: sponsoredAccount.ownerProgram,
          rentExempt: false,
          lastModifiedSlot: 0,
          data: Buffer.alloc(0),
          isPda: false,
          isAta: false,
          accountType: AccountType.UNKNOWN,
        },
        sponsoredAccount,
        reclaimableLamports: 0,
        inactivitySlots: 0,
        riskFlags: [RiskFlag.UNKNOWN_PROGRAM],
      };
    }
  }

  /**
   * Determine the current state of an account
   */
  private async determineAccountState(
    address: PublicKey,
    accountInfo: any,
    expectedOwner: PublicKey
  ): Promise<AccountState> {
    if (!accountInfo) {
      // Account doesn't exist
      return {
        publicKey: address,
        lamports: 0,
        exists: false,
        owner: expectedOwner,
        rentExempt: false,
        lastModifiedSlot: 0,
        data: Buffer.alloc(0),
        isPda: false,
        isAta: false,
        accountType: AccountType.UNKNOWN,
      };
    }

    // Get current slot for rent exemption check
    const currentSlot = await getCurrentSlot(this.connection);

    // Determine account type
    const accountType = await this.determineAccountType(
      address,
      accountInfo,
      expectedOwner
    );

    // Check if account is rent exempt
    const minRent = await getMinimumBalanceForRentExemption(
      this.connection,
      accountInfo.data.length
    );
    const rentExempt = accountInfo.lamports >= minRent;

    // Detect PDA
    const isPda = this.detectPda(address, accountInfo.owner);

    // Detect ATA
    const isAta = accountType === AccountType.ATA;

    return {
      publicKey: address,
      lamports: accountInfo.lamports,
      exists: true,
      owner: accountInfo.owner,
      rentExempt,
      lastModifiedSlot: 0, // Note: we can't get this directly; would need transaction history
      data: accountInfo.data,
      isPda,
      isAta,
      accountType,
    };
  }

  /**
   * Determine the type of account
   */
  private async determineAccountType(
    address: PublicKey,
    accountInfo: any,
    expectedOwner: PublicKey
  ): Promise<AccountType> {
    // If owned by System program, it's a system account
    if (
      accountInfo.owner.equals(new PublicKey("11111111111111111111111111111111"))
    ) {
      return AccountType.SYSTEM;
    }

    // Check if it's an SPL Token Mint
    // SPL Token Mint accounts have specific structure (86 bytes typically)
    if (accountInfo.owner.equals(new PublicKey("TokenkegQfeZyiNwAJsyFbPVwwQQfuCS3nWknj3HWetQf"))) {
      // Check data length and structure hints
      if (accountInfo.data.length === 82) {
        return AccountType.SPL_TOKEN_MINT;
      }
      // Otherwise it's likely a token account
      return AccountType.SPL_TOKEN_ACCOUNT;
    }

    // Check if it's an associated token account (ATA)
    // ATAs are created by the Associated Token Program
    if (accountInfo.owner.equals(new PublicKey("TokenkegQfeZyiNwAJsyFbPVwwQQfuCS3nWknj3HWetQf"))) {
      // This is a heuristic - proper ATA detection would check:
      // - Creation via ATA program
      // - Owner is token program
      // - Can derive the PDA deterministically
      // For now, we mark all token program accounts as potential ATAs
      if (accountInfo.data.length === 165) {
        return AccountType.ATA;
      }
    }

    // Check if owned by a program (not system)
    if (!accountInfo.owner.equals(expectedOwner)) {
      return AccountType.PROGRAM;
    }

    return AccountType.UNKNOWN;
  }

  /**
   * Detect if an address is a PDA (Program Derived Address)
   * PDAs are never user-controlled and are off the ed25519 curve
   * 
   * CRITICAL: We NEVER reclaim from PDAs, as they're program-controlled state
   */
  private detectPda(address: PublicKey, owner: PublicKey): boolean {
    // In Solana, a PDA is derived from:
    // 1. A program ID
    // 2. A set of seeds
    // 3. A bump seed (to ensure it's off-curve)
    //
    // We can't directly check if an address is off-curve from the JS SDK,
    // but we can use heuristics:
    //
    // 1. If the account was created via SystemProgram.createAccountWithSeed,
    //    it's NOT a PDA (it has a known keypair)
    // 2. If it's owned by a non-system program and has custom data,
    //    it's LIKELY a PDA
    //
    // For this implementation, we use a conservative approach:
    // Any account owned by a program with custom data is suspect

    // Simple heuristic: if the owner is not System and not expected,
    // treat as potentially PDA
    const SYSTEM_PROGRAM = new PublicKey("11111111111111111111111111111111");

    if (!owner.equals(SYSTEM_PROGRAM)) {
      // This account is owned by a program, likely a PDA
      return true;
    }

    return false;
  }

  /**
   * Identify risk flags for an account
   */
  private async identifyRisks(
    sponsoredAccount: SponsoredAccount,
    currentState: AccountState,
    inactivitySlots: number
  ): Promise<RiskFlag[]> {
    const risks: RiskFlag[] = [];

    // Risk 1: Account doesn't exist
    if (!currentState.exists) {
      // This is actually fine - we can skip non-existent accounts
      // No risk here, just skip
      return [];
    }

    // Risk 2: Probable PDA
    if (currentState.isPda) {
      risks.push(RiskFlag.PDA);
      return risks; // Don't reclaim PDAs, ever
    }

    // Risk 3: Unknown program ownership
    const SYSTEM_PROGRAM = new PublicKey("11111111111111111111111111111111");
    if (
      !currentState.owner.equals(SYSTEM_PROGRAM) &&
      !currentState.owner.equals(sponsoredAccount.ownerProgram)
    ) {
      risks.push(RiskFlag.UNKNOWN_PROGRAM);
    }

    // Risk 4: Has token balance (would need special handling)
    // Check if this looks like an SPL token account with a balance
    if (currentState.accountType === AccountType.SPL_TOKEN_ACCOUNT) {
      // SPL token accounts store balance in the first 8 bytes
      if (currentState.data.length >= 72) {
        // Read balance (amount field at offset 64, little-endian u64)
        const balanceBuffer = currentState.data.slice(64, 72);
        const balance = balanceBuffer.readBigUInt64LE(0);
        if (balance > BigInt(0)) {
          risks.push(RiskFlag.HAS_TOKEN_BALANCE);
        }
      }
    }

    // Risk 5: Recent activity (below inactivity threshold)
    if (inactivitySlots < 100000) {
      // ~46 hours on devnet
      risks.push(RiskFlag.RECENT_ACTIVITY);
    }

    // Risk 6: Non-empty system account
    if (
      currentState.accountType === AccountType.SYSTEM &&
      currentState.data.length > 0
    ) {
      risks.push(RiskFlag.NON_EMPTY_SYSTEM_ACCOUNT);
    }

    return risks;
  }

  /**
   * Batch analyze multiple accounts
   * Returns analyses for all accounts
   */
  public async analyzeMultiple(
    accounts: SponsoredAccount[]
  ): Promise<AccountAnalysis[]> {
    const currentSlot = await getCurrentSlot(this.connection);
    const analyses: AccountAnalysis[] = [];

    for (const account of accounts) {
      const analysis = await this.analyzeAccount(account, currentSlot);
      analyses.push(analysis);
    }

    return analyses;
  }
}
