import { SupabaseClient } from '../database/supabase-client.js';
import { Logger } from '../utils/logger.js';

export class InputProcessor {
  constructor() {
    this.logger = new Logger();
    this.db = new SupabaseClient();
  }

  // Return all tracked accounts straight from Supabase
  async process() {
    try {
      const accounts = await this.db.getAllAccounts();
      this.logger.info(`Found ${accounts.length} accounts in database`);
      return accounts;
    } catch (error) {
      this.logger.error(`Failed to get accounts from database: ${error.message}`);
      return [];
    }
  }
}
