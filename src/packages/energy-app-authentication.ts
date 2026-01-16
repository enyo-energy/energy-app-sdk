import {
    HemsOneAuthenticateState,
    HemsOneAuthentication,
    HemsOneAuthenticationResponse
} from "../types/hems-one-authentication.js";

/**
 * Interface for requesting user authentication
 */
export interface EnergyAppAuthentication {
    /** Request a user authentication. The user will get a notification to authenticate. This might take time */
    requestAuthentication(authentication: HemsOneAuthentication): void;

    listenForAuthenticationResponse(listener: (response: HemsOneAuthenticationResponse) => Promise<HemsOneAuthenticateState>): void;
}