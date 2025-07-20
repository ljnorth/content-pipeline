import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
  throw new Error(`Missing Supabase credentials:
    - SUPABASE_URL: ${supabaseUrl ? '✓' : '✗'}
    - SUPABASE_ANON_KEY: ${supabaseAnonKey ? '✓' : '✗'}
    - SUPABASE_SERVICE_ROLE_KEY: ${supabaseServiceRoleKey ? '✓' : '✗'}
  `);
}

// Create two clients - one for public access, one for admin operations
const supabase = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = supabaseServiceRoleKey ? createClient(supabaseUrl, supabaseServiceRoleKey) : null;

export class SupabaseStorage {
  constructor() {
    this.bucketName = 'fashion-images';
    // Use admin client for uploads if available, otherwise fall back to anon
    this.uploadClient = supabaseAdmin || supabase;
    this.publicClient = supabase;
  }

  /**
   * Upload an image file to Supabase Storage
   * @param {string} localFilePath - Path to the local image file
   * @param {string} username - Username for organizing files
   * @param {string} postId - Post ID for organizing files
   * @param {string} filename - Original filename
   * @returns {Promise<{publicUrl: string, storagePath: string}>}
   */
  async uploadImage(localFilePath, username, postId, filename) {
    try {
      // Check if file exists
      if (!fs.existsSync(localFilePath)) {
        throw new Error(`File not found: ${localFilePath}`);
      }

      // Create organized path: username/postId/filename
      const storagePath = `${username}/${postId}/${filename}`;

      // Read the file
      const fileBuffer = fs.readFileSync(localFilePath);

      // Determine content type based on file extension
      const ext = path.extname(filename).toLowerCase();
      const contentTypeMap = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
        '.gif': 'image/gif'
      };
      const contentType = contentTypeMap[ext] || 'image/jpeg';

      // Upload to Supabase Storage using admin client (bypasses RLS)
      const { data, error } = await this.uploadClient.storage
        .from(this.bucketName)
        .upload(storagePath, fileBuffer, {
          contentType,
          upsert: true // Replace if exists
        });

      if (error) {
        throw error;
      }

      // Get public URL using public client
      const { data: urlData } = this.publicClient.storage
        .from(this.bucketName)
        .getPublicUrl(storagePath);

      return {
        publicUrl: urlData.publicUrl,
        storagePath: storagePath
      };

    } catch (error) {
      console.error(`Error uploading image ${filename}:`, error.message);
      throw error;
    }
  }

  /**
   * Upload multiple images from a directory
   * @param {string} directoryPath - Path to directory containing images
   * @param {string} username - Username for organizing files
   * @param {string} postId - Post ID for organizing files
   * @returns {Promise<Array<{filename: string, publicUrl: string, storagePath: string}>>}
   */
  async uploadImagesFromDirectory(directoryPath, username, postId) {
    try {
      if (!fs.existsSync(directoryPath)) {
        throw new Error(`Directory not found: ${directoryPath}`);
      }

      const files = fs.readdirSync(directoryPath);
      const imageFiles = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext);
      });

      const uploadResults = [];

      for (const filename of imageFiles) {
        const filePath = path.join(directoryPath, filename);
        try {
          const result = await this.uploadImage(filePath, username, postId, filename);
          uploadResults.push({
            filename,
            ...result
          });
          console.log(`✅ Uploaded: ${filename} -> ${result.publicUrl}`);
        } catch (error) {
          console.error(`❌ Failed to upload ${filename}:`, error.message);
          // Continue with other files
        }
      }

      return uploadResults;
    } catch (error) {
      console.error(`Error uploading images from directory ${directoryPath}:`, error.message);
      throw error;
    }
  }

  /**
   * Get public URL for an existing file
   * @param {string} storagePath - Path to file in storage
   * @returns {string} Public URL
   */
  getPublicUrl(storagePath) {
    const { data } = this.publicClient.storage
      .from(this.bucketName)
      .getPublicUrl(storagePath);
    return data.publicUrl;
  }

  /**
   * Delete an image from storage
   * @param {string} storagePath - Path to file in storage
   * @returns {Promise<void>}
   */
  async deleteImage(storagePath) {
    const { error } = await this.uploadClient.storage
      .from(this.bucketName)
      .remove([storagePath]);
    
    if (error) {
      throw error;
    }
  }

  /**
   * List all files in a directory
   * @param {string} directoryPath - Directory path in storage
   * @returns {Promise<Array>} List of files
   */
  async listFiles(directoryPath = '') {
    const { data, error } = await this.uploadClient.storage
      .from(this.bucketName)
      .list(directoryPath);
    
    if (error) {
      throw error;
    }
    
    return data;
  }
} 