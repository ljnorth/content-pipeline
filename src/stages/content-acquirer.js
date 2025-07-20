import { Logger } from '../utils/logger.js';
import path from 'path';
import fs from 'fs-extra';
import { SupabaseClient } from '../database/supabase-client.js';
import { ApifyClient } from 'apify-client';
import axios from 'axios';
import { exec } from 'child_process';

const TEMP_DIR = process.env.TEMP_DIR || 'temp';
const APIFY_TOKEN = process.env.APIFY_TOKEN;

export class ContentAcquirer {
  constructor() {
    this.logger = new Logger();
    this.db = new SupabaseClient();
    this.client = new ApifyClient({ 
      token: APIFY_TOKEN 
    });
  }

  async process(accounts) {
    const allPosts = [];
    let totalNewAccounts = 0;
    let totalExistingAccounts = 0;
    let totalSkippedPosts = 0;
    let totalNewPosts = 0;

    for (const account of accounts) {
      const username = account.username;
      const outDir = path.resolve(TEMP_DIR, username);
      await fs.ensureDir(outDir);

      // Determine scraping strategy based on account status
      if (account.isNew) {
        totalNewAccounts++;
        this.logger.info(`📥 NEW ACCOUNT: Scraping posts for @${username} (targeting 75 posts)`);
        
        try {
          const posts = await this.scrapeTikTokAccount(username, outDir, account);
          allPosts.push(...posts);
          totalNewPosts += posts.length;
          this.logger.info(`✅ Successfully scraped ${posts.length} posts for new account @${username}`);
        } catch (error) {
          this.logger.error(`❌ Failed to scrape new account @${username}: ${error.message}`);
          continue;
        }
      } else {
        totalExistingAccounts++;
        this.logger.info(`🔄 EXISTING ACCOUNT: Checking for new posts for @${username} (${account.existingPostCount} posts already saved)`);
        
        try {
          const newPosts = await this.scrapeIncrementalPosts(username, outDir, account);
          allPosts.push(...newPosts);
          totalNewPosts += newPosts.length;
          
          if (newPosts.length > 0) {
            this.logger.info(`✅ Found ${newPosts.length} new posts for @${username}`);
          } else {
            this.logger.info(`✅ No new posts found for @${username} - account is up to date`);
          }
        } catch (error) {
          this.logger.error(`❌ Failed to check for new posts @${username}: ${error.message}`);
          continue;
        }
      }
    }

    // Summary statistics
    this.logger.info(`🎉 INCREMENTAL SCRAPING COMPLETE:`);
    this.logger.info(`   📊 Total accounts: ${accounts.length}`);
    this.logger.info(`   🆕 New accounts: ${totalNewAccounts}`);
    this.logger.info(`   🔄 Existing accounts: ${totalExistingAccounts}`);
    this.logger.info(`   🎯 New posts scraped: ${totalNewPosts}`);
    this.logger.info(`   ⚡ Efficiency: Only scraped new content!`);
    
    return allPosts;
  }

  async scrapeIncrementalPosts(username, outDir, account) {
    this.logger.info(`🔍 Incremental scraping for @${username} - checking for posts newer than ${account.latestPostTimestamp || 'never'}`);
    
    // Get existing post IDs to avoid duplicates
    const existingPostIds = await this.db.getExistingPostIds(username);
    this.logger.info(`📋 Found ${existingPostIds.length} existing posts in database for @${username}`);
    
    // For incremental scraping, we'll get the latest posts and filter out existing ones
    const INCREMENTAL_BATCH_SIZE = 25; // Start with recent posts
    const newPosts = [];
    let foundNewContent = true;
    let offset = 0;
    let batchNumber = 1;
    const MAX_INCREMENTAL_BATCHES = 3; // Don't go too far back
    
    while (foundNewContent && batchNumber <= MAX_INCREMENTAL_BATCHES) {
      this.logger.info(`📦 Checking batch ${batchNumber} for new posts (offset: ${offset})`);
      
      try {
        const batchPosts = await this.scrapeBatch(username, outDir, batchNumber, INCREMENTAL_BATCH_SIZE, offset);
        
        // Filter out posts we already have
        const trulyNewPosts = batchPosts.filter(post => !existingPostIds.includes(post.post_id));
        const duplicateCount = batchPosts.length - trulyNewPosts.length;
        
        this.logger.info(`   📊 Batch results: ${batchPosts.length} scraped, ${duplicateCount} duplicates, ${trulyNewPosts.length} new`);
        
        if (trulyNewPosts.length === 0) {
          this.logger.info(`   ✋ No new posts in this batch - stopping incremental scraping`);
          foundNewContent = false;
        } else {
          newPosts.push(...trulyNewPosts);
          
          // If we found fewer new posts than the batch size, we're probably caught up
          if (trulyNewPosts.length < INCREMENTAL_BATCH_SIZE / 2) {
            this.logger.info(`   ✋ Found fewer new posts than expected - likely caught up`);
            foundNewContent = false;
          }
        }
        
        offset += INCREMENTAL_BATCH_SIZE;
        batchNumber++;
        
        // Small delay between batches
        if (foundNewContent && batchNumber <= MAX_INCREMENTAL_BATCHES) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
        
      } catch (error) {
        this.logger.error(`❌ Incremental batch ${batchNumber} failed: ${error.message}`);
        break;
      }
    }
    
    this.logger.info(`✅ Incremental scraping complete for @${username}: ${newPosts.length} new posts found`);
    return newPosts;
  }

