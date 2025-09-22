import type { ComprehensiveSettings, SettingsExport } from '$lib/types/settings';
import { settingsValidation } from './settings-validation';

// Storage keys
const STORAGE_KEYS = {
	SETTINGS: 'aura-comprehensive-settings',
	BACKUP: 'aura-settings-backup',
	SYNC_TIMESTAMP: 'aura-settings-sync-timestamp',
	VERSION: 'aura-settings-version'
} as const;

// Current settings version for migration
const CURRENT_VERSION = '1.0.0';

// Storage interface for different persistence mechanisms
interface SettingsStorage {
	get(key: string): Promise<string | null>;
	set(key: string, value: string): Promise<void>;
	remove(key: string): Promise<void>;
	clear(): Promise<void>;
}

// Local storage implementation
class LocalStorageAdapter implements SettingsStorage {
	async get(key: string): Promise<string | null> {
		if (typeof window === 'undefined') return null;
		return localStorage.getItem(key);
	}

	async set(key: string, value: string): Promise<void> {
		if (typeof window === 'undefined') return;
		localStorage.setItem(key, value);
	}

	async remove(key: string): Promise<void> {
		if (typeof window === 'undefined') return;
		localStorage.removeItem(key);
	}

	async clear(): Promise<void> {
		if (typeof window === 'undefined') return;
		Object.values(STORAGE_KEYS).forEach((key) => {
			localStorage.removeItem(key);
		});
	}
}

// IndexedDB implementation for larger data
class IndexedDBAdapter implements SettingsStorage {
	private dbName = 'AuraSettings';
	private version = 1;
	private storeName = 'settings';

	private async getDB(): Promise<IDBDatabase> {
		return new Promise((resolve, reject) => {
			const request = indexedDB.open(this.dbName, this.version);

			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve(request.result);

			request.onupgradeneeded = (event) => {
				const db = (event.target as IDBOpenDBRequest).result;
				if (!db.objectStoreNames.contains(this.storeName)) {
					db.createObjectStore(this.storeName);
				}
			};
		});
	}

	async get(key: string): Promise<string | null> {
		if (typeof window === 'undefined') return null;

		try {
			const db = await this.getDB();
			const transaction = db.transaction([this.storeName], 'readonly');
			const store = transaction.objectStore(this.storeName);

			return new Promise((resolve, reject) => {
				const request = store.get(key);
				request.onerror = () => reject(request.error);
				request.onsuccess = () => resolve(request.result || null);
			});
		} catch (error) {
			console.error('IndexedDB get error:', error);
			return null;
		}
	}

	async set(key: string, value: string): Promise<void> {
		if (typeof window === 'undefined') return;

		try {
			const db = await this.getDB();
			const transaction = db.transaction([this.storeName], 'readwrite');
			const store = transaction.objectStore(this.storeName);

			return new Promise((resolve, reject) => {
				const request = store.put(value, key);
				request.onerror = () => reject(request.error);
				request.onsuccess = () => resolve();
			});
		} catch (error) {
			console.error('IndexedDB set error:', error);
		}
	}

	async remove(key: string): Promise<void> {
		if (typeof window === 'undefined') return;

		try {
			const db = await this.getDB();
			const transaction = db.transaction([this.storeName], 'readwrite');
			const store = transaction.objectStore(this.storeName);

			return new Promise((resolve, reject) => {
				const request = store.delete(key);
				request.onerror = () => reject(request.error);
				request.onsuccess = () => resolve();
			});
		} catch (error) {
			console.error('IndexedDB remove error:', error);
		}
	}

	async clear(): Promise<void> {
		if (typeof window === 'undefined') return;

		try {
			const db = await this.getDB();
			const transaction = db.transaction([this.storeName], 'readwrite');
			const store = transaction.objectStore(this.storeName);

			return new Promise((resolve, reject) => {
				const request = store.clear();
				request.onerror = () => reject(request.error);
				request.onsuccess = () => resolve();
			});
		} catch (error) {
			console.error('IndexedDB clear error:', error);
		}
	}
}

// Settings synchronization manager
export class SettingsSync {
	private storage: SettingsStorage;
	private syncInProgress = false;
	private syncCallbacks: Array<(settings: ComprehensiveSettings) => void> = [];

	constructor(useIndexedDB = false) {
		this.storage = useIndexedDB ? new IndexedDBAdapter() : new LocalStorageAdapter();
	}

	// Subscribe to settings changes
	onSync(callback: (settings: ComprehensiveSettings) => void): () => void {
		this.syncCallbacks.push(callback);

		// Return unsubscribe function
		return () => {
			const index = this.syncCallbacks.indexOf(callback);
			if (index > -1) {
				this.syncCallbacks.splice(index, 1);
			}
		};
	}

