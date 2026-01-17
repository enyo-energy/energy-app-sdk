import {
    HemsOneAuthenticateState,
    HemsOneAuthentication,
    HemsOneAuthenticationResponse
} from "../types/hems-one-authentication.js";

/**
 * Interface for requesting user authentication
 */
export interface EnergyAppAuthentication {
    /** Request a user authentication. The user will get a notification to authenticate. This might take time. Returns the request id */
    requestAuthentication(authentication: HemsOneAuthentication): Promise<string>;

    /** Adds a listener for the authentication response*/
    listenForAuthenticationResponse(listener: (response: HemsOneAuthenticationResponse) => Promise<HemsOneAuthenticateState>): string;

    /** Removes the listener */
    removeListener: (listenerId: string) => void;

    /** Adds a listener for user initiated sign-out */
    listenForSignOut(listener: () => void): string;

    getAuthenticationState(): Promise<HemsOneAuthenticateState>;

    /** signs the user out and updates the authentication state*/
    signOut(): void
}