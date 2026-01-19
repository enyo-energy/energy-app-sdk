import {
    HemsOneAuthenticateState,
    HemsOneAuthentication,
    HemsOneAuthenticationResponse
} from "../types/hems-one-authentication.js";

/**
 * Interface for requesting user authentication for appliances or the entire package.
 * Provides methods to handle authentication requests, listen for responses, and manage authentication state.
 */
export interface EnergyAppAuthentication {
    /**
     * Requests user authentication for an appliance or the entire package.
     * The user will receive a notification to authenticate. This operation might take time.
     *
     * @param authentication - The authentication configuration containing type, credentials setup, and optional appliance ID
     * @returns Promise that resolves to the request ID for tracking the authentication process
     */
    requestAuthentication(authentication: HemsOneAuthentication): Promise<string>;

    /**
     * Adds a listener for authentication responses.
     * The listener will be called when the user completes the authentication process.
     *
     * @param listener - Callback function that receives the authentication response and should return the authentication state
     * @returns The listener ID for removing the listener later
     */
    listenForAuthenticationResponse(listener: (response: HemsOneAuthenticationResponse) => Promise<HemsOneAuthenticateState>): string;

    /**
     * Removes a previously registered authentication response listener.
     *
     * @param listenerId - The ID of the listener to remove
     */
    removeListener: (listenerId: string) => void;

    /**
     * Adds a listener for user-initiated sign-out events.
     * The listener will be called when the user manually signs out.
     *
     * @param listener - Callback function called when user signs out
     * @returns The listener ID for removing the listener later
     */
    listenForSignOut(listener: () => void): string;

    /**
     * Gets the current authentication state.
     *
     * @returns Promise that resolves to the current authentication state
     */
    getAuthenticationState(): Promise<HemsOneAuthenticateState>;

    /**
     * Signs the user out and updates the authentication state.
     * This will trigger any registered sign-out listeners.
     */
    signOut(): void
}