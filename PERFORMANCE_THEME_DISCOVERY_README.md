# 🎯 Performance-Based Theme Discovery System

## What This Does (Simple Explanation)

Think of this like having a smart assistant that:
1. **Looks at your most successful posts** (the ones with lots of likes and views)
2. **Finds patterns** in what made them successful (like "Summer Streetwear" or "Cozy Fall Vibes")
3. **Creates a recipe book** of winning themes
4. **Uses those recipes** to generate new content that's more likely to succeed

Instead of randomly picking images, your system now knows what actually works for your audience!

## 🚀 How to Use It

### Step 1: Discover Themes from Your Successful Posts

First, let's analyze your existing content to find what works:

```bash
# Basic theme discovery (finds themes from posts with 5%+ engagement)
node run-theme-discovery.js

# More selective (only posts with 8%+ engagement)
node run-theme-discovery.js --min-engagement 0.08

# Deploy the database schema first if needed
node run-theme-discovery.js --deploy-schema

# Get help
node run-theme-discovery.js --help
```

**What this does:**
- Looks through your posts to find the most successful ones
- Groups them by patterns (like aesthetic + season + colors)
- Uses AI to create catchy theme names like "Cozy Fall Vibes" or "Summer Streetwear"
- Stores these themes in your database for future use

### Step 2: Generate Content Using Discovered Themes

Now use your discovered themes to create better content:

#### Via API Endpoint:
```javascript
// POST to /api/generate-performance-content
{
  "accountUsername": "fashionista_lj",
  "postCount": 3,
  "imageCount": 5,
  "minConfidence": "medium"
}
```

#### Via Code:
```javascript
import { PerformanceBasedContentGenerator } from './src/stages/performance-based-content-generator.js';

const generator = new PerformanceBasedContentGenerator();
const result = await generator.generateContentWithThemes('fashionista_lj', {
  postCount: 3,
  imageCount: 5,
  minConfidence: 'medium'
});
```

## 📊 What You'll Get

### Theme Discovery Results:
```
🎉 Theme Discovery Complete!
   📊 High-performing images analyzed: 247
   🔍 Patterns identified: 15
   ✨ Themes discovered: 12
   💾 Themes stored in database: 12
   💰 Total AI cost: $0.0234

🏆 TOP DISCOVERED THEMES:
   1. "Cozy Fall Vibes"
      📊 Performance: 87.3/100
      📈 Avg Engagement: 8.45%
      🎯 Confidence: high
      📝 Description: Warm autumn outfits with earth tones and layering

   2. "Summer Streetwear"
      📊 Performance: 82.1/100  
      📈 Avg Engagement: 7.92%
      🎯 Confidence: high
      📝 Description: Casual urban looks perfect for hot weather
```

### Generated Content:
- **3 posts** using your best-performing themes
- **5 images each** that match the theme's successful pattern
- **Captions and hashtags** designed to match what worked before
- **Performance predictions** based on historical data

## 🗄️ Database Tables

The system creates these tables to store your discoveries:

### `discovered_themes`
Stores your "recipe book" of successful content patterns:
- `theme_name`: "Cozy Fall Vibes", "Summer Streetwear", etc.
- `performance_score`: How well this theme performs (0-100)
- `confidence_level`: How confident we are (low/medium/high)
- `keywords`, `hashtags`: What to use for this theme
- `aesthetic`, `season`, `colors`: The pattern that makes it work

## 🔧 Configuration Options

### Theme Discovery Options:
- `--min-engagement 0.05`: Only analyze posts with 5%+ engagement (default)
- `--max-themes 20`: Maximum themes to discover (default: 20)
- `--deploy-schema`: Create database tables first

### Content Generation Options:
- `postCount`: How many posts to generate (default: 3)
- `imageCount`: Images per post (default: 5)
- `minConfidence`: Theme confidence level - "low", "medium", "high" (default: "medium")
- `preferredThemes`: Specific themes to use (optional)

## 🎯 Example Workflow

Here's how to use this system step by step:

### 1. First Time Setup
```bash
# Deploy the database schema
node run-theme-discovery.js --deploy-schema

# Discover themes from your successful posts
node run-theme-discovery.js
```

### 2. Generate Content
```bash
# Use your discovered themes to create content
curl -X POST http://localhost:3000/api/generate-performance-content \
  -H "Content-Type: application/json" \
  -d '{
    "accountUsername": "fashionista_lj",
    "postCount": 3,
    "imageCount": 5,
    "minConfidence": "medium"
  }'
```

### 3. Regular Updates
```bash
# Run theme discovery monthly to find new trends
node run-theme-discovery.js --min-engagement 0.06
```

## 🚨 Troubleshooting

### "No high-performing posts found"
- **Problem**: Your posts don't have enough engagement data
- **Solutions**: 
  - Lower the threshold: `--min-engagement 0.02`
  - Run the content pipeline to scrape more posts
  - Make sure your posts have engagement data

### "No suitable themes found"
- **Problem**: No themes match your account
- **Solutions**:
  - Run theme discovery first
  - Lower confidence: `"minConfidence": "low"`
  - Check if you have analyzed images in the database

### "Database connection failed"
- **Problem**: Can't connect to Supabase
- **Solutions**:
  - Check your `.env` file has correct Supabase credentials
  - Run with `--deploy-schema` to create missing tables
  - Check your Supabase dashboard

## 💡 Pro Tips

1. **Run theme discovery monthly** to catch new trends
2. **Start with lower engagement thresholds** (3-4%) if you don't have many high-performing posts
3. **Use "high" confidence themes** for your most important content
4. **Mix theme-based content** with regular content for variety
5. **Track which themes work best** for each account

## 📈 Expected Results

After implementing this system, you should see:
- **Higher engagement rates** because you're using proven patterns
- **More consistent performance** because you know what works
- **Better content strategy** based on actual data, not guesswork
- **Time savings** because the AI knows what to create

## 🔄 Integration with Existing System

This system works alongside your current content generation:
- **Regular generation**: Random image combinations
- **Performance-based generation**: Uses discovered themes
- **Theme-based generation**: Uses specific hook slides
- **Account-optimized generation**: Tailored to account profiles

You can use whichever approach works best for each situation!

---

## Quick Start Commands

```bash
# 1. Discover themes from your successful content
node run-theme-discovery.js --deploy-schema

# 2. Generate content using those themes
curl -X POST http://localhost:3000/api/generate-performance-content \
  -H "Content-Type: application/json" \
  -d '{"accountUsername": "your_account", "postCount": 3}'

# 3. Check your results in the database or API response
```

That's it! Your content generation is now powered by actual performance data instead of random combinations. 🎉 