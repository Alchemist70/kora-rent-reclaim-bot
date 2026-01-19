/**
 * Dashboard Frontend Logic
 * CRITICAL DESIGN DECISION: This dashboard is INTENTIONALLY READ-ONLY
 * 
 * Why read-only?
 * 1. Prevents accidental fund loss from UI interactions
 * 2. Ensures explicit operator consent via CLI (all actions auditable)
 * 3. Separates monitoring from execution responsibilities
 * 4. Requires deliberate, intentional actions for fund transfers
 * 
 * Action Handoff:
 * - Dashboard: Analyze, report, and recommend actions
 * - CLI: Execute all transactions (npm start -- reclaim)
 * - This enforces a safety boundary that cannot be bypassed
 * 
 * Do NOT add wallet connections or transaction signing to this dashboard.
 * The CLI tool (src/cli.ts) handles all fund movements.
 */

// Chart instance for timeline
let timelineChart = null;

/**
 * Initialize dashboard on page load
 */
document.addEventListener('DOMContentLoaded', async () => {
    // Set up tab switching
    setupTabSwitching();
    
    // Load initial data
    await refreshDashboard();
    
    // Set up account search
    setupAccountSearch();
    
    // Set up auto-refresh (every 10 seconds)
    setInterval(refreshDashboard, 10000);
});

/**
 * Refresh all dashboard data
 */
async function refreshDashboard() {
    try {
        // Fetch all data in parallel
        const [metrics, accounts, timeline, warnings, auditSummary] = await Promise.all([
            fetch('/api/metrics').then(r => r.json()),
            fetch('/api/accounts').then(r => r.json()),
            fetch('/api/timeline').then(r => r.json()),
            fetch('/api/warnings').then(r => r.json()),
            fetch('/api/audit-summary').then(r => r.json())
        ]);

        // Update metrics
        updateMetrics(metrics);
        
        // Update status cards
        updateStatus(metrics);
        
        // Update timeline chart
        updateTimeline(timeline);
        
        // Update accounts table
        updateAccountsTable(accounts);
        
        // Update warnings
        updateWarnings(warnings);
        
        // Update audit summary
        updateAuditSummary(auditSummary);
        
        // Update last refresh time
        updateLastRefreshed();
    } catch (error) {
        console.error('Error refreshing dashboard:', error);
        showError('Failed to refresh dashboard data');
    }
}

/**
 * Update metrics cards
 */
function updateMetrics(metrics) {
    // Helper to format SOL values
    const formatSOL = (lamports) => {
        const sol = lamports / 1e9;
        return `${sol.toFixed(2)} SOL`;
    };

    const elements = {
        'total-tracked': metrics.totalTracked || 0,
        'total-locked': formatSOL(metrics.totalRentLocked || 0),
        'total-reclaimed': formatSOL(metrics.totalReclaimedLamports || 0),
        'still-idle': formatSOL(metrics.totalStillLocked || 0)
    };

    for (const [id, value] of Object.entries(elements)) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    // Update last refresh timestamp
    updateLastRefreshed();
}

/**
 * Update status cards
 */
function updateStatus(metrics) {
    const statuses = {
        'count-reclaimable': metrics.reclaimableCount || 0,
        'count-reclaimed': metrics.confirmedCount || 0,
        'count-skipped': metrics.skippedCount || 0,
        'count-failed': metrics.failedCount || 0
    };

    for (const [id, value] of Object.entries(statuses)) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }
}

/**
 * Update timeline chart with reclaim events
 */
