import path from 'path';
import fs from 'fs-extra';
import { Logger } from '../utils/logger.js';
import { exec } from 'child_process';

export class ImageProcessor {
  constructor() {
    this.logger = new Logger();
  }

  async process(posts) {
    const images = [];
    
    for (const post of posts) {
      // First, check if we have slideshow images already downloaded
      if (post.image_paths && post.image_paths.length > 0) {
        this.logger.info(`🖼️ Using ${post.image_paths.length} existing slideshow images for post ${post.post_id}`);
        
        // Add each existing slideshow image to the list
        for (const imagePath of post.image_paths) {
          if (await fs.pathExists(imagePath)) {
            images.push({
              username: post.username,
              postId: post.post_id,
              imagePath,
              metadata: post
            });
          } else {
            this.logger.warn(`⚠️ Image file not found: ${imagePath}`);
          }
        }
        
        this.logger.info(`✅ Added ${post.image_paths.length} slideshow images from post ${post.post_id}`);
        continue; // Skip video processing if we have slideshow images
      }
      
      // If no slideshow images, try to extract frames from video
      const videoPath = post.video_path;
      if (!videoPath || !await fs.pathExists(videoPath)) {
        this.logger.info(`⚠️ No video file for post ${post.post_id}`);
        continue;
      }

      // Check if file is actually a video (not audio-only)
      const isVideo = await this.isVideoFile(videoPath);
      if (!isVideo) {
        this.logger.info(`⚠️ Skipping audio-only file for post ${post.post_id}`);
        continue;
      }

      this.logger.info(`🖼️ Extracting images from video: ${post.post_id}`);
      
      try {
        // Extract individual images from the video
        const extractedImages = await this.extractImagesFromVideo(videoPath, post.post_id, post.username);
        
        // Add each extracted image to the list
        for (const imagePath of extractedImages) {
          images.push({
            username: post.username,
            postId: post.post_id,
            imagePath,
            metadata: post
          });
        }
        
        this.logger.info(`✅ Extracted ${extractedImages.length} images from post ${post.post_id}`);
      } catch (err) {
        this.logger.error(`❌ Failed to extract images from post ${post.post_id}: ${err.message}`);
        continue;
      }
    }
    
    this.logger.info(`📊 Prepared ${images.length} total images for AI analysis`);
    return images;
  }

  async isVideoFile(filePath) {
    try {
      const cmd = `ffprobe -v quiet -print_format json -show_streams "${filePath}"`;
      const result = await new Promise((resolve, reject) => {
        exec(cmd, (error, stdout, stderr) => {
          if (error) reject(error);
          else resolve(stdout);
        });
      });
      
      const data = JSON.parse(result);
      return data.streams.some(stream => stream.codec_type === 'video');
    } catch (err) {
      this.logger.error(`❌ Error checking video file ${filePath}: ${err.message}`);
      return false;
    }
  }

  async extractImagesFromVideo(videoPath, postId, username) {
    const outDir = path.dirname(videoPath);
    const imagePrefix = path.join(outDir, `${postId}_frame`);
    
    try {
      // Use ffmpeg to extract frames from the video
      // Extract 1 frame per second, but limit to max 10 frames per video
      const cmd = `ffmpeg -i "${videoPath}" -vf "fps=1,select=not(mod(n\\,10))" -vframes 10 "${imagePrefix}_%03d.jpg" -y`;
      
      await new Promise((resolve, reject) => {
        exec(cmd, (error, stdout, stderr) => {
          if (error) {
            this.logger.error(`❌ ffmpeg failed: ${error.message}`);
            reject(error);
          } else {
            resolve();
          }
        });
      });
      
      // Find all extracted image files
      const files = await fs.readdir(outDir);
      const imageFiles = files.filter(f => f.startsWith(`${postId}_frame_`) && f.endsWith('.jpg'));
      
      // Return full paths to extracted images
      return imageFiles.map(file => path.join(outDir, file));
      
    } catch (err) {
      this.logger.error(`❌ Failed to extract images from video ${postId}: ${err.message}`);
      return [];
    }
  }
}
