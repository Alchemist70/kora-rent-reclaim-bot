/**
 * Safety Engine (CRITICAL)
 * 
 * This is the most important module in the entire bot.
 * It enforces strict safety rules before any SOL can be reclaimed.
 * 
 * Safety principles:
 * 1. NEVER reclaim from PDAs (they're program-controlled state)
 * 2. NEVER reclaim from unknown programs
 * 3. ONLY reclaim from empty, inactive accounts
 * 4. ONLY reclaim System accounts (or explicitly allowed programs)
 * 5. Require substantial inactivity before reclaim
 * 6. All decisions must be logged and auditable
 * 7. Require explicit operator approval in non-dry-run mode
 * 
 * This module is designed to fail closed: when in doubt, DO NOT RECLAIM
 */

import { PublicKey } from "@solana/web3.js";
import {
  AccountAnalysis,
  SafetyCheckResult,
  SafetyCheck,
  RiskFlag,
  AccountType,
  BotConfig,
} from "../utils/types.js";
import {
  logSafetyCheck,
  logReclaimDecision,
  logDebug,
  logWarn,
} from "../utils/logging.js";

/**
 * Safety Engine - enforces reclaim rules
 */
export class SafetyEngine {
  private config: BotConfig;

  constructor(config: BotConfig) {
    this.config = config;
  }

  /**
   * Run all safety checks on an account
   * Returns whether reclaim should be approved
   */
  public checkAccountSafety(analysis: AccountAnalysis): SafetyCheckResult {
    const checks: SafetyCheck[] = [];
    let allPassed = true;

    // Check 1: Account must exist
    if (!analysis.currentState.exists) {
      checks.push({
        name: "accountExists",
        passed: true,
        details: "Account does not exist (OK to skip)",
      });
      return {
        approved: false,
        reason: "Account does not exist on-chain",
        checks,
        checkedAt: Date.now(),
      };
    }

    // Check 2: Must not be a PDA
    const pdaCheck = this.checkNotPda(analysis);
    checks.push(pdaCheck);
    if (!pdaCheck.passed) allPassed = false;

    // Check 3: Must not be unknown program
    const programCheck = this.checkKnownProgram(analysis);
    checks.push(programCheck);
    if (!programCheck.passed) allPassed = false;

    // Check 4: Must be System account type
    const typeCheck = this.checkAccountType(analysis);
    checks.push(typeCheck);
    if (!typeCheck.passed) allPassed = false;

    // Check 5: Must have no token balance
    const balanceCheck = this.checkNoTokenBalance(analysis);
    checks.push(balanceCheck);
    if (!balanceCheck.passed) allPassed = false;

    // Check 6: Must be empty or minimal data
    const emptyCheck = this.checkEmpty(analysis);
    checks.push(emptyCheck);
    if (!emptyCheck.passed) allPassed = false;

    // Check 7: Must be inactive long enough
    const inactivityCheck = this.checkInactivity(analysis);
    checks.push(inactivityCheck);
    if (!inactivityCheck.passed) allPassed = false;

    // Check 8: Must be rent exempt (if reclaiming from a rent-exempt account)
    const rentCheck = this.checkRentExempt(analysis);
    checks.push(rentCheck);
    if (!rentCheck.passed) allPassed = false;

    // Check 9: Must have reclaim value
    const valueCheck = this.checkHasValue(analysis);
    checks.push(valueCheck);
    if (!valueCheck.passed) allPassed = false;

    const reason = allPassed
      ? "All safety checks passed"
      : `Safety check failed: ${checks.filter((c) => !c.passed).map((c) => c.name).join(", ")}`;

    logReclaimDecision(
      analysis.publicKey.toString(),
      allPassed,
      reason,
      { checks }
    );

    return {
      approved: allPassed,
      reason,
      checks,
      checkedAt: Date.now(),
    };
  }

  /**
   * Check: Must not be a PDA
   * PDAs are off-curve and program-controlled
   */
  private checkNotPda(analysis: AccountAnalysis): SafetyCheck {
    const passed = !analysis.currentState.isPda;

    logSafetyCheck(
      "checkNotPda",
      passed,
      `isPda: ${analysis.currentState.isPda}`
    );

    return {
      name: "checkNotPda",
      passed,
      details: passed
        ? "Account is not a PDA"
        : "Account appears to be a PDA - DO NOT RECLAIM",
    };
  }

  /**
   * Check: Must be a known program (System or allowlisted)
   */
  private checkKnownProgram(analysis: AccountAnalysis): SafetyCheck {
    const SYSTEM_PROGRAM = new PublicKey("11111111111111111111111111111111");
    const isSystem = analysis.currentState.owner.equals(SYSTEM_PROGRAM);
    const isAllowed = this.config.allowedPrograms.some((p) =>
      p.equals(analysis.currentState.owner)
    );

    const passed = isSystem || isAllowed;

    logSafetyCheck(
      "checkKnownProgram",
      passed,
      `owner: ${analysis.currentState.owner.toString()}`
    );

    return {
      name: "checkKnownProgram",
      passed,
      details: passed
        ? `Program is known: ${analysis.currentState.owner.toString()}`
        : `Unknown program owner: ${analysis.currentState.owner.toString()}`,
    };
  }

