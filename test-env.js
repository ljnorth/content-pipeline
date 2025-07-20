import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

console.log('🔍 Environment Variables Check:');
console.log('================================');
console.log(`SUPABASE_URL: ${process.env.SUPABASE_URL ? '✓ Set' : '✗ Missing'}`);
console.log(`SUPABASE_ANON_KEY: ${process.env.SUPABASE_ANON_KEY ? '✓ Set' : '✗ Missing'}`);
console.log(`SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓ Set' : '✗ Missing'}`);

if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log(`Service Role Key (first 20 chars): ${process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 20)}...`);
}

// Test storage initialization
try {
  const { SupabaseStorage } = await import('./src/utils/supabase-storage.js');
  const storage = new SupabaseStorage();
  console.log('✅ Storage initialized successfully');
} catch (error) {
  console.log('❌ Storage initialization failed:', error.message);
} 