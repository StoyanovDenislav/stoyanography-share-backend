# Automated Cleanup Jobs

This directory contains scripts for automated maintenance tasks.

## Available Scripts

### 1. Collection Cleanup (`cleanupCollections.js`)

Automatically deletes collections that have reached their 14-day expiration date.

**What it does:**

- Finds all PhotoCollections where `autoDeleteAt <= current time`
- Soft-deletes them (sets `deletedAt`, `isActive = false`)
- Sets deletion reason to "Auto-deleted after 14 days"

**Run manually:**

```bash
npm run cleanup-collections
```

### 2. Token Cleanup (`cleanupTokens.js`)

Removes expired refresh tokens from the database.

**What it does:**

- Finds all RefreshTokens where `expiresAt < current time`
- Permanently deletes them from the database

**Run manually:**

```bash
npm run cleanup-tokens
```

## Setting up Automated Execution (Cron)

### Linux/macOS

1. Open your crontab:

```bash
crontab -e
```

2. Add the following lines (adjust paths as needed):

```bash
# Run collection cleanup daily at midnight
0 0 * * * cd /home/abyzls/Desktop/stoyanography/stoyanography-share/backend && npm run cleanup-collections >> /var/log/stoyanography-cleanup-collections.log 2>&1

# Run token cleanup daily at 2 AM
0 2 * * * cd /home/abyzls/Desktop/stoyanography/stoyanography-share/backend && npm run cleanup-tokens >> /var/log/stoyanography-cleanup-tokens.log 2>&1
```

3. Save and exit

**Cron schedule syntax:**

```
* * * * *
│ │ │ │ │
│ │ │ │ └─── Day of week (0-7, Sunday = 0 or 7)
│ │ │ └───── Month (1-12)
│ │ └─────── Day of month (1-31)
│ └───────── Hour (0-23)
└─────────── Minute (0-59)
```

**Common schedules:**

- `0 0 * * *` - Daily at midnight
- `0 */6 * * *` - Every 6 hours
- `*/30 * * * *` - Every 30 minutes
- `0 0 * * 0` - Weekly on Sunday at midnight

### Windows (Task Scheduler)

1. Open Task Scheduler
2. Create a new Basic Task
3. Name: "Stoyanography Collection Cleanup"
4. Trigger: Daily at 12:00 AM
5. Action: Start a program
   - Program: `npm`
   - Arguments: `run cleanup-collections`
   - Start in: `C:\path\to\stoyanography-share\backend`
6. Repeat for token cleanup

### Using PM2 (Recommended for Production)

If you're already using PM2 for your application, you can use `pm2-cron`:

```bash
# Install pm2-cron module
pm2 install pm2-cron

# Start the app with cron jobs
pm2 start ecosystem.config.js
```

Create `ecosystem.config.js` in the backend directory:

```javascript
module.exports = {
  apps: [
    {
      name: "stoyanography-api",
      script: "./app.js",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "cleanup-collections",
      script: "./scripts/cleanupCollections.js",
      cron_restart: "0 0 * * *", // Daily at midnight
      autorestart: false,
    },
    {
      name: "cleanup-tokens",
      script: "./scripts/cleanupTokens.js",
      cron_restart: "0 2 * * *", // Daily at 2 AM
      autorestart: false,
    },
  ],
};
```

## Monitoring

### View cron logs (Linux/macOS):

```bash
# Collection cleanup logs
tail -f /var/log/stoyanography-cleanup-collections.log

# Token cleanup logs
tail -f /var/log/stoyanography-cleanup-tokens.log
```

### View PM2 logs:

```bash
pm2 logs cleanup-collections
pm2 logs cleanup-tokens
```

## Testing

Before setting up automated execution, test the scripts manually:

```bash
# Test collection cleanup
npm run cleanup-collections

# Test token cleanup
npm run cleanup-tokens
```

The scripts will output the number of items cleaned up and any errors encountered.

## Important Notes

1. **Environment Variables**: Make sure your `.env` file is properly configured in the backend directory
2. **Database Access**: The scripts need access to the OrientDB database
3. **Soft Delete**: Collections are soft-deleted (marked as deleted) rather than permanently removed
4. **Hard Delete**: Refresh tokens are permanently deleted when expired
5. **Logging**: Consider setting up proper log rotation for production environments

## Troubleshooting

**Script not running:**

- Check cron is running: `systemctl status cron` (Linux) or `service cron status`
- Check crontab syntax: `crontab -l`
- Verify script permissions: `ls -l scripts/cleanupCollections.js`
- Check logs for errors

**Database connection errors:**

- Verify `.env` file exists and has correct database credentials
- Ensure OrientDB is running
- Check network connectivity to database

**No items being cleaned up:**

- Verify items actually exist that meet the criteria
- Check database time vs. system time
- Review the SQL queries in the cleanup scripts