  async scrapeTikTokAccount(username, outDir, account) {
    // For new accounts, do full scraping (original logic)
    this.logger.info(`🚀 Starting batch scraping for @${username} - targeting 75 posts`);
    
    const TOTAL_POSTS_TARGET = 75;
    const BATCH_SIZE = 25; // Process 25 posts at a time to avoid memory issues
    const MAX_BATCHES = Math.ceil(TOTAL_POSTS_TARGET / BATCH_SIZE);
    
    let allPosts = [];
    let totalScraped = 0;
    
    for (let batchNum = 1; batchNum <= MAX_BATCHES && totalScraped < TOTAL_POSTS_TARGET; batchNum++) {
      this.logger.info(`📦 Processing batch ${batchNum}/${MAX_BATCHES} for @${username}`);
      
      try {
        const offset = (batchNum - 1) * BATCH_SIZE;
        const batchPosts = await this.scrapeBatch(username, outDir, batchNum, BATCH_SIZE, offset);
        allPosts = allPosts.concat(batchPosts);
        totalScraped += batchPosts.length;
        
        this.logger.info(`✅ Batch ${batchNum} completed: ${batchPosts.length} posts (Total: ${totalScraped}/${TOTAL_POSTS_TARGET})`);
        
        // Add a small delay between batches to be respectful to TikTok/Apify
        if (batchNum < MAX_BATCHES && totalScraped < TOTAL_POSTS_TARGET) {
          this.logger.info(`⏳ Waiting 5 seconds before next batch...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
        
      } catch (error) {
        this.logger.error(`❌ Batch ${batchNum} failed: ${error.message}`);
        // Continue with next batch even if one fails
        continue;
      }
    }
    
    this.logger.info(`🎉 Batch scraping completed for @${username}: ${allPosts.length} total posts`);
    return allPosts;
  }

  async scrapeBatch(username, outDir, batchNum, batchSize, offset = null) {
    // Calculate offset for this batch if not provided
    const calculatedOffset = offset !== null ? offset : (batchNum - 1) * batchSize;
    
    // Prepare input for this batch
    const input = {
      excludePinnedPosts: false,
      profileSorting: "popular",
      profiles: [username],
      proxyCountryCode: "None",
      resultsPerPage: batchSize, // Use batch size (25 posts)
      scrapeRelatedVideos: false,
      shouldDownloadAvatars: false,
      shouldDownloadCovers: false,
      shouldDownloadMusicCovers: false,
      shouldDownloadSlideshowImages: true,
      shouldDownloadSubtitles: false,
      shouldDownloadVideos: true,
      profileScrapeSections: ["videos"],
      searchSection: "",
      maxProfilesPerQuery: 1,
      maxRequestRetries: 2,
      maxConcurrency: 1,
      // Add offset to get different posts in each batch
      offset: calculatedOffset
    };

    try {
      this.logger.info(`📡 Calling Apify actor for batch ${batchNum} (offset: ${calculatedOffset})`);
      
      // Run the Actor and wait for it to finish
      const run = await this.client.actor('clockworks~tiktok-scraper').call(input);
      
      this.logger.info(`✅ Apify run completed for batch ${batchNum} with status: ${run.status}`);
      
      if (run.status !== 'SUCCEEDED') {
        throw new Error(`Apify run failed with status: ${run.status}`);
      }

      // Get the results from the dataset
      this.logger.info(`📥 Fetching results from dataset: ${run.defaultDatasetId}`);
      const { items } = await this.client.dataset(run.defaultDatasetId).listItems();
      
      this.logger.info(`📊 Found ${items.length} posts in batch ${batchNum}`);
      
      // Process the results and download media
      return await this.processApifyResults(items, username, outDir);

    } catch (error) {
      this.logger.error(`❌ Apify scraping failed for batch ${batchNum}: ${error.message}`);
      
      // Provide helpful error messages for common issues
      if (error.message.includes('timeout')) {
        throw new Error(`TikTok scraping timed out for batch ${batchNum}. The account might be private or have no more public posts.`);
      } else if (error.message.includes('rate limit')) {
        throw new Error(`Rate limit exceeded for batch ${batchNum}. Please wait a few minutes before trying again.`);
      } else if (error.message.includes('not found')) {
        throw new Error(`TikTok account @${username} not found or is private.`);
      } else if (error.message.includes('memory limit')) {
        throw new Error(`Apify memory limit exceeded for batch ${batchNum}. Consider reducing batch size.`);
      } else {
        throw new Error(`Apify scraping error for batch ${batchNum}: ${error.message}`);
      }
    }
  }

  async processApifyResults(items, username, outDir) {
    const posts = [];
    
    for (const item of items) {
      try {
        this.logger.info(`🔄 Processing post: ${item.id}`);
        
        const post = await this.processSinglePost(item, username, outDir);
        if (post) {
          posts.push(post);
        }
      } catch (error) {
        this.logger.error(`❌ Failed to process post ${item.id}: ${error.message}`);
        // Continue with other posts even if one fails
        continue;
      }
    }
    
    return posts;
  }

  async processSinglePost(item, username, outDir) {
    const postId = item.id;
    const postDir = path.resolve(outDir, postId);
    await fs.ensureDir(postDir);

    let videoPath = null;
    let imagePaths = [];

    // Debug: Log the structure of the item to understand what we're getting
    this.logger.info(`🔍 Processing post ${postId} - Available fields: ${Object.keys(item).join(', ')}`);

    // Download video if available
    if (item.webVideoUrl) {
      try {
        this.logger.info(`🎥 Downloading video for post ${postId}`);
        videoPath = await this.downloadVideo(item.webVideoUrl, postDir, postId);
      } catch (error) {
        this.logger.error(`❌ Failed to download video for post ${postId}: ${error.message}`);
      }
    }

    // Download slideshow images if available - extract URLs from objects
    let slideshowImages = [];
    if (item.slideshowImageLinks && Array.isArray(item.slideshowImageLinks)) {
      // Extract URLs from objects - try different possible properties
      slideshowImages = item.slideshowImageLinks.map(link => {
        if (typeof link === 'string') {
          return link;
        } else if (link && typeof link === 'object') {
          // Try different possible URL properties
          return link.url || link.downloadLink || link.link || link.src || JSON.stringify(link);
        }
        return null;
      }).filter(url => url && typeof url === 'string');
    } else if (item.imageLinks && Array.isArray(item.imageLinks)) {
      slideshowImages = item.imageLinks;
    }

    if (slideshowImages.length > 0) {
      try {
        this.logger.info(`🖼️ Downloading ${slideshowImages.length} slideshow images for post ${postId}`);
        imagePaths = await this.downloadSlideshowImages(slideshowImages, postDir, postId);
      } catch (error) {
        this.logger.error(`❌ Failed to download slideshow images for post ${postId}: ${error.message}`);
      }
    }

    // If no video and no slideshow images, try to download a single image from various possible sources
    if (!videoPath && imagePaths.length === 0) {
      let singleImageUrl = null;
      
      // Try different possible image URL fields
      if (item.coverUrl) {
        singleImageUrl = item.coverUrl;
      } else if (item.originalCoverUrl) {
        singleImageUrl = item.originalCoverUrl;
      } else if (item.imageLinks && item.imageLinks.length > 0) {
        singleImageUrl = item.imageLinks[0];
      } else if (item.mediaUrls && item.mediaUrls.length > 0) {
        singleImageUrl = item.mediaUrls[0];
      }

      if (singleImageUrl) {
        try {
          this.logger.info(`🖼️ Downloading single image for post ${postId}`);
          const singleImagePath = await this.downloadImage(singleImageUrl, postDir, `${postId}_image`);
          if (singleImagePath) {
            imagePaths.push(singleImagePath);
          }
        } catch (error) {
          this.logger.error(`❌ Failed to download single image for post ${postId}: ${error.message}`);
        }
      }
    }

    // Create post object with all metadata
    const post = {
      username: username,
      post_id: postId,
      post_timestamp: item.createTimeISO || new Date().toISOString(),
      like_count: item.diggCount || 0,
      comment_count: item.commentCount || 0,
      view_count: item.playCount || 0,
      save_count: item.shareCount || 0,
      engagement_rate: this.calculateEngagementRate(item),
      video_path: videoPath,
      image_paths: imagePaths,
      text: item.text || '',
      web_video_url: item.webVideoUrl || null,
      created_at: new Date().toISOString()
    };

    this.logger.info(`✅ Processed post ${postId}: ${imagePaths.length} images, ${videoPath ? '1 video' : 'no video'}`);
    return post;
  }

  async downloadVideo(videoUrl, postDir, postId) {
    const videoPath = path.resolve(postDir, `${postId}.mp4`);
    
    return new Promise((resolve, reject) => {
      // Use more flexible format selection - don't restrict to specific height
      const command = `yt-dlp -f "best" -o "${videoPath}" "${videoUrl}"`;
      
      exec(command, (error, stdout, stderr) => {
        if (error) {
          // Try with even more flexible format if the first attempt fails
          const fallbackCommand = `yt-dlp -f "worst" -o "${videoPath}" "${videoUrl}"`;
          
          exec(fallbackCommand, (fallbackError, fallbackStdout, fallbackStderr) => {
            if (fallbackError) {
              reject(new Error(`yt-dlp failed: ${fallbackError.message}`));
              return;
            }
            
            if (fs.existsSync(videoPath)) {
              resolve(videoPath);
            } else {
              reject(new Error('Video file not found after download'));
            }
          });
          return;
        }
        
        if (fs.existsSync(videoPath)) {
          resolve(videoPath);
        } else {
          reject(new Error('Video file not found after download'));
        }
      });
    });
  }

  async downloadSlideshowImages(imageLinks, postDir, postId) {
    const imagePaths = [];
    
    for (let i = 0; i < imageLinks.length; i++) {
      const imageUrl = imageLinks[i];
      
      if (!this.isValidUrl(imageUrl)) {
        this.logger.info(`⚠️ Skipping invalid image URL: ${imageUrl}`);
        continue;
      }
      
      try {
        const imagePath = await this.downloadImage(imageUrl, postDir, `${postId}_slide_${i + 1}`);
        if (imagePath) {
          imagePaths.push(imagePath);
        }
      } catch (error) {
        this.logger.error(`❌ Failed to download slideshow image ${i + 1}: ${error.message}`);
        // Continue with other images even if one fails
        continue;
      }
    }
    
    return imagePaths;
  }

  async downloadImage(imageUrl, postDir, filename) {
    const imagePath = path.resolve(postDir, `${filename}.jpg`);
    
    // Validate URL before attempting download
    if (!this.isValidUrl(imageUrl)) {
      throw new Error(`Invalid URL: ${imageUrl}`);
    }
    
    try {
      const response = await axios({
        method: 'GET',
        url: imageUrl,
        responseType: 'stream',
        timeout: 30000, // 30 second timeout
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      const writer = fs.createWriteStream(imagePath);
      response.data.pipe(writer);
      
      return new Promise((resolve, reject) => {
        writer.on('finish', () => resolve(imagePath));
        writer.on('error', reject);
      });
    } catch (error) {
      throw new Error(`Failed to download image: ${error.message}`);
    }
  }

  isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }

  calculateEngagementRate(item) {
    const likes = item.diggCount || 0;
    const comments = item.commentCount || 0;
    const shares = item.shareCount || 0;
    const views = item.playCount || 1; // Avoid division by zero
    
    const engagement = likes + comments + shares;
    return (engagement / views * 100).toFixed(2);
  }
}
