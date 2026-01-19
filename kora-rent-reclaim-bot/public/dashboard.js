/**
 * Dashboard Frontend Logic
 * Handles data fetching from API endpoints, UI updates, and Chart.js visualization
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
    const elements = {
        'tracked-count': metrics.totalTracked,
        'locked-amount': `${(metrics.totalLockedRent / 1e9).toFixed(2)} SOL`,
        'reclaimed-amount': `${(metrics.totalReclaimedRent / 1e9).toFixed(2)} SOL`,
        'idle-count': metrics.idleAccounts
    };

    for (const [id, value] of Object.entries(elements)) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }
}

/**
 * Update status cards
 */
function updateStatus(metrics) {
    const statuses = {
        'reclaimable-count': metrics.reclaimable,
        'reclaimed-count': metrics.reclaimed,
        'skipped-count': metrics.skipped,
        'failed-count': metrics.failed
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
    if (events.length === 0) {
        document.getElementById('timeline-content').innerHTML = 
            '<p style="text-align: center; color: #999; padding: 20px;">No events yet</p>';
        return;
    }

    // Sort by timestamp descending
    events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Take last 30 days of events for chart
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const chartEvents = events.filter(e => new Date(e.timestamp) >= thirtyDaysAgo);

    // Group by date
    const byDate = {};
    chartEvents.forEach(event => {
        const date = new Date(event.timestamp).toLocaleDateString();
        byDate[date] = (byDate[date] || 0) + (event.type === 'reclaimed' ? 1 : 0);
    });

    const dates = Object.keys(byDate).sort();
    const counts = dates.map(d => byDate[d]);

    const canvas = document.getElementById('timeline-chart');
    
    if (timelineChart) {
        timelineChart.destroy();
    }

    timelineChart = new Chart(canvas, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Reclaimed Accounts',
                data: counts,
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointBackgroundColor: '#667eea',
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            }]
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
    const tbody = document.getElementById('accounts-tbody');
    
    if (accounts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #999;">No accounts indexed yet</td></tr>';
        return;
    }

    // Sort by locked rent descending
    accounts.sort((a, b) => b.lockedRent - a.lockedRent);

    tbody.innerHTML = accounts.map(account => `
        <tr>
            <td><code class="tx-link" title="${account.pubkey}">${account.pubkey.substring(0, 12)}...</code></td>
            <td>${account.type}</td>
            <td><code class="tx-link" title="${account.owner || 'N/A'}">${(account.owner || 'N/A').substring(0, 12)}...</code></td>
            <td><span class="status-badge status-${account.status.toLowerCase()}">${account.status}</span></td>
            <td>${(account.lockedRent / 1e9).toFixed(4)} SOL</td>
            <td>${account.reason || '—'}</td>
            <td>${account.txSignature ? `<code class="tx-link" title="${account.txSignature}">${account.txSignature.substring(0, 12)}...</code>` : '—'}</td>
        </tr>
    `).join('');
}

/**
 * Update warnings list
 */
function updateWarnings(warnings) {
    const container = document.getElementById('warnings-content');
    
    if (warnings.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">All systems normal ✓</p>';
        return;
    }

    container.innerHTML = warnings.map(warning => {
        const icon = warning.level === 'error' ? '⚠️' : 
                    warning.level === 'warning' ? '⚡' : 'ℹ️';
        
        return `
            <div class="warning-item ${warning.level}">
                <div class="warning-icon">${icon}</div>
                <div class="warning-content">
                    <div class="warning-message">${escapeHtml(warning.message)}</div>
                    <div class="warning-time">${new Date(warning.timestamp).toLocaleString()}</div>
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
        { label: 'Indexed', key: 'indexed' },
        { label: 'Analyzed', key: 'analyzed' },
        { label: 'Approved', key: 'approved' },
        { label: 'Reclaimed', key: 'reclaimed' },
        { label: 'Skipped', key: 'skipped' },
        { label: 'Failed', key: 'failed' }
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