  /**
   * Check: Must be a System account (not Token, PDA, etc.)
   */
  private checkAccountType(analysis: AccountAnalysis): SafetyCheck {
    const allowed = [AccountType.SYSTEM];
    const passed = allowed.includes(analysis.currentState.accountType);

    logSafetyCheck(
      "checkAccountType",
      passed,
      `type: ${analysis.currentState.accountType}`
    );

    return {
      name: "checkAccountType",
      passed,
      details: passed
        ? `Account type is allowed: ${analysis.currentState.accountType}`
        : `Account type is not allowed: ${analysis.currentState.accountType}`,
    };
  }

  /**
   * Check: Must have no token balance
   */
  private checkNoTokenBalance(analysis: AccountAnalysis): SafetyCheck {
    const hasTokenBalance = analysis.riskFlags.includes(RiskFlag.HAS_TOKEN_BALANCE);
    const passed = !hasTokenBalance;

    logSafetyCheck(
      "checkNoTokenBalance",
      passed,
      `hasTokenBalance: ${hasTokenBalance}`
    );

    return {
      name: "checkNoTokenBalance",
      passed,
      details: passed
        ? "Account has no token balance"
        : "Account has token balance - cannot reclaim",
    };
  }

  /**
   * Check: Account must be empty (no custom data)
   */
  private checkEmpty(analysis: AccountAnalysis): SafetyCheck {
    const hasData = analysis.currentState.data.length > 0;
    const passed = !hasData;

    logSafetyCheck(
      "checkEmpty",
      passed,
      `dataLength: ${analysis.currentState.data.length}`
    );

    return {
      name: "checkEmpty",
      passed,
      details: passed
        ? "Account has no data"
        : `Account has ${analysis.currentState.data.length} bytes of data`,
    };
  }

  /**
   * Check: Account must be sufficiently inactive
   */
  private checkInactivity(analysis: AccountAnalysis): SafetyCheck {
    const meetsThreshold =
      analysis.inactivitySlots >= this.config.minInactivitySlots;
    const passed = meetsThreshold;

    logSafetyCheck(
      "checkInactivity",
      passed,
      `inactivitySlots: ${analysis.inactivitySlots} (required: ${this.config.minInactivitySlots})`
    );

    return {
      name: "checkInactivity",
      passed,
      details: passed
        ? `Account inactive for ${analysis.inactivitySlots} slots (threshold: ${this.config.minInactivitySlots})`
        : `Account only inactive for ${analysis.inactivitySlots} slots (requires ${this.config.minInactivitySlots})`,
    };
  }

  /**
   * Check: Account should be rent exempt
   */
  private checkRentExempt(analysis: AccountAnalysis): SafetyCheck {
    const passed = analysis.currentState.rentExempt;

    logSafetyCheck(
      "checkRentExempt",
      passed,
      `rentExempt: ${analysis.currentState.rentExempt}`
    );

    return {
      name: "checkRentExempt",
      passed,
      details: passed
        ? "Account is rent-exempt"
        : "Account is not rent-exempt (unusual)",
    };
  }

  /**
   * Check: Must have some SOL to reclaim
   */
  private checkHasValue(analysis: AccountAnalysis): SafetyCheck {
    const hasValue = analysis.reclaimableLamports > 0;
    const passed = hasValue;

    logSafetyCheck(
      "checkHasValue",
      passed,
      `reclaimableLamports: ${analysis.reclaimableLamports}`
    );

    return {
      name: "checkHasValue",
      passed,
      details: passed
        ? `Account has ${analysis.reclaimableLamports} lamports to reclaim`
        : "Account has no SOL to reclaim",
    };
  }

  /**
   * Get a human-readable safety report for an account
   */
  public getSafetyReport(analysis: AccountAnalysis): string {
    const safetyResult = this.checkAccountSafety(analysis);

    let report = `\n${"=".repeat(60)}\n`;
    report += `Account: ${analysis.publicKey.toString()}\n`;
    report += `Status: ${safetyResult.approved ? "✓ APPROVABLE" : "✗ BLOCKED"}\n`;
    report += `Reason: ${safetyResult.reason}\n`;
    report += `\nDetailed Checks:\n`;

    for (const check of safetyResult.checks) {
      const status = check.passed ? "✓" : "✗";
      report += `  ${status} ${check.name}: ${check.details}\n`;
    }

    report += `\nAccount Details:\n`;
    report += `  Lamports: ${analysis.currentState.lamports}\n`;
    report += `  Owner: ${analysis.currentState.owner.toString()}\n`;
    report += `  Type: ${analysis.currentState.accountType}\n`;
    report += `  Rent Exempt: ${analysis.currentState.rentExempt}\n`;
    report += `  Data Length: ${analysis.currentState.data.length} bytes\n`;
    report += `  Inactivity: ${analysis.inactivitySlots} slots\n`;
    report += `  Reclaimable: ${analysis.reclaimableLamports} lamports\n`;
    report += `${"=".repeat(60)}\n`;

    return report;
  }
}
