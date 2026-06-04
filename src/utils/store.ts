import { BackupInfo } from '../types/index.js';
import { config } from './config.js';
import { loadBackupMetadata, saveBackupMetadata } from './persistence.js';
import { log } from './logger.js';

/** In-memory backup store backed by persistent metadata. Extends Map with auto-save and dirty tracking. */
export class BackupStore extends Map<string, BackupInfo> {
  private dirty = false;
  private saveInterval: ReturnType<typeof setInterval> | null = null;
  public readonly loadError?: string;

  private constructor(loadError?: string) {
    super();
    this.loadError = loadError;
  }

  /** Creates and initializes a BackupStore by loading persisted metadata. */
  static async create(): Promise<BackupStore> {
    const { backups: loaded, integrityWarning, loadError } = await loadBackupMetadata();
    const store = new BackupStore(loadError);
    for (const [key, value] of loaded.entries()) {
      super.prototype.set.call(store, key, value);
    }
    if (integrityWarning) {
      log.warn('store', integrityWarning);
    }
    return store;
  }

  /** Sets a backup entry and marks the store as dirty. */
  override set(id: string, info: BackupInfo): this {
    super.set(id, info);
    this.dirty = true;
    return this;
  }

  /** Deletes a backup entry and marks the store as dirty if the entry existed. */
  override delete(id: string): boolean {
    const result = super.delete(id);
    if (result) this.dirty = true;
    return result;
  }

  /** Persists dirty metadata to disk. */
  async save(): Promise<void> {
    if (this.dirty) {
      await saveBackupMetadata(this);
      this.dirty = false;
    }
  }

  /** Starts periodic auto-save at the given interval. */
  startAutoSave(intervalMs = config.autoSaveIntervalMs): void {
    this.stopAutoSave();
    this.saveInterval = setInterval(() => {
      this.save().catch(err => log.error('store', 'Auto-save failed', { error: String(err) }));
    }, intervalMs);
  }

  /** Stops the periodic auto-save. */
  stopAutoSave(): void {
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
      this.saveInterval = null;
    }
  }
}