/**
 * Represents a secret value object containing key-value pairs.
 * The secret is retrieved from the developer organization's secret store.
 */
export interface SecretValue {
    [key: string]: string;
}

/**
 * Request structure for fetching a single secret.
 */
export interface SecretRequest {
    /** The name of the secret to retrieve */
    secretName: string;
}

/**
 * Response structure for secret retrieval operations.
 */
export interface SecretResponse {
    /** The name of the secret */
    secretName: string;
    /** The secret values as key-value pairs */
    values: SecretValue;
}

/**
 * Error that occurs when a secret cannot be found.
 */
export class SecretNotFoundError extends Error {
}

/**
 * Error that occurs when secret retrieval fails.
 */
export class SecretRetrievalError extends Error {
}