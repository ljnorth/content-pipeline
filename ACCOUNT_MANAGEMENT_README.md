# Account Management & Pipeline Monitoring

## 🎯 Overview

The dashboard now includes comprehensive **Account Management** and **Pipeline Monitoring** features that allow you to:

- **Manage tracked accounts**: Add, view, and delete accounts
- **Monitor pipeline execution**: Track pipeline runs, view logs, and manage the data collection process
- **Real-time status**: See what's happening with your data pipeline at any time

## 🚀 Quick Setup

### 1. Run the Pipeline Logging Setup
First, add the pipeline logging system to your database:

1. Open your **Supabase Dashboard**
2. Go to the **SQL Editor**
3. Copy the contents of `pipeline-logging.sql`
4. Paste and run the script

This creates:
- `pipeline_runs` table to track pipeline execution
- `pipeline_logs` table for detailed logging
- Helper functions for logging and status updates
- Views for easy querying of pipeline activity

### 2. Access the Features
1. Start the dashboard: `npm run web`
2. Open `http://localhost:3000`
3. Navigate to the **Account Management** and **Pipeline Monitoring** tabs

## 📊 Account Management Tab

### Adding New Accounts
1. Go to the **Account Management** tab
2. Enter the username (with or without @)
3. Optionally add the account URL
4. Click "Add Account"

**Example usernames:**
- `@username`
- `username` (without @)
- `fashion_influencer_123`

### Viewing Account Statistics
The account table shows:
- **Username**: The account name
- **Last Scraped**: When the account was last processed
- **Total Posts**: Number of posts collected
- **Total Images**: Number of images analyzed
- **Avg Engagement**: Average engagement rate for the account
- **Actions**: Delete button to remove the account

### Deleting Accounts
⚠️ **Warning**: Deleting an account will remove:
- All posts from that account
- All images from that account
- The account record itself

This action cannot be undone!

## 🔧 Pipeline Monitoring Tab

### Pipeline Controls

#### 1. Run Full Pipeline
- **What it does**: Scrapes all tracked accounts and analyzes all content
- **Use case**: Complete data refresh and analysis
- **Duration**: Can take several minutes depending on account count

#### 2. Run Analysis Only
- **What it does**: Analyzes existing images without scraping new content
- **Use case**: Re-analyze content with updated AI models
- **Duration**: Faster than full pipeline

#### 3. Refresh Account Data
- **What it does**: Updates account metadata and statistics
- **Use case**: Quick refresh of account information
- **Duration**: Very fast

### Pipeline Status Overview
The status cards show:
- **Total Accounts**: Number of tracked accounts
- **Total Posts**: Total posts in the database
- **Total Images**: Total images analyzed
- **Pipeline Status**: Whether a pipeline is currently running

### Recent Pipeline Runs
A detailed table showing:
- **Type**: `full` or `analysis`
- **Status**: `running`, `completed`, or `failed` with status icons
- **Started**: When the pipeline started
- **Duration**: How long it took to complete
- **Processed**: Breakdown of what was processed (A=accounts, P=posts, I=images)

### Live Pipeline Logs
Real-time logging showing:
- **Timestamp**: When each log entry was created
- **Level**: `info`, `warning`, `error`, or `success`
- **Message**: Detailed information about what's happening
- **Color coding**: Different colors for different log levels

## 🛠️ Technical Details

### Database Schema

#### Pipeline Runs Table
```sql
pipeline_runs (
    id BIGSERIAL PRIMARY KEY,
    type TEXT NOT NULL,           -- 'full', 'analysis', etc.
    status TEXT NOT NULL,         -- 'running', 'completed', 'failed'
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    accounts_processed INTEGER,
    posts_processed INTEGER,
    images_processed INTEGER,
    error_message TEXT,
    logs JSONB,
    created_at TIMESTAMPTZ
)
```

