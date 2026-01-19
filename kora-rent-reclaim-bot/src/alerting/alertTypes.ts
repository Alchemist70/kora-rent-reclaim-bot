/**
 * Alert Types and Enums for Telegram Alerting System
 */

export enum AlertType {
  RENT_RECLAIMED = 'RENT_RECLAIMED',
  IDLE_RENT_DETECTED = 'IDLE_RENT_DETECTED',
  RECLAIM_FAILED = 'RECLAIM_FAILED',
  SAFETY_CHECK_FAILED = 'SAFETY_CHECK_FAILED',
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  ANALYSIS_COMPLETED = 'ANALYSIS_COMPLETED',
  CONNECTION_TEST = 'CONNECTION_TEST'
}

export enum AlertSeverity {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
  ERROR = 'ERROR'
}

export interface Alert {
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: Date;
}

export interface TelegramConfig {
  enabled: boolean;
  botToken: string;
  chatId: string;
  alerts: {
    reclaimThreshold: number; // SOL amount
    idleThreshold: number; // SOL amount
    dailySummary?: boolean;
  };
}

export interface TelegramResponse {
  ok: boolean;
  result?: Record<string, unknown>;
  description?: string;
  error_code?: number;
}
