# Content Pipeline

A comprehensive content generation and management system for social media automation.

Note: Deployment ping to refresh env vars.

## 🏗️ New Architecture

The codebase has been refactored into a clean, modular structure:

```
src/
├── database/          # Database connection and utilities
│   └── supabase-client.js
├── content/           # Content generation pipelines
│   ├── pipelines/     # Different pipeline variants
│   │   ├── index.js   # Default pipeline
│   │   ├── batch.js   # Batch processing (50% cost savings)
│   │   ├── fast.js    # Concurrent processing (10x faster)
│   │   └── enhanced.js # Full analysis with hook slides
│   └── stages/        # Pipeline stage modules
├── slack/             # Slack integration
│   ├── index.js       # Basic Slack API
│   └── enhanced.js    # Enhanced Slack with previews
├── analytics/         # Database analytics
│   ├── aesthetics.js  # Aesthetic analysis
│   ├── database.js    # Database statistics
│   └── index.js       # Analytics exports
├── utils/             # Shared utilities
│   ├── logger.js      # Logging utility
│   ├── supabase-storage.js
│   └── video-generator.js
└── index.js           # Main entry point

scripts/               # Maintenance scripts
├── clear-database.js
└── setup-account-profiles.js

api/                   # Vercel API endpoints
```

## 🚀 Quick Start

### Basic Usage

```javascript
import ContentPipeline from './src/index.js';

const pipeline = new ContentPipeline({
  pipelineType: 'enhanced',  // default, batch, fast, enhanced
  enableSlack: true,
  enableAnalytics: true
});

await pipeline.run();
```

### Individual Modules

```javascript
// Content generation
import { DefaultPipeline, BatchPipeline, FastPipeline, EnhancedPipeline } from './src/content/index.js';

// Slack integration
import { SlackAPI, EnhancedSlackAPI } from './src/slack/index.js';

// Analytics
import { AestheticsAnalytics, DatabaseAnalytics } from './src/analytics/index.js';

// Database
import { SupabaseClient } from './src/database/supabase-client.js';
```

## 📊 Pipeline Types

### Default Pipeline
- Standard content generation
- Individual AI analysis
- Basic database storage

### Batch Pipeline
- **50% cost savings** vs individual API calls
- Processes images in batches
- Ideal for large datasets

### Fast Pipeline
- **10x faster** processing
- Concurrent AI analysis
- Real-time results

### Enhanced Pipeline
- Full feature set
- Hook slide detection
- Background color analysis
- Theme-based content generation

## 🔧 Setup

1. **Environment Variables**
   ```bash
   cp env.example .env
   # Fill in your Supabase and Slack credentials
   ```

2. **Database Setup**
   ```bash
   node scripts/setup-account-profiles.js
   ```

3. **Run Pipeline**
   ```bash
   node run-enhanced-pipeline.js
   ```

## 📈 Analytics

### Database Statistics
```javascript
import { DatabaseAnalytics } from './src/analytics/index.js';

const analytics = new DatabaseAnalytics();
const stats = await analytics.getDatabaseStats();
// Returns: { images, posts, accounts, hookSlides, generatedPosts }
```

### Aesthetic Analysis
```javascript
import { AestheticsAnalytics } from './src/analytics/index.js';

const analytics = new AestheticsAnalytics();
const analysis = await analytics.analyzeAesthetics();
// Returns detailed aesthetic breakdown and variations
```

## 🔗 Slack Integration

### Basic Slack
```javascript
import { SlackAPI } from './src/slack/index.js';

const slack = new SlackAPI();
await slack.sendPostsToSlack(generatedContent);
```

### Enhanced Slack
```javascript
import { EnhancedSlackAPI } from './src/slack/index.js';

const slack = new EnhancedSlackAPI();
await slack.sendConsolidatedPosts(generatedContent);
// Includes preview links and batch downloads
```

## 🗄️ Database Schema

The system uses Supabase with the following main tables:
- `accounts` - Social media accounts
- `posts` - Scraped posts
- `images` - Extracted images with AI analysis
- `hook_slides` - Detected hook slides and themes
- `background_colors` - Background color analysis
- `generated_posts` - Generated content
- `account_profiles` - Account configuration

## 🧹 Maintenance

### Clear Database
```bash
node scripts/clear-database.js
```

### Setup Account Profiles
```bash
node scripts/setup-account-profiles.js
```

## 📝 API Endpoints

The system includes Vercel API endpoints in the `api/` directory:
- Content generation
- Upload to Slack
- Upload to TikTok
- Account management
- Status checking

## 🎯 Key Features

- **Modular Architecture**: Clean separation of concerns
- **Multiple Pipeline Types**: Choose based on speed/cost needs
- **Slack Integration**: Rich previews and batch downloads
- **Analytics**: Comprehensive database and aesthetic analysis
- **Scalable**: Easy to extend with new features
- **Cost Optimized**: Batch processing for 50% savings
- **Real-time**: Concurrent processing for immediate results

## 🔄 Migration from Old Structure

The old structure has been preserved in the `src/stages/` directory for compatibility. All new development should use the new modular structure.

## 📚 Documentation

- `AUTOMATION_README.md` - Automation setup guide
- `BATCH_PROCESSING_README.md` - Batch processing details
- `DASHBOARD_README.md` - Web dashboard setup
- `TIKTOK_SETUP_GUIDE.md` - TikTok integration
- `SUPABASE_STORAGE_SETUP.md` - Storage configuration 