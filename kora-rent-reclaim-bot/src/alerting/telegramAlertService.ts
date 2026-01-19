/**
 * Telegram Alert Service
 * Sends alerts to Telegram for important reclaim events
 */

import axios, { AxiosInstance } from 'axios';
import { getLogger } from '../utils/logging.js';

const logger = getLogger();

/**
 * Alert trigger types
 */
export enum AlertType {
    RENT_RECLAIMED = 'rent_reclaimed',
    IDLE_RENT_DETECTED = 'idle_rent_detected',
    RECLAIM_FAILED = 'reclaim_failed',
    ANALYSIS_COMPLETED = 'analysis_completed',
    SAFETY_CHECK_FAILED = 'safety_check_failed',
    SYSTEM_ERROR = 'system_error'
}

/**
 * Alert severity levels
 */
export enum AlertSeverity {
    INFO = 'info',
    WARNING = 'warning',
    ERROR = 'error'
}

/**
 * Alert message interface
 */
export interface Alert {
    type: AlertType;
    severity: AlertSeverity;
    title: string;
    message: string;
    timestamp: Date;
    metadata?: Record<string, unknown>;
}

/**
 * Telegram alert configuration
 */
export interface TelegramConfig {
    enabled: boolean;
    botToken: string;
    chatId: string;
    alerts?: {
        reclaimThreshold?: number;        // Min SOL to alert on reclaim
        idleThreshold?: number;            // Min idle SOL to alert
        failureThreshold?: number;         // Failure count before alert
        dailySummary?: boolean;            // Send daily summary
    };
}

/**
 * Service for sending Telegram alerts
 */
export class TelegramAlertService {
    private httpClient: AxiosInstance;
    private config: TelegramConfig;
    private apiUrl: string;

