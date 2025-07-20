# Content Pipeline

A comprehensive content automation system for TikTok with AI-powered content generation, aesthetic analysis, and automated posting capabilities.

## 🚀 **Recent Updates**

- ✅ **GitHub Integration**: Now connected to GitHub for automatic deployments
- ✅ **TikTok OAuth**: Full OAuth integration with database storage
- ✅ **Security**: Removed hardcoded API keys, using environment variables
- ✅ **Database**: TikTok columns added to account_profiles table

## 🏗️ **Architecture**

This project uses a modular pipeline architecture with the following components:

### Core Pipeline Stages
- **Input Processor**: Handles various input formats and sources
- **Content Acquirer**: Fetches content from external APIs (Apify)
- **AI Analyzer**: Analyzes content using OpenAI for aesthetic classification
- **Image Processor**: Processes and optimizes images for social media
- **Database Storage**: Stores processed data in Supabase
- **Theme Content Generator**: Generates themed content based on analysis

### Automation Features
- **Batch Processing**: Process multiple accounts simultaneously
- **Incremental Scraping**: Smart content acquisition with deduplication
- **Background Analysis**: Automated aesthetic and color analysis
- **TikTok Integration**: Direct posting to TikTok with OAuth

## 🛠️ **Setup**

1. **Clone the repository**:
   ```bash
   git clone https://github.com/ljnorth/content-pipeline-clean.git
   cd content-pipeline-clean
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   ```bash
   cp env.example .env
   # Edit .env with your actual values
   ```

4. **Deploy to Vercel**:
   ```bash
   vercel --prod
   ```

## 🔧 **Environment Variables**

Copy `env.example` to `.env` and fill in your values:

- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key
- `TIKTOK_CLIENT_KEY`: TikTok API client key
- `TIKTOK_CLIENT_SECRET`: TikTok API client secret
- `TIKTOK_REDIRECT_URI`: OAuth callback URL
- `OPENAI_API_KEY`: OpenAI API key
- `APIFY_TOKEN`: Apify API token

## 🚀 **Deployment**

This project is automatically deployed to Vercel when you push to the `master` branch on GitHub.

**Live URL**: https://easypost.fun

## 📊 **Features**

### Content Processing
- **Multi-source content acquisition** via Apify
- **AI-powered aesthetic analysis** using OpenAI
- **Background color detection** and storage
- **Hook slide analysis** for engagement optimization
- **Batch processing** for multiple accounts

### TikTok Integration
- **OAuth authentication** flow
- **Direct video uploads** to TikTok
- **Account management** with token storage
- **Status tracking** for uploads

### Database Management
- **Supabase integration** for data storage
- **Account profiles** with TikTok connection status
- **Content tracking** and analytics
- **Automated migrations** for schema updates

## 🔄 **Workflow**

1. **Setup**: Configure accounts and TikTok OAuth
2. **Acquisition**: Fetch content from external sources
3. **Analysis**: AI analyzes content for aesthetics and themes
4. **Processing**: Images are optimized and prepared
5. **Generation**: Create themed content based on analysis
6. **Upload**: Post directly to TikTok via API
7. **Tracking**: Monitor upload status and performance

## 📁 **Project Structure**

```
├── api/                    # Vercel serverless functions
├── src/
│   ├── pipeline/          # Main pipeline implementations
│   ├── stages/            # Individual pipeline stages
│   ├── automation/        # Automated workflows
│   ├── database/          # Database utilities
│   └── utils/             # Helper utilities
├── supabase/              # Database migrations
└── docs/                  # Documentation
```

## 🤝 **Contributing**

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 **License**

This project is licensed under the MIT License.

---

**Built with ❤️ for content creators** 