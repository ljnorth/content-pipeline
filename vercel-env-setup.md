# Vercel Environment Variables Setup for TikTok Upload Verification

## 🌐 Setting Up Environment Variables for easypost.fun

Your TikTok upload verification system needs environment variables configured in Vercel to work properly on your deployment.

---

## 📋 Required Environment Variables

### 🔗 Supabase (Database)
```
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 📱 TikTok API
```
TIKTOK_CLIENT_KEY=your_tiktok_client_key
TIKTOK_CLIENT_SECRET=your_tiktok_client_secret
TIKTOK_SANDBOX_MODE=true
```

### 🌐 Web Interface
```
BASE_URL=https://easypost.fun
PORT=3000
```

---

## 🎯 How to Add Environment Variables to Vercel

### Step 1: Access Vercel Dashboard
1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Select your `easypost.fun` project

### Step 2: Navigate to Environment Variables
1. Click the **Settings** tab
2. Go to **Environment Variables** section
3. Click **Add New**

### Step 3: Add Each Variable
For each environment variable:

1. **Name**: Enter the variable name (e.g., `SUPABASE_URL`)
2. **Value**: Enter the actual value
3. **Environment**: Select which environments this applies to:
   - ✅ **Production** (for easypost.fun)
   - ✅ **Preview** (for preview deployments)
   - ✅ **Development** (for local development)

4. Click **Save**

### Step 4: Repeat for All Variables
Add all the required variables listed above.

---

## 🔍 How to Get Your Values

### Supabase Values
1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings** → **API**
4. Copy:
   - **Project URL** → `SUPABASE_URL`
   - **anon public** → `SUPABASE_ANON_KEY`
   - **service_role secret** → `SUPABASE_SERVICE_ROLE_KEY`

### TikTok Values
1. Go to [developers.tiktok.com](https://developers.tiktok.com/)
2. Select your app
3. Go to **App Management** → **App Info**
4. Copy:
   - **Client Key** → `TIKTOK_CLIENT_KEY`
   - **Client Secret** → `TIKTOK_CLIENT_SECRET`

---

## 🚀 After Adding Environment Variables

### 1. Redeploy Your Project
Environment variable changes require a new deployment:
- Go to your Vercel dashboard
- Click **Deployments**
- Click **Redeploy** on your latest deployment

### 2. Test Your Deployment
Once deployed, test your upload verification:

```bash
# Test the web interface
curl https://easypost.fun/api/accounts/aestheticgirl3854/tiktok-status
```

### 3. Update Your Upload Status Checker
The upload status checker will now work with your Vercel deployment:

```javascript
// Update the web interface URL in check-upload-status.js
const response = await fetch('https://easypost.fun/api/accounts/aestheticgirl3854/tiktok-status');
```

---

## 🔧 Troubleshooting

### Issue: Environment variables not loading
**Solution:**
- Make sure you selected all environments (Production, Preview, Development)
- Redeploy your project after adding variables
- Check Vercel deployment logs for errors

### Issue: TikTok API not working on production
**Solution:**
- Verify `TIKTOK_SANDBOX_MODE=true` for testing
- Check that your TikTok app's redirect URI includes `https://easypost.fun`
- Ensure your TikTok account is added to the Sandbox

### Issue: Database connection failing
**Solution:**
- Verify Supabase URL and keys are correct
- Check Supabase project settings for IP restrictions
- Ensure database tables exist (run schema migrations)

---

## 📊 Verification Checklist

After setting up environment variables:

- [ ] All environment variables added to Vercel
- [ ] Project redeployed successfully
- [ ] Web interface accessible at https://easypost.fun
- [ ] TikTok connection working
- [ ] Database queries successful
- [ ] Upload verification working

---

## 🎉 Success!

Once configured, your TikTok upload verification will work on:
- ✅ **Production**: https://easypost.fun
- ✅ **Local Development**: http://localhost:3000
- ✅ **Preview Deployments**: Vercel preview URLs

Your upload status checker and web interface will now work seamlessly across all environments! 