    /**
     * Initialize Telegram alert service
     */
    constructor(config: TelegramConfig) {
        this.config = config;
        this.apiUrl = `https://api.telegram.org/bot${config.botToken}`;
        
        this.httpClient = axios.create({
            baseURL: this.apiUrl,
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (config.enabled) {
            logger.info('Telegram alerting enabled', { chatId: config.chatId });
        }
    }

    /**
     * Check if alerts are enabled
     */
    isEnabled(): boolean {
        return !!(this.config.enabled && this.config.botToken && this.config.chatId);
    }

    /**
     * Send alert to Telegram
     */
    async sendAlert(alert: Alert): Promise<boolean> {
        if (!this.isEnabled()) {
            return false;
        }

        try {
            // Filter alerts based on configuration
            if (!this.shouldSendAlert(alert)) {
                logger.debug('Alert filtered by threshold', { type: alert.type });
                return false;
            }

            const message = this.formatAlertMessage(alert);
            
            // Truncate to Telegram's max message length (4096 characters)
            const truncatedMessage = message.length > 4096 
                ? message.substring(0, 4093) + '...' 
                : message;

            await this.httpClient.post('/sendMessage', {
                chat_id: this.config.chatId,
                text: truncatedMessage,
                parse_mode: 'HTML'
            });

            logger.info('Alert sent to Telegram', { 
                type: alert.type,
                severity: alert.severity 
            });

            return true;
        } catch (error) {
            logger.error('Failed to send Telegram alert', {
                type: alert.type,
                error: error instanceof Error ? error.message : String(error)
            });
            return false;
        }
    }

    /**
     * Send alert for rent reclaimed
     */
    async alertRentReclaimed(
        account: string,
        amountSol: number,
        txSignature: string
    ): Promise<boolean> {
        const threshold = this.config.alerts?.reclaimThreshold || 0;
        
        if (amountSol < threshold) {
            return false;
        }

        const alert: Alert = {
            type: AlertType.RENT_RECLAIMED,
            severity: AlertSeverity.INFO,
            title: '✅ Rent Reclaimed',
            message: `Account: \`${account.substring(0, 12)}...\`\nRent Recovered: ${amountSol.toFixed(4)} SOL\nTx: \`${txSignature.substring(0, 12)}...\``,
            timestamp: new Date(),
            metadata: {
                account,
                amount: amountSol,
                tx: txSignature
            }
        };

        return this.sendAlert(alert);
    }

    /**
     * Send alert for idle rent detected
     */
    async alertIdleRentDetected(
        account: string,
        rentAmount: number,
        idleDays: number
    ): Promise<boolean> {
        const threshold = this.config.alerts?.idleThreshold || 0;
        
        if (rentAmount < threshold) {
            return false;
        }

        const alert: Alert = {
            type: AlertType.IDLE_RENT_DETECTED,
            severity: AlertSeverity.WARNING,
            title: '⏰ Idle Rent Detected',
            message: `Account: \`${account.substring(0, 12)}...\`\nRent Amount: ${rentAmount.toFixed(4)} SOL\nIdle for ${idleDays} days\nStatus: Eligible for reclaim`,
            timestamp: new Date(),
            metadata: {
                account,
                rentAmount,
                idleDays
            }
        };

        return this.sendAlert(alert);
    }

    /**
     * Send alert for reclaim failure
     */
    async alertReclaimFailed(
        account: string,
        reason: string,
        error: string
    ): Promise<boolean> {
        const alert: Alert = {
            type: AlertType.RECLAIM_FAILED,
            severity: AlertSeverity.ERROR,
            title: '❌ Reclaim Failed',
            message: `Account: \`${account.substring(0, 12)}...\`\nReason: ${reason}\nError: ${error}`,
            timestamp: new Date(),
            metadata: {
                account,
                reason,
                error
            }
        };

        return this.sendAlert(alert);
    }

    /**
     * Send alert for safety check failure
     */
    async alertSafetyCheckFailed(
        account: string,
        checks: string[]
    ): Promise<boolean> {
        const alert: Alert = {
            type: AlertType.SAFETY_CHECK_FAILED,
            severity: AlertSeverity.WARNING,
            title: '🛡️ Safety Check Failed',
            message: `Account: \`${account.substring(0, 12)}...\`\nFailed Checks:\n${checks.map(c => `• ${c}`).join('\n')}`,
            timestamp: new Date(),
            metadata: {
                account,
                checks
            }
        };

        return this.sendAlert(alert);
    }

    /**
     * Send analysis summary
     */
    async sendAnalysisSummary(
        totalAnalyzed: number,
        reclaimable: number,
        rentAmount: number
    ): Promise<boolean> {
        if (totalAnalyzed === 0) {
            return false;
        }

        const alert: Alert = {
            type: AlertType.ANALYSIS_COMPLETED,
            severity: AlertSeverity.INFO,
            title: '📊 Analysis Completed',
            message: `Total Accounts: ${totalAnalyzed}\nReclaimable: ${reclaimable}\nTotal Rent: ${rentAmount.toFixed(2)} SOL`,
            timestamp: new Date(),
            metadata: {
                totalAnalyzed,
                reclaimable,
                rentAmount
            }
        };

        return this.sendAlert(alert);
    }

    /**
     * Send system error alert
     */
    async alertSystemError(
        operation: string,
        error: string
    ): Promise<boolean> {
        const alert: Alert = {
            type: AlertType.SYSTEM_ERROR,
            severity: AlertSeverity.ERROR,
            title: '🚨 System Error',
            message: `Operation: ${operation}\nError: ${error}\nPlease check logs for details`,
            timestamp: new Date(),
            metadata: {
                operation,
                error
            }
        };

        return this.sendAlert(alert);
    }

    /**
     * Determine if alert should be sent based on configuration
     */
    private shouldSendAlert(alert: Alert): boolean {
        // Always send errors
        if (alert.severity === AlertSeverity.ERROR) {
            return true;
        }

        // Check threshold-based alerts
        switch (alert.type) {
            case AlertType.RENT_RECLAIMED:
                return this.config.alerts?.reclaimThreshold !== undefined;
            
            case AlertType.IDLE_RENT_DETECTED:
                return this.config.alerts?.idleThreshold !== undefined;
            
            default:
                return true;
        }
    }

    /**
     * Format alert message for Telegram
     */
    private formatAlertMessage(alert: Alert): string {
        const timestamp = alert.timestamp.toLocaleTimeString();
        const severity = this.formatSeverity(alert.severity);

        return `<b>${alert.title}</b>\n${severity}\n\n${alert.message}\n\n<i>${timestamp}</i>`;
    }

    /**
     * Format severity as Telegram emoji
     */
    private formatSeverity(severity: AlertSeverity): string {
        switch (severity) {
            case AlertSeverity.ERROR:
                return '🔴 <b>CRITICAL</b>';
            case AlertSeverity.WARNING:
                return '🟡 <b>WARNING</b>';
            case AlertSeverity.INFO:
                return '🟢 <b>INFO</b>';
        }
    }

    /**
     * Test connection to Telegram API
     */
    async testConnection(): Promise<boolean> {
        if (!this.isEnabled()) {
            return false;
        }

        try {
            const response = await this.httpClient.post('/sendMessage', {
                chat_id: this.config.chatId,
                text: '✅ Solana Rent Reclaim Bot connected to Telegram'
            });

            logger.info('Telegram connection test successful');
            return response.status === 200;
        } catch (error) {
            logger.error('Telegram connection test failed', {
                error: error instanceof Error ? error.message : String(error)
            });
            return false;
        }
    }
}

/**
 * Singleton instance
 */
let alertService: TelegramAlertService | null = null;

/**
 * Initialize or get alert service
 */
export function initializeAlertService(config: TelegramConfig): TelegramAlertService {
    if (!alertService) {
        alertService = new TelegramAlertService(config);
    }
    return alertService;
}

/**
 * Get alert service instance
 */
export function getAlertService(): TelegramAlertService | null {
    return alertService;
}
