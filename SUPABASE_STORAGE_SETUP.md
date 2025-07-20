# Supabase Storage Setup Guide

This guide explains how to set up Supabase Storage for your fashion content pipeline, so your images are stored in the cloud instead of locally.

## 🎯 What This Does

- **Before**: Images were stored locally on your computer (e.g., `/Users/YourName/content pipeline/temp/username/image.jpg`)
- **After**: Images are uploaded to Supabase Storage and accessible via public URLs (e.g., `https://oxskatabfilwdufzqdzd.supabase.co/storage/v1/object/public/fashion-images/username/postid/image.jpg`)

## 📋 Setup Steps

### 1. Create the Storage Bucket

Since the automatic bucket creation requires admin privileges, you'll need to create it manually:

1. **Go to your Supabase Dashboard:**
   ```
   https://oxskatabfilwdufzqdzd.supabase.co/project/default/storage/buckets
   ```

2. **Click "Create Bucket"**

3. **Configure the bucket:**
   - **Bucket name**: `fashion-images`
   - **Public bucket**: ✅ **Yes** (important for public access)
   - **File size limit**: `10MB`
   - **Allowed MIME types**: 
     - `image/jpeg`
     - `image/png` 
     - `image/webp`
     - `image/gif`

4. **Click "Create bucket"**

### 2. Test the Setup

Run the setup verification script:

```bash
npm run setup-storage
```

This will:
- ✅ Check if the bucket exists
- ✅ Test upload functionality
- ✅ Test public URL generation
- ✅ Clean up test files

If successful, you'll see:
```
🎉 Supabase Storage Setup Complete!
✨ Your pipeline can now upload images to Supabase Storage!
```

### 3. Test with Real Images

If you have images in your `temp/` directory, test the upload:

```bash
npm run test-storage
```

This will:
- Find an existing image in your temp directory
- Upload it to Supabase Storage
- Display the public URL

## 🚀 How It Works

### During Pipeline Execution

When you run your pipeline (`npm run pipeline`), the system will now:

1. **Download images locally** (as before)
2. **Analyze images with AI** (as before)
3. **Upload images to Supabase Storage** (NEW!)
4. **Store public URLs in database** (instead of local paths)
5. **Display images in dashboard** (using public URLs)

### File Organization

Images are organized in Supabase Storage as:
```
fashion-images/
├── username1/
│   ├── postid1/
│   │   ├── image1.jpg
│   │   └── image2.jpg
│   └── postid2/
│       └── image1.jpg
└── username2/
    └── postid3/
        └── image1.jpg
```

### Database Changes

Your `images` table will now store:
- **Before**: `image_path = "/Users/YourName/content pipeline/temp/username/image.jpg"`
- **After**: `image_path = "https://oxskatabfilwdufzqdzd.supabase.co/storage/v1/object/public/fashion-images/username/postid/image.jpg"`

## 🔧 Configuration

### Environment Variables

Your `.env` file should contain:
```env
SUPABASE_URL=https://oxskatabfilwdufzqdzd.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
```

### Bucket Settings

- **Name**: `fashion-images`
- **Public**: Yes
- **Size Limit**: 10MB per file
- **Allowed Types**: JPEG, PNG, WebP, GIF

## 🛠️ Troubleshooting

### "Bucket not found" Error

**Problem**: The bucket doesn't exist yet.

**Solution**: 
1. Go to your Supabase Dashboard
2. Create the `fashion-images` bucket manually
3. Make sure it's set to **public**

### "Row-level security" Error

**Problem**: Your Supabase project has RLS enabled.

**Solution**: The bucket needs to be created manually through the dashboard (not programmatically).

### Images Not Showing in Dashboard

**Problem**: Old images in database still have local paths.

**Solution**: 
1. Run the pipeline again to get new images with public URLs
2. Or update existing database records to use public URLs

### Upload Fails During Pipeline

**Problem**: Network issues or bucket permissions.

**Solution**: 
- The system will fall back to local paths
- Check your internet connection
- Verify bucket exists and is public

## 📊 Benefits

### ✅ Advantages of Supabase Storage

1. **Public Access**: Images can be viewed from anywhere
2. **Scalability**: No local storage limits
3. **Performance**: CDN-backed image delivery
4. **Backup**: Images are safely stored in the cloud
5. **Sharing**: Easy to share dashboard with others

### ⚠️ Considerations

1. **Internet Required**: Pipeline needs internet to upload
2. **Storage Costs**: Supabase has storage limits/costs
3. **Bandwidth**: Large images use more bandwidth

## 🔄 Migration

### For Existing Data

If you have existing images with local paths in your database:

1. **Run the pipeline again** - New images will use Supabase Storage
2. **Old images** will still work if the local files exist
3. **Mixed setup** is fine - some images local, some in storage

### Full Migration (Optional)

To migrate all existing images to storage:

```bash
# This would need to be a custom script
node migrate-images-to-storage.js
```

## 🎉 Next Steps

1. **Create the bucket** in Supabase Dashboard
2. **Run the setup script** to verify everything works
3. **Run your pipeline** to start uploading new images to storage
4. **Check your dashboard** to see images with public URLs

Your fashion content pipeline is now cloud-ready! 🚀 