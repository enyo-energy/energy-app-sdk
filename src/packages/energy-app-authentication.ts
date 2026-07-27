import {
    EnyoAuthenticateState,
    EnyoAuthentication,
    EnyoAuthenticationResponse,
    EnyoAuthenticationStateEnum,
    EnyoOauthAuthenticationStart,
    EnyoOauthAuthenticationRedirectUrlResponse
} from "../types/enyo-authentication.js";

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
    requestAuthentication(authentication: EnyoAuthentication): Promise<string>;
    /**
     * If you use oauth with clientIdName and clientSecretName, you need to listen to this and respond with the redirect url
     */
    listenForOauthStart(listener: (response: EnyoOauthAuthenticationStart) => Promise<EnyoOauthAuthenticationRedirectUrlResponse>): string;

    /**
     * Adds a listener for authentication responses.
     * The listener will be called when the user completes the authentication process.
     *
     * @param listener - Callback function that receives the authentication response and should return the authentication state
     * @returns The listener ID for removing the listener later
     */
    listenForAuthenticationResponse(listener: (response: EnyoAuthenticationResponse) => Promise<EnyoAuthenticateState>): string;

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
    getAuthenticationState(): Promise<EnyoAuthenticateState>;

    /**
     * Manually sets the current authentication state.
     *
     * Use this when the package manages authentication on its own instead of (or in addition to)
     * the standard {@link EnergyAppAuthentication.requestAuthentication} / {@link EnergyAppAuthentication.listenForAuthenticationResponse}
     * flow — for example when validating a stored session on startup, after refreshing a token,
     * or when reacting to an external authentication event. The provided state is persisted by the
     * host and becomes the value returned by {@link EnergyAppAuthentication.getAuthenticationState}.
     *
     * Setting the state to {@link EnyoAuthenticationStateEnum.Unauthenticated} does not trigger the
     * registered sign-out listeners; use {@link EnergyAppAuthentication.signOut} for an explicit,
     * listener-notifying sign-out.
     *
     * @param state - The authentication state to apply, including the desired {@link EnyoAuthenticationStateEnum},
     * and optionally the account/user name and the request ID that produced it
     * @returns Promise that resolves once the state has been applied by the host
     */
    setAuthenticationState(state: EnyoAuthenticateState): Promise<void>;

    /**
     * Signs the user out and updates the authentication state.
     * This will trigger any registered sign-out listeners.
     */
    signOut(): void;

    /** If you want to cancel the authentication request*/
    removeAuthenticationRequest(): void;
}