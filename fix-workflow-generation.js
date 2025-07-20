#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fixWorkflowGeneration() {
  console.log('🔧 Fixing workflow generation endpoint...');
  
  const apiIndexPath = path.join(__dirname, 'api', 'index.js');
  
  try {
    // Read the current file
    let content = fs.readFileSync(apiIndexPath, 'utf8');
    
    console.log('📖 Reading api/index.js...');
    
    // Find the problematic section (placeholder image generation)
    const placeholderStart = content.indexOf('// For now, create simple posts without requiring background color analysis');
    const placeholderEnd = content.indexOf('if (posts.length === 0) {', placeholderStart);
    
    if (placeholderStart === -1 || placeholderEnd === -1) {
      console.log('❌ Could not find placeholder image generation section');
      return;
    }
    
    console.log('🎯 Found placeholder image generation section...');
    
    // Create the replacement code
    const replacementCode = `// Generate content using ContentGenerator (REAL images from database)
    const { ContentGenerator } = await import('../src/automation/content-generator.js');
    const contentGenerator = new ContentGenerator();
    
    const posts = [];
    const allImages = [];
    
    for (let i = 1; i <= postCount; i++) {
      try {
        const post = await contentGenerator.generateSinglePost(profile, profile, i);
        posts.push(post);
        allImages.push(...post.images);
      } catch (error) {
        console.error(\`Failed to generate post \${i}: \${error.message}\`);
        // Continue with other posts
      }
    }`;
    
    // Replace the problematic section
    const beforeSection = content.substring(0, placeholderStart);
    const afterSection = content.substring(placeholderEnd);
    
    const newContent = beforeSection + replacementCode + '\n    \n    ' + afterSection;
    
    // Write the fixed content back to the file
    fs.writeFileSync(apiIndexPath, newContent, 'utf8');
    
    console.log('✅ Successfully fixed workflow generation endpoint!');
    console.log('🔄 The endpoint now uses real database images instead of placeholder images');
    console.log('📝 Changes made:');
    console.log('   - Removed placeholder image generation with picsum.photos');
    console.log('   - Added real ContentGenerator with database image queries');
    console.log('   - Now uses account strategy to curate real images');
    
    console.log('\n🚀 Next steps:');
    console.log('   1. Restart your web server: npm run web');
    console.log('   2. Test the workflow generation');
    console.log('   3. Deploy to Vercel: git add . && git commit -m "Fix workflow generation to use real images" && git push');
    
  } catch (error) {
    console.error('❌ Error fixing workflow generation:', error.message);
  }
}

// Run the fix
fixWorkflowGeneration(); 