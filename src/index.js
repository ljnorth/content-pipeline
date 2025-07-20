import dotenv from 'dotenv';
import { Logger } from './utils/logger.js';

dotenv.config();
const logger = new Logger();

// Only start the web server - pipeline will be controlled via web interface
logger.info('🚀 Starting Fashion Data Pipeline Web Interface');
logger.info('📝 Pipeline will only run when triggered via web interface');

// Import and start the web server
import('./web/server.js').catch(err => {
  logger.error(`Web server failed to start: ${err.message}`);
  process.exit(1);
}); 