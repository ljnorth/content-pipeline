import { SupabaseClient } from '../database/supabase-client.js';
import { Logger } from '../utils/logger.js';

export class AccountProcessor {
  constructor() {
    this.logger = new Logger();
    this.db = new SupabaseClient();
  }

  async process(accounts) {
    this.logger.info('Checking Supabase for existing accounts...');
    const tasks = [];

    for (const account of accounts) {
      const existing = await this.db.getAccount(account.username);
      
      if (!existing) {
        this.logger.info(`🆕 New account: ${account.username}`);
        tasks.push({ 
          ...account, 
          isNew: true, 
          lastScraped: null,
          existingPostCount: 0,
          latestPostTimestamp: null
        });
      } else {
        // Get additional info for existing accounts
        const existingPostCount = await this.db.getPostCount(account.username);
        const latestPostTimestamp = await this.db.getLatestPostTimestamp(account.username);
        
        this.logger.info(`🔄 Existing account: ${account.username} (${existingPostCount} posts, last scraped: ${existing.last_scraped ? new Date(existing.last_scraped).toLocaleDateString() : 'never'})`);
        
        tasks.push({ 
          ...account, 
          isNew: false, 
          lastScraped: existing.last_scraped,
          existingPostCount,
          latestPostTimestamp
        });
      }
    }

    return tasks;
  }
} 