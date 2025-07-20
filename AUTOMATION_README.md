# 🤖 Daily TikTok Content Automation

## 🎯 Overview

Your automation system is now ready! It will automatically:
- **Generate 3 posts per day** for each of your TikTok accounts
- **5 curated images per post** selected from your analyzed fashion database
- **AI-generated captions and hashtags** optimized for each account's strategy
- **Upload to TikTok drafts** (mock mode by default, real API when configured)
- **Track everything** with detailed logging and analytics

## 🚀 Quick Start

### 1. Set Up Database Schema
First, run the automation schema in your Supabase SQL Editor:

```sql
-- Copy and paste the contents of automation-schema.sql
```

### 2. Create Account Profiles
Add your owned TikTok accounts to the system:

```bash
# Via web interface: http://localhost:3000
# Go to Account Management tab and add your accounts
```

### 3. Run Your First Automation

```bash
# Test mode (won't actually post to TikTok)
npm run automation:test

# Full automation run
npm run automation
```

## 🎮 Commands

### Test & Development
```bash
# Test with all active accounts
npm run automation:test

# Test with specific accounts
node run-automation.js --test --accounts=account1,account2

# Dry run (see what would happen)
npm run automation:dry-run
```

### Production
```bash
# Daily automation (checks if already ran today)
npm run automation

# Force run (ignores daily check)
node src/automation/daily-automation.js
```

## 🎯 How It Works

### Step 1: Content Generation
- **Curates 5 images** per post based on account strategy
- **Scores images** by aesthetic, color, and season relevance
- **Ensures variety** across aesthetics and source accounts
- **Generates AI captions** tailored to target audience

### Step 2: TikTok Upload
- **Mock mode**: Simulates uploads for testing
- **Real mode**: Uploads to TikTok drafts via API (when configured)
- **Tracks results** in database for analytics

### Step 3: Analytics & Logging
- **Detailed logging** of every step
- **Performance tracking** and success rates
- **Automation history** and trend analysis

## 📊 Account Strategy System

Each account can have a customized strategy:

```json
{
  "target_audience": {
    "age": "18-25",
    "interests": ["streetwear", "fashion"],
    "location": "urban"
  },
  "content_strategy": {
    "aestheticFocus": ["streetwear", "casual"],
    "colorPalette": ["neutral", "black", "white"]
  },
  "performance_goals": {
    "primaryMetric": "likes",
    "targetRate": 0.08,
    "secondaryMetric": "saves"
  }
}
```

## 🔧 Configuration

### Account Profiles Table
Each account needs an entry in `account_profiles`:

```sql
INSERT INTO account_profiles (username, account_type, content_strategy) VALUES 
('your_tiktok_account', 'owned', '{"aestheticFocus": ["trendy"]}');
```

### TikTok API Setup (Optional)
To enable real TikTok posting, add these environment variables:

```env
TIKTOK_ACCESS_TOKEN=your_access_token
TIKTOK_REFRESH_TOKEN=your_refresh_token  
TIKTOK_CLIENT_KEY=your_client_key
```

Without these, the system runs in **mock mode** (perfect for testing).

## 📈 Scheduling & Automation

### Cron Job Setup
To run daily automatically, add to your crontab:

```bash
# Run every day at 9 AM
0 9 * * * cd /path/to/your/project && npm run automation

# Or with more logging
0 9 * * * cd /path/to/your/project && npm run automation >> automation.log 2>&1
```

### GitHub Actions (Alternative)
```yaml
name: Daily TikTok Automation
on:
  schedule:
    - cron: '0 9 * * *'  # 9 AM daily
jobs:
  automation:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm run automation
```

## 📊 Analytics & Monitoring

### View Automation Status
```sql
-- Check automation status
SELECT * FROM automation_analytics;

-- Get today's automation status
SELECT * FROM get_automation_status();
```

### Database Tables
- `automation_runs`: High-level automation execution tracking
- `automation_logs`: Detailed step-by-step logging
- `generated_posts`: All generated content and upload status
- `account_profiles`: Account strategies and preferences

## 🎨 Content Generation Logic

### Image Selection Algorithm
1. **Query images** based on account's aesthetic and color preferences
2. **Score each image** for relevance (aesthetic match + color match + seasonality)
3. **Select top images** while ensuring variety (different aesthetics/accounts)
4. **Generate AI content** based on selected images

### AI Caption Generation
- **Analyzes image aesthetics** and colors
- **Considers account strategy** and target audience
- **Creates engaging captions** without hashtags
- **Generates 8-12 hashtags** (mix of trending and niche)

## 🚨 Error Handling

### Graceful Failure
- **Account-level isolation**: One account failing doesn't stop others
- **Post-level retry**: Individual post failures are logged but don't halt automation
- **Detailed error logging**: All failures tracked for debugging

### Common Issues & Solutions

**"Not enough suitable images"**
- Ensure you have analyzed images in your database
- Check account strategy filters aren't too restrictive
- Run pipeline to analyze more content

**"No active accounts found"**
- Add accounts to `account_profiles` table
- Set `is_active = true` and `account_type = 'owned'`

**"TikTok API error"**
- Check your API credentials in environment variables
- Verify account has proper TikTok API access
- System falls back to mock mode if credentials missing

## 🔍 Example Automation Run

```
🚀 STARTING DAILY TIKTOK AUTOMATION
🎯 Goal: Generate 3 posts (5 images each) for all active accounts

📝 STEP 1: Generating content...
🎯 Generating content for account: fashionista_test
📝 Generating post 1/3 for fashionista_test
🔍 Curating 5 images for fashionista_test...
✅ Post 1 generated: Streetwear Vibes (5 images)

📤 STEP 2: Uploading to TikTok drafts...
🎭 [MOCK] Uploading to @fashionista_test: Streetwear Vibes

🎉 DAILY AUTOMATION COMPLETE! (45.2s)

📊 AUTOMATION SUMMARY:
   👥 Accounts processed: 2
   📝 Posts generated: 6
   🖼️  Images used: 30
   ✅ Successful uploads: 6
   ❌ Failed uploads: 0
   📈 Completion rate: 100.0%
🎯 PERFECT RUN! All content generated and uploaded successfully!
```

## 🎯 Next Steps

### Ready to Use
Your automation system is **fully functional** in mock mode! You can:
1. Run test automations to see generated content
2. View results in your database
3. Monitor automation analytics

### To Enable Real TikTok Posting
1. **Apply for TikTok Developer Account**
2. **Create TikTok App** and get API credentials
3. **Add credentials** to your environment variables
4. **Test with one account** before scaling up

### Scaling Up
- **Add more accounts** to `account_profiles`
- **Customize strategies** for different niches
- **Set up monitoring** and alerts
- **Analyze performance** and optimize

---

## 🎉 Congratulations!

You now have a **fully automated TikTok content generation system** that will create personalized, high-quality content for all your accounts every day. The system is intelligent, fault-tolerant, and ready to scale with your business!

**What you've built:**
- ✅ AI-powered content generation
- ✅ TikTok API integration (mock + real)
- ✅ Account strategy management
- ✅ Automated scheduling capability
- ✅ Comprehensive analytics and logging
- ✅ Error handling and recovery
- ✅ Scalable architecture

Your content pipeline just became **fully autonomous**! 🚀 