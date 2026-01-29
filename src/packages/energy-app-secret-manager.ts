import {SecretValue} from "../types/enyo-secret-manager.js";

export interface EnergyAppSecretManager {
    /**
     * Retrieves and decrypts a single secret from the developer organization's secret store.
     * The secret must have been previously configured in the developer org using the enyo CLI.
     *
     * @param secretName - The name of the secret to retrieve (e.g., "ostrom_oauth")
     * @param encryptionKey - The encryption key used to decrypt the secret
     * @returns Promise that resolves to an object containing the decrypted secret's key-value pairs
     * @throws {SecretNotFoundError} If the secret does not exist
     * @throws {SecretRetrievalError} If there's an error retrieving or decrypting the secret
     *
     * @example
     * ```typescript
     * const secretManager = energyApp.useSecretManager();
     * const oauthSecret = await secretManager.getSecret("oauth", encryptionKey);
     * // Returns: { client_id: "...", client_secret: "..." }
     * ```
     */
    getSecret<T>(secretName: string, encryptionKey: string): Promise<T>;

    /**
     * Retrieves and decrypts multiple secrets from the developer organization's secret store in a single request.
     * This is more efficient than making multiple individual requests.
     * All secrets must have been previously configured using the enyo CLI.
     *
     * @param secretNames - Array of secret names to retrieve
     * @param encryptionKey - The encryption key used to decrypt the secrets
     * @returns Promise that resolves to a record mapping secret names to their decrypted values
     * @throws {SecretNotFoundError} If any of the secrets do not exist
     * @throws {SecretRetrievalError} If there's an error retrieving or decrypting the secrets
     *
     * @example
     * ```typescript
     * const secretManager = energyApp.useSecretManager();
     * const encryptionKey = process.env.SECRET_ENCRYPTION_KEY;
     * const secrets = await secretManager.getSecrets(["api_keys", "oauth_config"], encryptionKey);
     * // Returns: {
     * //   "api_keys": { api_key: "...", api_secret: "..." },
     * //   "oauth_config": { client_id: "...", client_secret: "..." }
     * // }
     * ```
     */
    getSecrets(secretNames: string[], encryptionKey: string): Promise<Record<string, SecretValue>>;

    /**
     * Lists all available secret names that can be retrieved from the developer organization.
     * This can be useful for discovering what secrets have been configured.
     * Note: This returns only the names of secrets, not their values.
     *
     * @returns Promise that resolves to an array of available secret names
     * @throws {SecretRetrievalError} If there's an error listing the secrets
     *
     * @example
     * ```typescript
     * const secretManager = energyApp.useSecretManager();
     * const encryptionKey = process.env.SECRET_ENCRYPTION_KEY;
     * const availableSecrets = await secretManager.listAvailableSecrets(encryptionKey);
     * // Returns: ["oauth", "api_keys", "database_config"]
     * ```
     */
    listAvailableSecrets(): Promise<string[]>;

    /**
     * Saves a new secret to the secret store.
     * The secret will be encrypted using the provided encryption key.
     *
     * @param secretName - The name for the new secret
     * @param encryptionKey - The encryption key to use for encrypting the secret
     * @param secret - The secret data to save as key-value pairs
     * @returns Promise that resolves when the secret is successfully saved
     * @throws {SecretNameConflictException} If a secret with this name already exists and is not an installed package secret
     * @throws {SecretRetrievalError} If there's an error saving the secret
     *
     * @example
     * ```typescript
     * const secretManager = energyApp.useSecretManager();
     * const encryptionKey = process.env.SECRET_ENCRYPTION_KEY;
     * await secretManager.saveSecret("new_api_keys", encryptionKey, {
     *     api_key: "abc123",
     *     api_secret: "xyz789"
     * });
     * ```
     */
    saveSecret<T extends Record<string, string>>(secretName: string, encryptionKey: string, secret: T): Promise<void>;
}