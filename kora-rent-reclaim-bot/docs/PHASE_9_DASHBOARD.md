# Phase 9: Operator Dashboard

## Overview

The Operator Dashboard is a local, read-only web interface for monitoring reclaim operations in real-time. It provides visual insights into account tracking, reclaim events, audit logs, and system warnings without requiring direct access to data files.

**Features:**
- Real-time metrics and statistics
- Account tracking with detailed information
- Visual timeline of reclaim events
- Active warnings and system alerts
- Responsive, mobile-friendly design
- No transaction signing or wallet connections

## Quick Start

### 1. Enable Dashboard in Config

Edit `config.json`:

```json
{
  "dashboard": {
    "enabled": true,
    "port": 3000,
    "host": "localhost"
  }
}
```

### 2. Start Dashboard Server

```bash
# Using the CLI
npx ts-node src/cli.ts dashboard --config config.json

# Or specify custom port
npx ts-node src/cli.ts dashboard --config config.json --port 3001
```

### 3. Access Dashboard

Open your browser and navigate to:
```
http://localhost:3000
```

You should see the operator dashboard with real-time metrics.

## Dashboard Components

### Header Section

**Title**: "Solana Rent Reclaim Bot"
**Subtitle**: Status and quick stats updated in real-time

### Metrics Cards

Four main metric cards showing:

1. **Total Tracked**: Total number of sponsored accounts indexed
2. **Locked Rent**: Total SOL currently locked in tracked accounts (in SOL)
3. **Reclaimed Rent**: Total SOL successfully reclaimed (in SOL)
4. **Idle Accounts**: Number of accounts with recoverable rent

### Status Summary

Four status cards showing current counts:

- **🎯 Reclaimable**: Accounts eligible for reclaim
- **✅ Reclaimed**: Successfully reclaimed accounts
- **⏭️ Skipped**: Accounts skipped due to safety checks
- **❌ Failed**: Accounts where reclaim failed

### Tabbed Interface

#### Timeline Tab

Visual timeline showing reclaim events over the last 30 days.

**Chart Type**: Line chart with daily reclaim counts
**X-Axis**: Date (auto-formatted)
**Y-Axis**: Number of reclaims

**Interpretation:**
- Spikes indicate high reclaim activity
- Flat sections show idle periods
- Red flags for sudden drops

#### Accounts Tab

Detailed table of all tracked accounts.

**Columns:**
- **Address**: Partial account public key (12 chars) with full key in tooltip
- **Type**: Account type (System, SPL Token, PDA, Unknown)
- **Owner**: Partial owner address (12 chars)
- **Status**: Color-coded account status
- **Rent (SOL)**: Amount of rent locked in account
- **Reason**: Why account is in current state
- **Tx**: Transaction signature link (if applicable)

**Features:**
- Search box to filter accounts
- Status color coding
- Sortable by rent amount
- Hover for full addresses

**Status Colors:**
- 🔵 **Active**: Account is being monitored
- 🟣 **Reclaimable**: Ready for reclaim
- 🟢 **Reclaimed**: Successfully reclaimed
- 🟡 **Skipped**: Skipped by safety engine
- 🔴 **Failed**: Reclaim failed

#### Warnings Tab

System warnings and alerts.

**Warning Levels:**
- 🔴 **Error**: Critical issues requiring attention
- 🟡 **Warning**: Operational concerns
- 🔵 **Info**: Informational messages

**Common Warnings:**
- Idle rent above threshold
- Recent activity detected
- Reclaim failures
- Safety check issues

### Audit Summary

Footer section showing aggregate statistics:

- **Indexed**: Total accounts indexed
- **Analyzed**: Total accounts analyzed
- **Approved**: Accounts passed safety checks
- **Reclaimed**: Successfully reclaimed
- **Skipped**: Accounts skipped
- **Failed**: Reclaim failures

### Last Updated

Timestamp showing when data was last refreshed.

## API Endpoints

The dashboard server exposes read-only REST APIs:

### `/api/metrics`