function updateTimeline(events) {
    const timelineContainer = document.getElementById('timelineContainer');
    
    if (!timelineContainer) {
        console.error('Timeline container not found');
        return;
    }

    if (events.length === 0) {
        timelineContainer.innerHTML = `
            <div class="empty-state-inline">
                <div style="font-size: 2em; margin-bottom: 10px;">📊</div>
                <h4>No Reclaim Events Yet</h4>
                <p style="margin: 8px 0; color: #666;">Start the reclaim process to populate this timeline.</p>
                <code style="background: #f0f0f0; padding: 8px 12px; border-radius: 4px; display: inline-block; margin-top: 8px;">node dist/cli.js reclaim --config config.json</code>
            </div>
        `;
        return;
    }

    // Sort by timestamp descending (convert seconds to milliseconds)
    events.sort((a, b) => (b.timestamp * 1000) - (a.timestamp * 1000));

    // Take last 30 days of events for chart
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const chartEvents = events.filter(e => new Date(e.timestamp * 1000) >= thirtyDaysAgo);

    // Group by date and action type
    const byDateAndType = {};
    chartEvents.forEach(event => {
        const date = new Date(event.timestamp * 1000).toLocaleDateString();
        if (!byDateAndType[date]) {
            byDateAndType[date] = { indexed: 0, analyzed: 0, reclaimed: 0, failed: 0 };
        }
        byDateAndType[date][event.status] = (byDateAndType[date][event.status] || 0) + 1;
    });

    const dates = Object.keys(byDateAndType).sort();
    const indexedCounts = dates.map(d => byDateAndType[d].indexed || 0);
    const analyzedCounts = dates.map(d => byDateAndType[d].analyzed || 0);
    const reclaimedCounts = dates.map(d => byDateAndType[d].reclaimed || 0);
    const failedCounts = dates.map(d => byDateAndType[d].failed || 0);

    const canvas = document.getElementById('timeline-chart');
    if (!canvas) {
        console.error('Timeline chart canvas not found');
        return;
    }
    
    if (timelineChart) {
        timelineChart.destroy();
    }

    timelineChart = new Chart(canvas, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [
                {
                    label: 'Indexed',
                    data: indexedCounts,
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4,
                    pointRadius: 3,
                    pointBackgroundColor: '#6366f1'
                },
                {
                    label: 'Analyzed',
                    data: analyzedCounts,
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4,
                    pointRadius: 3,
                    pointBackgroundColor: '#f59e0b'
                },
                {
                    label: 'Reclaimed',
                    data: reclaimedCounts,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4,
                    pointRadius: 3,
                    pointBackgroundColor: '#10b981'
                },
                {
                    label: 'Failed',
                    data: failedCounts,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4,
                    pointRadius: 3,
                    pointBackgroundColor: '#ef4444'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 }
                }
            }
        }
    });
}

/**
 * Update accounts table
 */
