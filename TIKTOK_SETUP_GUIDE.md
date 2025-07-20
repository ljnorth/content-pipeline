# 🔗 TikTok OAuth Setup Guide

## Overview

This guide walks you through connecting your TikTok accounts to the automation system using the built-in web interface. Once connected, your accounts can receive automated content posts directly to their drafts.

## 🎯 **Simple Explanation**

Think of this like **connecting your TikTok account to a scheduling app**:

1. **You click "Connect"** on an account in the web interface
2. **TikTok opens** and asks "Do you want to let this app post for you?"
3. **You say "Yes"** and TikTok gives the app permission
4. **Now the app can create drafts** in your TikTok account automatically

## 📋 **Prerequisites**

✅ **TikTok Sandbox Credentials** (you already have these):
- Client Key: `sbawnd334ftden89r1`
- Client Secret: `Xo31EpXcRVa0Q601NG5r2EdIFBnlstS1`
- Sandbox Mode: Enabled

✅ **Web Interface Running**:
```bash
npm start
# or
node src/web/server.js
```

✅ **Account Profiles Created**: You need to have account profiles in the "Owned Accounts" section

## 🚀 **Step-by-Step Connection Process**

### Step 1: Open the Web Interface
1. Go to `http://localhost:3000`
2. Navigate to **"Owned Accounts"** tab

### Step 2: Create Account Profile (if needed)
1. Fill out the **"Create Account Profile"** form
2. Enter your TikTok username (without @)
3. Configure your content strategy and target audience
4. Click **"Save Profile"**

### Step 3: Connect TikTok Account
1. Find your account in the **"Account Profiles"** list
2. Look for the **"TikTok Status"** section in the account card
3. You'll see: `❌ Not Connected` with a **"Connect"** button
4. Click the **"🎵 Connect"** button

### Step 4: Complete OAuth Flow
1. A **new window opens** with TikTok authorization page
2. **Log in** to your TikTok account (the one matching the username)
3. TikTok shows: *"Do you want to authorize [App Name] to access your account?"*
4. Click **"Authorize"** or **"Allow"**
5. **Close the authorization window** when complete

### Step 5: Verify Connection
1. Back in the main interface, the status updates to:
   - ✅ **Connected** (green badge)
   - Shows expiration date
2. If there are issues, you'll see error messages

## 🔧 **Troubleshooting**

### ❌ **"Authorization window didn't open"**
- **Check popup blockers** - Allow popups for localhost:3000
- **Try again** - Click the Connect button again

### ❌ **"OAuth error: invalid_request"**
- **Wrong username** - Make sure the account profile username matches your actual TikTok username
- **Account not found** - Ensure the TikTok account exists and is accessible

### ❌ **"Token expired"**
- **Reconnect required** - Click Connect again to refresh the token
- **Normal behavior** - Tokens expire periodically for security

### ❌ **"Connection shows but automation fails"**
- **Sandbox limitations** - Some features may be limited in sandbox mode
- **Check logs** - Look at the server console for detailed error messages

## 🎛️ **Managing Connections**

### Check Connection Status
- Each account card shows current TikTok status
- **Green = Connected and valid**
- **Yellow = Connected but expired**
- **Gray = Not connected**

### Disconnect Account
- Click the **"Disconnect"** button next to connected accounts
- Removes authorization but keeps account profile

### Reconnect Expired Tokens
- Click **"Connect"** again on expired accounts
- Same process as initial connection

## 🧪 **Testing Your Connection**

### Method 1: Test Automation
```bash
npm run automation:test
```
This will:
- Generate 3 test posts for connected accounts
- Create actual drafts in your TikTok account
- Show success/failure status

### Method 2: Check Draft Folder
1. Open TikTok app/website
2. Go to **Profile → Drafts**
3. Look for **automatically generated content**
4. Content will have **AI-generated captions and hashtags**

## 📊 **What Happens After Connection**

### Automated Daily Posts
- **3 posts per day** per connected account
- **5 curated images** per post
- **AI-generated captions** matching your account strategy
- **Relevant hashtags** based on content and target audience
- **Drafts created** (not published automatically)

### Content Curation
- **Smart image selection** from your 8,000+ analyzed images
- **Aesthetic matching** to your account profile
- **Seasonal relevance** and trend awareness
- **Variety ensuring** no repetitive content

## 🔒 **Security & Privacy**

### What Access Does the App Have?
- **Create drafts** in your TikTok account
- **Upload images** to TikTok media library
- **Read basic profile info** (username, display name)

### What the App CANNOT Do:
- ❌ **Publish posts automatically** (creates drafts only)
- ❌ **Access personal messages** or private data
- ❌ **Modify existing content** or delete posts
- ❌ **Access other apps** or accounts

### Token Security
- **Tokens encrypted** in database
- **Automatic expiration** for security
- **Revokable** - You can disconnect anytime
- **Sandbox mode** - Limited access for testing

## 🌟 **Production vs Sandbox**

### Current Setup (Sandbox)
- **Safe testing environment**
- **Limited to test accounts**
- **All features work** but with restrictions
- **Perfect for learning** and initial setup

### Moving to Production
- **Real account access**
- **Full posting capabilities**
- **Requires TikTok app approval**
- **Change `TIKTOK_SANDBOX_MODE=false`**

## 🆘 **Getting Help**

### Common Issues
1. **Check server logs** in terminal where you started the server
2. **Verify credentials** in `.env` file
3. **Test with different browsers** if authorization fails
4. **Check TikTok account** is accessible and not restricted

### Support Channels
- **Server logs**: Look for detailed error messages
- **Browser console**: Check for JavaScript errors
- **TikTok API docs**: Official troubleshooting guides

---

## 🎉 **You're Ready!**

Once your accounts are connected, you can:

1. **Run daily automation**: `npm run automation`
2. **Test anytime**: `npm run automation:test`
3. **Monitor performance** through the web interface
4. **Adjust strategies** based on results

Your TikTok accounts will now receive **high-quality, curated content** tailored to their specific audiences and aesthetic preferences! 