Get dashboard metrics.

**Request:**
```
GET /api/metrics
```

**Response:**
```json
{
  "timestamp": 1699564800000,
  "totalTracked": 150,
  "totalRentLocked": 5000000000,
  "totalReclaimedLamports": 2500000000,
  "totalStillLocked": 2500000000,
  "reclaimableCount": 45,
  "skippedCount": 30,
  "confirmedCount": 75,
  "failedCount": 5
}
```

### `/api/accounts`

Get list of all tracked accounts.

**Request:**
```
GET /api/accounts
```

**Response:**
```json
[
  {
    "publicKey": "EPjFWaLb3odcccccccccccccccccccccccccccccccccc",
    "status": "reclaimed",
    "accountType": "SPL Token Account",
    "owner": "TokenMintMintMintMintMintMintMintMintMint",
    "rentLamports": 2039280,
    "reason": "Rent successfully reclaimed",
    "lastActivity": 1699564800000,
    "reclaimedAmount": 2039280,
    "txSignature": "5hq3PwZ..."
  },
  ...
]
```

### `/api/timeline`

Get timeline of reclaim events.

**Request:**
```
GET /api/timeline
```

**Response:**
```json
[
  {
    "timestamp": 1699560000000,
    "account": "EPjFWaLb...",
    "amount": 2039280,
    "status": "success"
  },
  {
    "timestamp": 1699563600000,
    "account": "TokenkegQ...",
    "amount": 0,
    "status": "failed"
  },
  ...
]
```

### `/api/warnings`

Get current warnings and alerts.

**Request:**
```
GET /api/warnings
```

**Response:**
```json
[
  {
    "level": "warning",
    "message": "2.5 SOL still idle in 45 accounts",
    "timestamp": 1699564800000
  },
  {
    "level": "info",
    "message": "5 accounts with recent activity detected",
    "timestamp": 1699564795000
  },
  ...
]
```

### `/api/audit-summary`

Get audit log summary statistics.

**Request:**
```
GET /api/audit-summary
```

**Response:**
```json
{
  "indexed": 150,
  "analyzed": 145,
  "approved": 120,
  "reclaimed": 75,
  "skipped": 30,
  "failed": 5
}
```

### `/health`

Health check endpoint.

**Request:**
```
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": 1699564800000
}
```

## Advanced Usage

### Custom Port

```bash
npx ts-node src/cli.ts dashboard --config config.json --port 8080 --host 0.0.0.0
```

### Remote Access

To access dashboard from another machine:

```bash
npx ts-node src/cli.ts dashboard --config config.json --host 0.0.0.0
```

Then access from another machine:
```
http://machine-ip:3000
```

**Security Note:** Dashboard is read-only, but be aware of network exposure. Use firewall rules to restrict access.

### Docker Deployment

Create `Dockerfile`:

```dockerfile
FROM node:18

WORKDIR /app

COPY . .

RUN npm install
RUN npm run build

EXPOSE 3000

CMD ["npm", "start", "dashboard", "--", "--config", "config.json"]
```

Build and run:

```bash
docker build -t kora-dashboard .
docker run -p 3000:3000 -v $(pwd)/config.json:/app/config.json kora-dashboard
```

## Data Sources

Dashboard reads data from:

1. **Audit Log** (`audit-log.json`):
   - All reclaim actions
   - Timestamps
   - Transaction signatures
   - Failure reasons

2. **Indexed Accounts** (`indexed-accounts.json`):
   - Account details
   - Account types
   - Owner information
   - Initial rent amounts

## Real-Time Updates

Dashboard auto-refreshes every 10 seconds:

```javascript
// From dashboard.js
setInterval(refreshDashboard, 10000); // 10 second interval
```

To change refresh interval, edit `public/dashboard.js`:

```javascript
// Change from 10000ms (10s) to your preferred interval
setInterval(refreshDashboard, 30000); // 30 seconds
```

## Customization

### Color Scheme

Edit `public/style.css`:

