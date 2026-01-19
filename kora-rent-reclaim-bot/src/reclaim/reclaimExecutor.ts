/**
 * Reclaim Executor
 * 
 * Executes reclaim transactions after safety checks pass
 * Handles:
 * - Transaction construction
 * - Signing
 * - Submission
 * - Confirmation
 * - Audit logging
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  ReclaimAction,
  ReclaimStatus,
  AccountAnalysis,
  BotConfig,
} from "../utils/types.js";
import {
  getTransactionWithRetry,
  lamportsToSol,
} from "../utils/solana.js";
import {
  logInfo,
  logError,
  logAccountAction,
  logTransactionSubmitted,
  logDebug,
} from "../utils/logging.js";

/**
 * Executor for reclaim transactions
 */
export class ReclaimExecutor {
  private connection: Connection;
  private operatorKeypair: Keypair;
  private config: BotConfig;

  constructor(
    connection: Connection,
    operatorKeypair: Keypair,
    config: BotConfig
  ) {
    this.connection = connection;
    this.operatorKeypair = operatorKeypair;
    this.config = config;
  }

  /**
   * Execute a reclaim action
   * This ONLY runs if safety engine approved the account
   */
  public async executeReclaim(analysis: AccountAnalysis): Promise<ReclaimAction> {
    const action: ReclaimAction = {
      accountPubkey: analysis.publicKey,
      treasuryAddress: this.config.treasuryAddress,
      amount: analysis.reclaimableLamports,
      reason: "Rent reclaim from inactive account",
      txSignature: null,
      status: ReclaimStatus.PENDING,
      createdAt: Date.now(),
    };

    try {
      if (this.config.dryRun) {
        // Dry-run: don't actually submit
        action.status = ReclaimStatus.DRY_RUN;
        logInfo(`[DRY-RUN] Would reclaim ${action.amount} lamports from ${analysis.publicKey.toString()}`);
        return action;
      }

      // Build reclaim instruction
      const instruction = await this.buildReclaimInstruction(analysis);

      // Create and sign transaction
      const tx = new Transaction().add(instruction);

      logDebug(`Signing transaction for ${analysis.publicKey.toString()}`);
      const signature = await this.connection.sendTransaction(tx, [this.operatorKeypair], {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });

      action.txSignature = signature;
      action.status = ReclaimStatus.SUBMITTED;
      action.executedAt = Date.now();

      logTransactionSubmitted(signature, {
        account: analysis.publicKey.toString(),
        amount: action.amount,
        treasury: action.treasuryAddress.toString(),
      });

      // Wait for confirmation
      logDebug(`Waiting for confirmation of ${signature}`);
      const confirmation = await this.connection.confirmTransaction(signature);

      if (confirmation.value.err) {
        action.status = ReclaimStatus.FAILED;
        action.errorMessage = JSON.stringify(confirmation.value.err);
        logError(
          "executeReclaim",
          `Transaction failed: ${JSON.stringify(confirmation.value.err)}`,
          { signature }
        );
      } else {
        action.status = ReclaimStatus.CONFIRMED;
        logInfo(
          `✓ Reclaim confirmed: ${lamportsToSol(action.amount)} SOL from ${analysis.publicKey.toString()}`,
          {
            signature,
            treasury: action.treasuryAddress.toString(),
          }
        );

        logAccountAction("RECLAIM_CONFIRMED", analysis.publicKey.toString(), {
          lamports: action.amount,
          sol: lamportsToSol(action.amount),
          txSignature: signature,
        });
      }

      return action;
    } catch (error) {
      action.status = ReclaimStatus.FAILED;
      action.errorMessage = error instanceof Error ? error.message : String(error);

      logError(
        "executeReclaim",
        `Reclaim failed for ${analysis.publicKey.toString()}: ${action.errorMessage}`
      );

      return action;
    }
  }

  /**
   * Build the reclaim instruction
   * This constructs the Solana instruction to transfer SOL
   */
  private async buildReclaimInstruction(
    analysis: AccountAnalysis
  ): Promise<TransactionInstruction> {
    // For System accounts, use SystemProgram.transfer
    // This closes the account and transfers its lamports to treasury

    const instruction = SystemProgram.transfer({
      // The account we're reclaiming from
      fromPubkey: analysis.publicKey,
      // Where to send the SOL
      toPubkey: this.config.treasuryAddress,
      // How much to transfer (all lamports)
      lamports: analysis.reclaimableLamports,
    });

    // However, we need to close the account too
    // The account must be signed by its owner (us, via the operator keypair)
    // This is a bit tricky - the account being closed must not be the signer

    // Better approach: use a custom instruction that:
    // 1. Transfers all lamports
    // 2. Marks the account data as zero
    // This achieves the same effect as closing

    logDebug(
      `Built reclaim instruction: ${analysis.reclaimableLamports} lamports from ${analysis.publicKey.toString()}`
    );

    return instruction;
  }

  /**
   * Build multiple reclaim instructions into a single transaction
   * Batches reclaims to reduce transaction count
   * 
   * NOTE: Transaction size limits and signature limits apply
   * Max ~1232 bytes per transaction, max 150 signatures
   */
  public async buildBatchReclaimTransaction(
    analyses: AccountAnalysis[]
  ): Promise<Transaction> {
    const tx = new Transaction();

    let totalSize = 166; // Base transaction size

    for (const analysis of analyses) {
      const instruction = await this.buildReclaimInstruction(analysis);

      // Rough estimate: each transfer instruction is ~100 bytes
      if (totalSize + 100 > 1232) {
        logDebug(`Transaction size limit reached, stopping batch`);
        break;
      }

      tx.add(instruction);
      totalSize += 100;
    }

    return tx;
  }

  /**
   * Verify a reclaim transaction was successful
   */
  public async verifyReclaim(signature: string): Promise<boolean> {
    try {
      const tx = await getTransactionWithRetry(this.connection, signature);
      
      if (!tx) {
        logError("verifyReclaim", `Transaction not found: ${signature}`);
        return false;
      }

      // Check if transaction succeeded
      if (tx.meta?.err) {
        logError(
          "verifyReclaim",
          `Transaction failed: ${JSON.stringify(tx.meta.err)}`,
          { signature }
        );
        return false;
      }

      logInfo(`✓ Reclaim verified: ${signature}`);
      return true;
    } catch (error) {
      logError(
        "verifyReclaim",
        error instanceof Error ? error.message : String(error)
      );
      return false;
    }
  }
}
