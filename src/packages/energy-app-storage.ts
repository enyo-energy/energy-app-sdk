
/**
 * Interface for persistent storage operations in enyo packages.
 * Provides key-value storage capabilities for package data persistence.
 */
export interface EnergyAppStorage {
    /** Save an object to storage with the specified key */
    save: (key: string, value: object) => Promise<void>;
    /** Load an object from storage by key, returns null if not found */
    load: <T>(key: string) => Promise<T | null>;
    /** Remove an object from storage by key */
    remove: (key: string) => Promise<void>;
    /** Returns a list of all keys stored in the storage */
    listKeys: () => Promise<string[]>;
}