	// Notify subscribers of settings changes
	private notifySubscribers(settings: ComprehensiveSettings): void {
		this.syncCallbacks.forEach((callback) => {
			try {
				callback(settings);
			} catch (error) {
				console.error('Settings sync callback error:', error);
			}
		});
	}

	// Save settings with validation and backup
	async saveSettings(settings: ComprehensiveSettings): Promise<boolean> {
		if (this.syncInProgress) return false;

		this.syncInProgress = true;

		try {
			// Validate settings before saving
			const validationResult = settingsValidation.validateAllSettings(settings);
			if (!validationResult.isValid) {
				console.warn('Settings validation failed:', validationResult.errors);
				// Sanitize settings to fix validation errors
				settings = settingsValidation.sanitizeSettings(settings);
			}

			// Create backup of current settings
			await this.createBackup();

			// Save settings with metadata
			const settingsData = {
				version: CURRENT_VERSION,
				timestamp: new Date().toISOString(),
				settings
			};

			await this.storage.set(STORAGE_KEYS.SETTINGS, JSON.stringify(settingsData));
			await this.storage.set(STORAGE_KEYS.SYNC_TIMESTAMP, Date.now().toString());

			// Notify subscribers
			this.notifySubscribers(settings);

			return true;
		} catch (error) {
			console.error('Failed to save settings:', error);
			return false;
		} finally {
			this.syncInProgress = false;
		}
	}

	// Load settings with migration support
	async loadSettings(defaultSettings: ComprehensiveSettings): Promise<ComprehensiveSettings> {
		try {
			const settingsData = await this.storage.get(STORAGE_KEYS.SETTINGS);

			if (!settingsData) {
				return defaultSettings;
			}

			const parsed = JSON.parse(settingsData);

			// Handle version migration
			const migratedSettings = await this.migrateSettings(parsed, defaultSettings);

			// Validate loaded settings
			const validationResult = settingsValidation.validateAllSettings(migratedSettings);
			if (!validationResult.isValid) {
				console.warn('Loaded settings validation failed, using sanitized version');
				return settingsValidation.sanitizeSettings(migratedSettings);
			}

			return migratedSettings;
		} catch (error) {
			console.error('Failed to load settings:', error);
			return defaultSettings;
		}
	}

	// Migrate settings from older versions
	private async migrateSettings(
		savedData: any,
		defaultSettings: ComprehensiveSettings
	): Promise<ComprehensiveSettings> {
		// If no version info, assume it's the old format
		if (!savedData.version) {
			return this.migrateLegacySettings(savedData, defaultSettings);
		}

		// Handle version-specific migrations
		switch (savedData.version) {
			case '1.0.0':
				return { ...defaultSettings, ...savedData.settings };
			default:
				console.warn(`Unknown settings version: ${savedData.version}`);
				return defaultSettings;
		}
	}

	// Migrate from legacy settings format
	private migrateLegacySettings(
		legacySettings: any,
		defaultSettings: ComprehensiveSettings
	): ComprehensiveSettings {
		const migrated = { ...defaultSettings };

		// Map legacy settings to new structure
		if (legacySettings.theme) {
			migrated.appearance.theme = legacySettings.theme;
		}

		if (legacySettings.fontSize) {
			migrated.appearance.fontSize = legacySettings.fontSize;
			migrated.editor.fontSize = legacySettings.fontSize;
		}

		if (legacySettings.fontFamily) {
			migrated.appearance.fontFamily = legacySettings.fontFamily;
		}

		if (legacySettings.tabSize) {
			migrated.editor.tabSize = legacySettings.tabSize;
		}

		if (legacySettings.autoSave !== undefined) {
			migrated.editor.autoSave = legacySettings.autoSave;
		}

		if (legacySettings.vim !== undefined) {
			migrated.keyboard.keyMap = legacySettings.vim ? 'vim' : 'default';
		}

		return migrated;
	}

	// Create backup of current settings
	private async createBackup(): Promise<void> {
		try {
			const currentSettings = await this.storage.get(STORAGE_KEYS.SETTINGS);
			if (currentSettings) {
				const backup = {
					timestamp: new Date().toISOString(),
					settings: currentSettings
				};
				await this.storage.set(STORAGE_KEYS.BACKUP, JSON.stringify(backup));
			}
		} catch (error) {
			console.error('Failed to create settings backup:', error);
		}
	}

	// Restore from backup
	async restoreFromBackup(): Promise<ComprehensiveSettings | null> {
		try {
			const backupData = await this.storage.get(STORAGE_KEYS.BACKUP);
			if (!backupData) return null;

			const backup = JSON.parse(backupData);
			const settingsData = JSON.parse(backup.settings);

			return settingsData.settings || settingsData;
		} catch (error) {
			console.error('Failed to restore from backup:', error);
			return null;
		}
	}