```css
/* Change primary color from purple to blue */
.header {
  background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%);
}
```

### Layout Modifications

Edit `public/index.html` to:
- Add new sections
- Remove components
- Reorder tabs

### Additional Charts

Extend `public/dashboard.js`:

```javascript
// Add pie chart for status distribution
const ctx = document.getElementById('status-pie');
const pieChart = new Chart(ctx, {
  type: 'pie',
  data: {
    labels: ['Reclaimed', 'Reclaimable', 'Skipped', 'Failed'],
    datasets: [{
      data: [75, 45, 30, 5],
      backgroundColor: ['#10b981', '#f59e0b', '#f97316', '#ef4444']
    }]
  }
});
```

## Troubleshooting

### Dashboard Won't Start

**Error:** "Failed to bind to port 3000"

**Solution:** Port already in use
```bash
# Use different port
npx ts-node src/cli.ts dashboard --port 3001
```

**Or kill process using port:**
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# macOS/Linux
lsof -i :3000
kill -9 <PID>
```

### No Data Displayed

**Error:** Dashboard shows 0 metrics

**Solution:** Ensure files exist:
```bash
# Check files
ls -la data/audit-log.json
ls -la data/indexed-accounts.json
```

If missing, run indexing first:
```bash
npx ts-node src/cli.ts index --config config.json --file accounts.json
```

### Slow Dashboard

**Error:** Dashboard is laggy or slow

**Solution:** Reduce refresh interval or optimize data size

```javascript
// Increase interval to reduce load
setInterval(refreshDashboard, 30000); // 30 seconds
```

Or check file sizes:
```bash
du -h data/audit-log.json
du -h data/indexed-accounts.json
```

If files are large (>100MB), consider archiving old entries.

### CSS Not Loading

**Error:** Dashboard displays without styling

**Solution:** Check public directory:
```bash
# Verify files exist
ls public/style.css
ls public/dashboard.js
ls public/index.html
```

Restart dashboard server if files were just created.

## Performance Considerations

### Large Datasets

For >10,000 accounts:

1. **Paginate accounts table:**
   Edit `dashboard.js` to show 100 per page

2. **Archive old audit logs:**
   Move completed entries to archive

3. **Increase refresh interval:**
   Change from 10s to 30s or 60s

### Memory Usage

Dashboard keeps all data in memory. For very large datasets:

```typescript
// In dashboardServer.ts - implement pagination
app.get('/api/accounts', (req, res) => {
  const page = req.query.page || 1;
  const limit = 100;
  const start = (page - 1) * limit;
  const accounts = allAccounts.slice(start, start + limit);
  res.json({ accounts, total: allAccounts.length });
});
```

## Security

### Access Control

Dashboard has no built-in authentication. Secure via:

1. **Firewall rules:**
   ```bash
   # Only allow localhost
   ufw allow from 127.0.0.1 to any port 3000
   ```

2. **Reverse proxy with auth:**
   ```nginx
   server {
     listen 80;
     server_name dashboard.example.com;
     
     auth_basic "Restricted";
     auth_basic_user_file /etc/nginx/.htpasswd;
     
     location / {
       proxy_pass http://localhost:3000;
     }
   }
   ```

3. **VPN/SSH tunnel:**
   ```bash
   ssh -L 3000:localhost:3000 user@remote-server
   ```

### Data Privacy

Dashboard only reads from audit-log and indexed-accounts files. No external data transmission.

## Integration with Alerting

Dashboard automatically detects active alerts:

```typescript
// In dashboardServer.ts
if (alertService && alertService.isEnabled()) {
  // Show alert status
  warnings.push({
    level: 'info',
    message: 'Telegram alerting active'
  });
}
```

## Summary

The Operator Dashboard provides:
- ✅ Real-time monitoring
- ✅ Visual insights
- ✅ Audit trail review
- ✅ Warning system
- ✅ Read-only access
- ✅ RESTful APIs

Perfect for:
- Monitoring active reclaim operations
- Reviewing historical data
- Investigating failures
- Sharing status reports
