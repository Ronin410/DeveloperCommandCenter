import 'server-only';
import { getContainer } from '@/services/container';
import type { DatabaseDeepStats, DatabaseStats } from '@/types/domain';

/**
 * DatabaseService (spec §13). Exposes aggregate health only — connection
 * strings, credentials and secrets are never part of this payload.
 */
export class DatabaseService {
  private get container() {
    return getContainer();
  }

  async getStats(): Promise<DatabaseStats> {
    return this.container.database.read();
  }

  /** Table sizes, slow queries and WAL archiving status (spec §13 "deep metrics"). */
  async getDeepStats(): Promise<DatabaseDeepStats> {
    return this.container.database.readDeep();
  }
}

export const databaseService = new DatabaseService();