	// Export settings for sharing/backup
	async exportSettings(includeMetadata = true): Promise<SettingsExport | null> {
		try {
			const settingsData = await this.storage.get(STORAGE_KEYS.SETTINGS);
			if (!settingsData) return null;

			const parsed = JSON.parse(settingsData);

			return {
				version: CURRENT_VERSION,
				timestamp: new Date().toISOString(),
				settings: parsed.settings || parsed,
				metadata: includeMetadata
					? {
							exportedBy: 'Aura IDE Settings Sync',
							originalTimestamp: parsed.timestamp,
							platform: navigator.platform,
							userAgent: navigator.userAgent
						}
					: {
							exportedBy: 'Aura IDE'
						}
			};
		} catch (error) {
			console.error('Failed to export settings:', error);
			return null;
		}
	}

	// Import settings from export
	async importSettings(
		settingsExport: SettingsExport,
		defaultSettings: ComprehensiveSettings
	): Promise<{ success: boolean; settings?: ComprehensiveSettings; error?: string }> {
		try {
			// Validate export format
			if (!settingsExport.settings) {
				return { success: false, error: 'Invalid settings export format' };
			}

			// Merge with defaults to ensure all required fields exist
			const mergedSettings = { ...defaultSettings, ...settingsExport.settings };

			// Validate merged settings
			const validationResult = settingsValidation.validateAllSettings(mergedSettings);
			if (!validationResult.isValid) {
				console.warn('Imported settings validation failed, sanitizing...');
				const sanitizedSettings = settingsValidation.sanitizeSettings(mergedSettings);

				// Save sanitized settings
				const success = await this.saveSettings(sanitizedSettings);
				return {
					success,
					settings: sanitizedSettings,
					error: success ? undefined : 'Failed to save imported settings'
				};
			}

			// Save valid settings
			const success = await this.saveSettings(mergedSettings);
			return {
				success,
				settings: mergedSettings,
				error: success ? undefined : 'Failed to save imported settings'
			};
		} catch (error) {
			return {
				success: false,
				error: `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`
			};
		}
	}

	// Clear all settings data
	async clearAllSettings(): Promise<boolean> {
		try {
			await this.storage.clear();
			return true;
		} catch (error) {
			console.error('Failed to clear settings:', error);
			return false;
		}
	}

	// Get sync status
	async getSyncStatus(): Promise<{
		lastSync: Date | null;
		hasBackup: boolean;
		version: string | null;
	}> {
		try {
			const [timestampStr, backupData, settingsData] = await Promise.all([
				this.storage.get(STORAGE_KEYS.SYNC_TIMESTAMP),
				this.storage.get(STORAGE_KEYS.BACKUP),
				this.storage.get(STORAGE_KEYS.SETTINGS)
			]);

			let version = null;
			if (settingsData) {
				try {
					const parsed = JSON.parse(settingsData);
					version = parsed.version || 'legacy';
				} catch {
					version = 'legacy';
				}
			}

			return {
				lastSync: timestampStr ? new Date(parseInt(timestampStr)) : null,
				hasBackup: !!backupData,
				version
			};
		} catch (error) {
			console.error('Failed to get sync status:', error);
			return {
				lastSync: null,
				hasBackup: false,
				version: null
			};
		}
	}

	// Auto-sync with debouncing
	private autoSyncTimeout: number | null = null;

	scheduleAutoSync(settings: ComprehensiveSettings, delay = 1000): void {
		if (this.autoSyncTimeout) {
			clearTimeout(this.autoSyncTimeout);
		}

		this.autoSyncTimeout = setTimeout(() => {
			this.saveSettings(settings);
			this.autoSyncTimeout = null;
		}, delay);
	}

	// Cancel pending auto-sync
	cancelAutoSync(): void {
		if (this.autoSyncTimeout) {
			clearTimeout(this.autoSyncTimeout);
			this.autoSyncTimeout = null;
		}
	}
}

// Create default sync instance
export const defaultSettingsSync = new SettingsSync();

// Utility functions
export const settingsSyncUtils = {
	// Create a new sync instance
	createSync: (useIndexedDB = false) => new SettingsSync(useIndexedDB),

	// Check if storage is available
	isStorageAvailable: (): boolean => {
		if (typeof window === 'undefined') return false;

		try {
			const test = '__storage_test__';
			localStorage.setItem(test, test);
			localStorage.removeItem(test);
			return true;
		} catch {
			return false;
		}
	},

	// Get storage usage (approximate)
	getStorageUsage: async (): Promise<{ used: number; available: number } | null> => {
		if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
			return null;
		}

		try {
			const estimate = await navigator.storage.estimate();
			return {
				used: estimate.usage || 0,
				available: estimate.quota || 0
			};
		} catch {
			return null;
		}
	}
};
