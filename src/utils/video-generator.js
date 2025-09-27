import { Logger } from './logger.js';
import fs from 'fs-extra';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class VideoGenerator {
  constructor() {
    this.logger = new Logger();
    this.tempDir = process.env.TEMP_DIR || 'temp';
  }

  /**
   * Create a slideshow video from multiple images
   */
  async createSlideshowVideo(images, options = {}) {
    const {
      duration = 3, // seconds per image
      fps = 30,
      width = 1080,
      height = 1920, // TikTok vertical format
      outputFormat = 'mp4',
      transition = 'fade' // fade, slide, none
    } = options;

    this.logger.info(`🎬 Creating slideshow video from ${images.length} images...`);
    
    try {
      // Step 1: Download all images to temp directory
      const imagePaths = await this.downloadImages(images);
      
      // Step 2: Create video using FFmpeg
      const videoPath = await this.generateVideoWithFFmpeg(imagePaths, {
        duration,
        fps,
        width,
        height,
        outputFormat,
        transition
      });
      
      // Step 3: Read video file into buffer
      const videoBuffer = await fs.readFile(videoPath);
      
      // Step 4: Clean up temp files
      await this.cleanupTempFiles(imagePaths, videoPath);
      
      this.logger.info(`✅ Slideshow video created successfully (${videoBuffer.length} bytes)`);
      
      return {
        buffer: videoBuffer,
        size: videoBuffer.length,
        filename: `slideshow_${Date.now()}.${outputFormat}`,
        duration: images.length * duration,
        dimensions: { width, height }
      };
      
    } catch (error) {
      this.logger.error(`❌ Failed to create slideshow video: ${error.message}`);
      throw error;
    }
  }

  /**
   * Download images to temp directory
   */
  async downloadImages(images) {
    const imagePaths = [];
    const tempDir = path.join(this.tempDir, 'video_generation', Date.now().toString());
    
    await fs.ensureDir(tempDir);
    
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      const imagePath = path.join(tempDir, `image_${i}.jpg`);
      
      try {
        // Download image from URL or path
        const imageBuffer = await this.downloadImage(image.imagePath || image.url);
        await fs.writeFile(imagePath, Buffer.from(imageBuffer));
        imagePaths.push(imagePath);
        
        this.logger.info(`📥 Downloaded image ${i + 1}/${images.length}`);
      } catch (error) {
        this.logger.error(`Failed to download image ${i}: ${error.message}`);
        throw error;
      }
    }
    
    return imagePaths;
  }

  /**
   * Download image from URL or path
   */
  async downloadImage(imagePath) {
    try {
      const response = await fetch(imagePath);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
      }
      return await response.arrayBuffer();
    } catch (error) {
      throw new Error(`Image download failed: ${error.message}`);
    }
  }

  /**
   * Generate video using FFmpeg
   */
  async generateVideoWithFFmpeg(imagePaths, options) {
    const { duration, fps, width, height, outputFormat, transition } = options;
    
    const outputPath = path.join(this.tempDir, 'video_generation', `slideshow_${Date.now()}.${outputFormat}`);
    await fs.ensureDir(path.dirname(outputPath));
    
    // Create FFmpeg command for slideshow
    const ffmpegCommand = this.buildFFmpegCommand(imagePaths, outputPath, options);
    
    this.logger.info(`🎥 Running FFmpeg command: ${ffmpegCommand}`);
    
    try {
      const { stdout, stderr } = await execAsync(ffmpegCommand);
      
      if (stderr && !stderr.includes('frame=')) {
        this.logger.warn(`FFmpeg stderr: ${stderr}`);
      }
      
      // Check if output file exists
      if (!await fs.pathExists(outputPath)) {
        throw new Error('FFmpeg did not create output file');
      }
      
      return outputPath;
      
    } catch (error) {
      this.logger.error(`FFmpeg error: ${error.message}`);
      throw new Error(`Video generation failed: ${error.message}`);
    }
  }

  /**
   * Build FFmpeg command for slideshow creation
   */
  buildFFmpegCommand(imagePaths, outputPath, options) {
    const { duration, fps, width, height, outputFormat, transition } = options;
    
    // Create input file list with absolute paths
    const inputListPath = path.resolve(path.dirname(outputPath), 'input_list.txt');
    const inputList = imagePaths.map(imgPath => `file '${path.resolve(imgPath)}'\nduration ${duration}`).join('\n');
    fs.writeFileSync(inputListPath, inputList);
    
    // Base FFmpeg command with absolute paths
    let command = `ffmpeg -y -f concat -safe 0 -i "${inputListPath}"`;
    
    // Add video filters
    const filters = [
      `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`,
      `fps=${fps}`
    ];
    
    if (transition === 'fade') {
      // Add fade in/out effects
      filters.push('fade=t=in:st=0:d=0.5,fade=t=out:st=2.5:d=0.5');
    }
    
    command += ` -vf "${filters.join(',')}"`;
    
    // Add output options with absolute path
    command += ` -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p "${path.resolve(outputPath)}"`;
    
    return command;
  }

  async createMemeClipSingleImage({ imageUrl, caption, audioUrl, width=1080, height=1920, fps=30, duration=8, fadeSec=2, fontFile='public/assets/Inter-Bold.ttf', watermark='' }){
    this.logger.info('🎬 Creating meme clip');
    const tempDir = path.join(this.tempDir, 'meme', Date.now().toString());
    await fs.ensureDir(tempDir);
    const imgPath = path.join(tempDir, 'img.jpg');
    const audPath = path.join(tempDir, 'aud.mp3');
    const outPath = path.join(tempDir, 'meme.mp4');
    const imgBuf = await this.downloadImage(imageUrl);
    await fs.writeFile(imgPath, Buffer.from(imgBuf));
    try {
      const r = await fetch(audioUrl); if (!r.ok) throw new Error('audio fetch failed');
      const ab = await r.arrayBuffer(); await fs.writeFile(audPath, Buffer.from(ab));
    } catch(e){ throw new Error('Audio download failed: '+e.message); }

    const textEsc = String(caption||'').replace(/:/g,'\\:').replace(/"/g,'\"');
    const wmEsc = String(watermark||'').replace(/:/g,'\\:').replace(/"/g,'\"');
    const fadeIn = fadeSec; const fadeOutStart = duration - fadeSec;
    const vf = [
      `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`,
      `fade=t=in:st=0:d=${fadeIn}`,
      `fade=t=out:st=${fadeOutStart}:d=${fadeSec}`,
      `drawbox=x=0:y=0:w=iw:h=220:color=white@1:t=fill`,
      `drawtext=fontfile='${path.resolve(fontFile)}':text='${textEsc}':x=(w-text_w)/2:y=60:fontsize=56:fontcolor=black:line_spacing=8:box=0`,
      wmEsc?`drawtext=fontfile='${path.resolve(fontFile)}':text='${wmEsc}':x=w-text_w-40:y=h-text_h-40:fontsize=30:fontcolor=white:shadowx=2:shadowy=2`:null
    ].filter(Boolean).join(',');

    const af = `afade=t=in:st=0:d=${fadeIn},afade=t=out:st=${fadeOutStart}:d=${fadeSec},atrim=0:${duration},asetpts=N/SR/TB`;

    const cmd = `ffmpeg -y -loop 1 -t ${duration} -i "${imgPath}" -i "${audPath}" -vf "${vf}" -af "${af}" -r ${fps} -c:v libx264 -preset fast -crf 22 -pix_fmt yuv420p -t ${duration} "${outPath}"`;
    this.logger.info('FFmpeg:', cmd);
    const { stderr } = await execAsync(cmd);
    if (stderr && !stderr.includes('frame=')) this.logger.warn(stderr);
    if (!await fs.pathExists(outPath)) throw new Error('ffmpeg failed to create output');
    const buf = await fs.readFile(outPath);
    return { buffer: buf, size: buf.length, filename: `meme_${Date.now()}.mp4`, duration, dimensions: { width, height }, videoUrl: null };
  }

  /**
   * Clean up temporary files
   */
  async cleanupTempFiles(imagePaths, videoPath) {
    try {
      // Remove image files
      for (const imagePath of imagePaths) {
        await fs.remove(imagePath);
      }
      
      // Remove input list file
      const inputListPath = path.join(path.dirname(videoPath), 'input_list.txt');
      await fs.remove(inputListPath);
      
      // Remove video file (optional - you might want to keep it for debugging)
      // await fs.remove(videoPath);
      
      this.logger.info('🧹 Cleaned up temporary files');
    } catch (error) {
      this.logger.warn(`Failed to cleanup temp files: ${error.message}`);
    }
  }

  /**
   * Check if FFmpeg is available
   */
  async checkFFmpegAvailability() {
    try {
      const { stdout } = await execAsync('ffmpeg -version');
      this.logger.info('✅ FFmpeg is available');
      return true;
    } catch (error) {
      this.logger.error('FFmpeg not found - install ffmpeg on the server.');
      throw new Error('FFmpeg not found');
    }
  }

  /**
   * Fallback method for video generation (web-based)
   */
  async createSlideshowVideoFallback() {
    throw new Error('Fallback video generation is disabled in production');
  }

  /**
   * Generate real video using actual video generation
   */
  async generateRealVideo(images, options) {
    const { duration, width, height } = options;
    
    try {
      // For production, integrate with real video generation service like:
      // - Remotion (https://remotion.dev)
      // - Bannerbear API
      // - Canva API
      // - Custom FFmpeg integration
      
      // For now, throw error to indicate real implementation needed
      throw new Error('Real video generation service not yet integrated. Please use image carousel uploads instead.');
      
    } catch (error) {
      this.logger.error('Video generation failed:', error.message);
      throw new Error(`Video generation failed: ${error.message}`);
    }
  }
} 