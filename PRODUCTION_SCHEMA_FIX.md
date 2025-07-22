# 🚨 Production Schema Fix Guide

## The Problem

Your content generation endpoints are failing because your production database is missing essential tables. The current schema only has basic tables (`accounts`, `posts`, `images`) but your content generation code needs many more tables.

## Missing Tables Causing Failures

Your content generation endpoints are trying to access these tables that don't exist:

1. **`account_profiles`** - Stores account targeting and content strategy
2. **`generated_posts`** - Tracks content created by your pipeline
3. **`hook_slides`** - Stores theme-based content hooks
4. **`theme_generations`** - Tracks theme-based content generation
5. **`saved_generations`** - Stores generation history
6. **`performance_analytics`** - Tracks performance data
7. **`pipeline_runs`** - Tracks pipeline execution
8. **`pipeline_logs`** - Stores pipeline logs
9. **`image_usage`** - Tracks image usage to prevent duplicates

## The Solution

I've created a complete schema file that adds all missing tables. Here's how to deploy it:

### Option 1: Deploy via Script (Recommended)

1. **Run the deployment script:**
   ```bash
   node deploy-production-schema.js
   ```

2. **The script will:**
   - Connect to your production Supabase database
   - Create all missing tables
   - Add necessary indexes and functions
   - Set up sample data for testing

### Option 2: Manual Deployment

1. **Copy the SQL from `complete-production-schema.sql`**
2. **Go to your Supabase dashboard**
3. **Open the SQL Editor**
4. **Paste and run the entire schema**

## What This Fixes

After deploying this schema, your content generation endpoints will work:

- ✅ `/api/generate-simple-content` - Basic content generation
- ✅ `/api/generate-ai-content` - AI-powered content generation  
- ✅ `/api/generate-workflow-content` - Workflow-based generation
- ✅ `/api/generate-theme-content` - Theme-based generation
- ✅ `/api/generate-for-account` - Account-specific generation

## Key Features Added

### 1. Account Profiles
- Store targeting information (age, interests, location)
- Content strategy (aesthetic focus, color palette)
- Performance goals and posting schedule

### 2. Content Tracking
- Track all generated content
- Monitor performance over time
- Prevent image reuse (your 6-post rule)

### 3. Theme Management
- Store hook slides for theme-based content
- Track theme performance
- Generate consistent themed content

### 4. Pipeline Monitoring
- Track pipeline runs and performance
- Store detailed logs
- Monitor success rates

## Testing After Deployment

1. **Test content generation:**
   ```bash
   curl -X POST https://your-vercel-app.vercel.app/api/generate-simple-content \
     -H "Content-Type: application/json" \
     -d '{"accountUsername": "fashionista_lj", "postCount": 1, "imageCount": 5}'
   ```

2. **Check database tables:**
   - Go to Supabase dashboard
   - Check that all tables are created
   - Verify sample data is present

## Environment Variables Needed

Make sure these are set in your Vercel environment:

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for admin access

## Next Steps

1. **Deploy the schema** (run the script or manual SQL)
2. **Test content generation** in your Vercel app
3. **Run the content pipeline** to populate data
4. **Create account profiles** for your target accounts
5. **Start generating content** in production!

## Troubleshooting

If you still get errors after deploying:

1. **Check the logs** - Look for specific table errors
2. **Verify environment variables** - Make sure Supabase connection works
3. **Test database connection** - Ensure your app can connect to Supabase
4. **Check table permissions** - Make sure RLS policies allow access

The schema deployment should fix all the "table does not exist" errors you're seeing in production. 