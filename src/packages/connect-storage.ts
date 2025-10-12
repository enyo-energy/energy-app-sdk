
/**
 * Interface for persistent storage operations in Connect EMS packages.
 * Provides key-value storage capabilities for package data persistence.
 */
export interface ConnectStorage {
    /** Save an object to storage with the specified key */
    save: (key: string, value: object) => Promise<void>;
    /** Load an object from storage by key, returns null if not found */
    load: (key: string) => Promise<object | null>;
    /** Remove an object from storage by key */
    remove: (key: string) => Promise<void>;
    /** Returns a list of all keys stored in the storage */
    listKeys: () => Promise<string[]>;
}