#### Pipeline Logs Table
```sql
pipeline_logs (
    id BIGSERIAL PRIMARY KEY,
    run_id BIGINT REFERENCES pipeline_runs(id),
    level TEXT NOT NULL,          -- 'info', 'warning', 'error', 'success'
    message TEXT NOT NULL,
    timestamp TIMESTAMPTZ,
    metadata JSONB
)
```

### API Endpoints

#### Account Management
- `GET /api/accounts` - Get all accounts with statistics
- `POST /api/accounts` - Add a new account
- `DELETE /api/accounts/:username` - Delete an account and all its data

#### Pipeline Monitoring
- `GET /api/pipeline/status` - Get current pipeline status and recent runs
- `POST /api/pipeline/run` - Start a pipeline run
- `GET /api/pipeline/logs` - Get pipeline logs (optionally filtered by run ID)

### Pipeline Logging Functions

#### Add Pipeline Log
```sql
SELECT add_pipeline_log(
    p_run_id BIGINT,
    p_level TEXT,
    p_message TEXT,
    p_metadata JSONB DEFAULT '{}'
);
```

#### Update Pipeline Status
```sql
SELECT update_pipeline_run_status(
    p_run_id BIGINT,
    p_status TEXT,
    p_accounts_processed INTEGER DEFAULT NULL,
    p_posts_processed INTEGER DEFAULT NULL,
    p_images_processed INTEGER DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL
);
```

## 🎯 Best Practices

### Account Management
1. **Start Small**: Add a few accounts first to test the system
2. **Monitor Performance**: Watch engagement rates to identify high-performing accounts
3. **Regular Cleanup**: Remove accounts that are no longer relevant
4. **Backup Important Data**: Export data before deleting accounts

### Pipeline Monitoring
1. **Check Status Before Running**: Ensure no pipeline is already running
2. **Monitor Logs**: Watch the live logs for any errors or issues
3. **Use Analysis Only**: Use "Analysis Only" for quick re-analysis without scraping
4. **Schedule Runs**: Consider running pipelines during off-peak hours

### Troubleshooting

#### Pipeline Won't Start
1. **Check if already running**: Look at the pipeline status
2. **Check database connection**: Ensure Supabase is accessible
3. **Check logs**: Look for error messages in the live logs
4. **Restart server**: Sometimes a server restart helps

#### Account Not Loading
1. **Check database**: Ensure the accounts table exists
2. **Check permissions**: Verify RLS policies are correct
3. **Check network**: Ensure the API can reach Supabase

#### Pipeline Fails
1. **Check API keys**: Ensure OpenAI and other API keys are valid
2. **Check disk space**: Ensure there's enough space for temporary files
3. **Check rate limits**: Some APIs have rate limits
4. **Check logs**: Look for specific error messages

## 🔄 Workflow Examples

### Adding a New Account
1. Go to **Account Management** tab
2. Enter username: `@fashion_trends`
3. Enter URL: `https://tiktok.com/@fashion_trends`
4. Click "Add Account"
5. Go to **Pipeline Monitoring** tab
6. Click "Run Full Pipeline" to collect data

### Re-analyzing Content
1. Go to **Pipeline Monitoring** tab
2. Check that no pipeline is currently running
3. Click "Run Analysis Only"
4. Monitor the live logs for progress
5. Check the "Recent Pipeline Runs" table for completion

### Monitoring Performance
1. Go to **Account Management** tab
2. Look at the "Avg Engagement" column
3. Identify high-performing accounts
4. Consider adding similar accounts
5. Remove low-performing accounts if needed

## 🚀 Next Steps

1. **Set up the logging system** using the SQL script
2. **Add your first accounts** through the dashboard
3. **Run your first pipeline** to collect data
4. **Monitor the process** using the live logs
5. **Analyze the results** in the trending analytics tab

The account management and pipeline monitoring features give you complete control over your data collection process and help you maintain a high-quality dataset for your content analysis! 