function updateAccountsTable(accounts) {
    const tbody = document.getElementById('accountsTableBody');
    
    if (!tbody) {
        console.error('Accounts table body not found');
        return;
    }

    if (!accounts || accounts.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 20px;">
                    <div class="empty-state-inline">
                        <div style="font-size: 1.5em; margin-bottom: 8px;">📭</div>
                        <p style="color: #666;">No accounts indexed yet. Start the indexer to discover accounts:</p>
                        <code style="background: #f0f0f0; padding: 6px 10px; border-radius: 4px; display: inline-block; margin-top: 8px;">node dist/cli.js index --config config.json</code>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    // Helper to format SOL
    const formatSOL = (lamports) => {
        const sol = (lamports || 0) / 1e9;
        return `${sol.toFixed(4)} SOL`;
    };

    // Helper to truncate address
    const truncateAddress = (addr) => {
        return addr ? `${addr.substring(0, 12)}...` : 'N/A';
    };

    // Helper to get decision icon
    const getDecisionIcon = (reason) => {
        if (!reason) return '✓';
        if (reason.includes('PDA')) return '🔐';
        if (reason.includes('program')) return '⚙️';
        if (reason.includes('balance')) return '💰';
        if (reason.includes('unsafe')) return '⚠️';
        return '•';
    };

    // Sort by locked rent descending
    accounts.sort((a, b) => (b.rentLamports || 0) - (a.rentLamports || 0));

    tbody.innerHTML = accounts.map(account => {
        const reason = account.reason || account.detail || '—';
        const decision = reason === '—' ? 'RECLAIMABLE' : reason.substring(0, 20) + (reason.length > 20 ? '...' : '');
        const reclaimed = account.txSignature ? '✅ YES' : '—';
        
        return `
            <tr>
                <td><code class="tx-link" title="${account.publicKey || account.pubkey || 'N/A'}">${truncateAddress(account.publicKey || account.pubkey)}</code></td>
                <td>${account.accountType || account.type || '—'}</td>
                <td><code class="tx-link" title="${account.owner || 'N/A'}">${truncateAddress(account.owner)}</code></td>
                <td><span class="status-badge status-${(account.status || '').toLowerCase()}">${account.status || '—'}</span></td>
                <td>${formatSOL(account.rentLamports)}</td>
                <td><span class="reason-text" title="${reason}">${getDecisionIcon(reason)} ${decision}</span></td>
                <td>${reclaimed}</td>
            </tr>
        `;
    }).join('');
}

/**
 * Update warnings list
 */
function updateWarnings(warnings) {
    const container = document.getElementById('warningsList');
    
    if (!container) {
        console.error('Warnings container not found');
        return;
    }

    if (!warnings || warnings.length === 0) {
        container.innerHTML = `
            <div class="empty-state-inline healthy-state" style="border-left: 4px solid #10b981; padding: 16px;">
                <div style="font-size: 1.5em; margin-bottom: 8px;">✅</div>
                <h4 style="color: #10b981; margin: 0;">All Systems Healthy</h4>
                <p style="color: #666; margin: 8px 0 0 0; font-size: 0.95em;">No operational warnings detected. Dashboard is functioning normally.</p>
                <p style="color: #999; margin-top: 8px; font-size: 0.85em;">This does not mean all accounts are reclaimable. Run CLI to analyze and find reclaimable accounts.</p>
            </div>
        `;
        return;
    }

    // Map severity levels to icons, colors, and action guidance
    const severityMap = {
        'critical': { icon: '🚨', color: '#dc2626', action: 'Review immediately' },
        'error': { icon: '⚠️', color: '#ea580c', action: 'Investigate and resolve' },
        'warning': { icon: '⚡', color: '#f59e0b', action: 'Monitor closely' },
        'info': { icon: 'ℹ️', color: '#3b82f6', action: 'For your information' },
        'success': { icon: '✅', color: '#10b981', action: 'Operation successful' }
    };

    container.innerHTML = warnings.map(warning => {
        const level = (warning.level || 'info').toLowerCase();
        const severity = severityMap[level] || severityMap['info'];
        const timestamp = new Date(warning.timestamp).toLocaleString();
        
        return `
            <div class="warning-item warning-${level}" style="border-left-color: ${severity.color}">
                <div class="warning-icon">${severity.icon}</div>
                <div class="warning-content">
                    <div class="warning-message">${escapeHtml(warning.message)}</div>
                    ${warning.detail ? `<div class="warning-detail">${escapeHtml(warning.detail)}</div>` : ''}
                    <div class="warning-footer">
                        <span class="warning-time">${timestamp}</span>
                        <span class="warning-action">→ ${severity.action}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Update audit summary
 */
function updateAuditSummary(summary) {
    const container = document.getElementById('audit-summary');
    
    const items = [
        { label: 'Indexed', key: 'INDEXED' },
        { label: 'Analyzed', key: 'ANALYZED' },
        { label: 'Approved', key: 'APPROVED' },
        { label: 'Reclaimed', key: 'RECLAIM_CONFIRMED' },
        { label: 'Skipped', key: 'SKIPPED' },
        { label: 'Failed', key: 'RECLAIM_FAILED' }
    ];

    container.innerHTML = items.map(item => `
        <div class="audit-item">
            <div class="audit-item-label">${item.label}</div>
            <div class="audit-item-count">${summary[item.key] || 0}</div>
        </div>
    `).join('');
}

/**
 * Update last refreshed timestamp
 */
function updateLastRefreshed() {
    const element = document.getElementById('last-updated');
    if (element) {
        element.textContent = new Date().toLocaleTimeString();
    }
}

/**
 * Set up tab switching
 */
function setupTabSwitching() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');

            // Update active button
            tabButtons.forEach(b => b.classList.remove('active'));
            button.classList.add('active');

            // Update active content
            tabContents.forEach(content => content.classList.remove('active'));
            document.getElementById(tabName).classList.add('active');

            // Re-initialize chart if timeline tab is selected
            if (tabName === 'timeline' && timelineChart) {
                timelineChart.resize();
            }
        });
    });

    // Activate first tab by default
    if (tabButtons.length > 0) {
        tabButtons[0].click();
    }
}

/**
 * Set up account search functionality
 */
function setupAccountSearch() {
    const searchInput = document.getElementById('account-search');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const rows = document.querySelectorAll('#accounts-tbody tr');

        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(query) ? '' : 'none';
        });
    });
}

/**
 * Show error message
 */
function showError(message) {
    const element = document.getElementById('error-message');
    if (element) {
        element.textContent = message;
        element.style.display = 'block';
        setTimeout(() => {
            element.style.display = 'none';
        }, 5000);
    }
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}
