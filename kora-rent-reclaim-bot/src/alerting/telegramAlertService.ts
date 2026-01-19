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
    private updateOffset: number = 0;
    private pollingActive: boolean = false;
    private pollingInterval: NodeJS.Timeout | null = null;

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
     * Start polling for incoming Telegram commands
     */
    startPolling(): void {
        if (this.pollingActive) {
            logger.warn('Telegram polling already active');
            return;
        }

        if (!this.isEnabled()) {
            logger.error('Cannot start polling: Telegram config incomplete');
            return;
        }

        this.pollingActive = true;
        logger.info('🎯 Starting Telegram command polling');

        // Run first poll immediately
        this.pollUpdates().catch(error => {
            logger.error('First poll error', {
                error: error instanceof Error ? error.message : String(error)
            });
        });

        // Poll for updates every 3 seconds
        this.pollingInterval = setInterval(() => {
            this.pollUpdates().catch(error => {
                logger.error('Poll error', {
                    error: error instanceof Error ? error.message : String(error)
                });
            });
        }, 3000);
    }

    /**
     * Stop polling for incoming commands
     */
    stopPolling(): void {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
        this.pollingActive = false;
        logger.info('Stopped Telegram command polling');
    }

    /**
     * Poll for updates from Telegram
     */
    private async pollUpdates(): Promise<void> {
        try {
            const response = await this.httpClient.post('/getUpdates', {
                offset: this.updateOffset,
                timeout: 25,
                allowed_updates: ['message']
            });

            if (!response.data?.ok) {
                logger.error('❌ getUpdates failed', {
                    code: response.data?.error_code,
                    desc: response.data?.description
                });
                return;
            }

            const updates = response.data?.result || [];
            
            if (updates.length > 0) {
                logger.info(`📨 Got ${updates.length} update(s)`);
            }
            
            for (const update of updates) {
                this.updateOffset = update.update_id + 1;
                if (update.message) {
                    logger.info('📩 Telegram message', {
                        from: update.message.from?.username,
                        text: update.message.text?.substring(0, 30)
                    });
                    await this.handleIncomingMessage(update.message);
                }
            }
        } catch (error) {
            if (error instanceof Error) {
                if (error.message.includes('timeout')) return;
                logger.warn('⚠️ Poll error', { error: error.message });
            }
        }
    }

    /**
     * Handle incoming Telegram messages
     */
    private async handleIncomingMessage(message: any): Promise<void> {
        const chatId = message.chat?.id;
        const text = message.text?.trim() || '';
        const textLower = text.toLowerCase();

        if (!chatId) {
            logger.warn('Message without chatId');
            return;
        }

        // Normalize the command portion: remove any parameters and bot username suffix
        const firstToken = (textLower.split(' ')[0] || '');
        const command = firstToken.split('@')[0];

        logger.info('🔔 Command received', { raw: text, command });

        // Handle /start
        if (command === '/start') {
            await this.respondToCommand(
                chatId,
                '<b>👋 Welcome to Solana Rent Reclaim Bot!</b>\n\n' +
                'This bot sends alerts about rent reclaim operations.\n\n' +
                '<b>Available commands:</b>\n' +
                '/start - Show this message\n' +
                '/testconnection - Test bot connectivity\n' +
                '/status - Get current bot status'
            );
            return;
        }

        // Handle /testconnection
        if (command === '/testconnection') {
            await this.respondToCommand(
                chatId,
                '<b>✅ Solana Rent Reclaim Bot is connected!</b>\n\n' +
                'Status: <b>Online</b>\n' +
                'Receiving alerts: Yes'
            );
            return;
        }

        // Handle /status
        if (command === '/status') {
            await this.respondToCommand(
                chatId,
                '<b>🔄 Solana Rent Reclaim Bot Status</b>\n\n' +
                'Status: <b>Online</b>\n' +
                'Connected: <b>Yes</b>\n' +
                'Alerts: <b>Enabled</b>\n\n' +
                '<b>Notifications for:</b>\n' +
                '• Rent reclaim events\n' +
                '• Idle rent detection\n' +
                '• System errors'
            );
            return;
        }

        // Unknown command (still starts with /)
        if (command.startsWith('/')) {
            await this.respondToCommand(
                chatId,
                '❓ Unknown command.\n\nType /start to see available commands.'
            );
        }
    }

    /**
     * Send command response to user
     */
    private async respondToCommand(chatId: string | number, text: string): Promise<void> {
        try {
            const response = await this.httpClient.post('/sendMessage', {
                chat_id: chatId,
                text,
                parse_mode: 'HTML'
            });
            
            if (response.data?.ok) {
                logger.info('✅ Response sent', { chatId });
            } else {
                logger.error('❌ Send failed', {
                    code: response.data?.error_code,
                    desc: response.data?.description
                });
            }
        } catch (error) {
            logger.error('❌ Send error', {
                chatId,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    /**
     * Test connection to Telegram API
     */
    async testConnection(): Promise<boolean> {
        if (!this.isEnabled()) {
            logger.error('❌ Telegram not enabled or config incomplete');
            return false;
        }

        try {
            logger.info('🔍 Testing Telegram API connection...');
            
            const response = await this.httpClient.post('/sendMessage', {
                chat_id: this.config.chatId,
                text: '✅ Solana Rent Reclaim Bot connected to Telegram'
            });

            if (response.data?.ok) {
                logger.info('✅ Telegram API connection successful');
                logger.info('🎯 Starting command polling...');
                this.startPolling();
                logger.info('✅ Bot ready to receive commands');
                return true;
            }
            
            logger.error('❌ Telegram API error', {
                code: response.data?.error_code,
                description: response.data?.description
            });
            return false;
        } catch (error) {
            logger.error('❌ Connection test failed', {
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
