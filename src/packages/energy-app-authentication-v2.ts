import type {
    EnyoAuthenticationV2,
    EnyoAuthenticationV2Definition,
    EnyoAuthenticationV2Filter,
    EnyoAuthenticationV2OauthStartListener,
    EnyoAuthenticationV2ReauthenticationOptions,
    EnyoAuthenticationV2RequestOptions,
    EnyoAuthenticationV2ResponseListener,
    EnyoAuthenticationV2SignOutListener,
    EnyoAuthenticationV2StateChangeListener,
    EnyoAuthenticationV2StateUpdate,
    EnyoAuthenticationV2Target,
} from "../types/enyo-authentication-v2.js";

/**
 * Authentication API (v2): sign-ins per appliance, per vehicle or for the whole
 * package, each with its own state.
 *
 * An *authentication* is one login the user gives the package — typically one
 * vendor cloud account — identified by a package-chosen
 * {@link EnyoAuthenticationV2Definition.authenticationKey}. It lists the
 * {@link EnyoAuthenticationV2Target targets} it is used for: the whole package,
 * or any number of appliances and vehicles. A package may hold several
 * authentications, e.g. one per vendor account.
 *
 * The host persists every authentication and its state, shows them to the
 * user ("Tesla-Konto — Model Y, Model 3 — Anmeldung abgelaufen") and lets the
 * package query them with {@link list}, so "which sign-in belongs to which
 * vehicle, and does it work?" is answered by the SDK rather than by the
 * package's own storage.
 *
 * Replaces the deprecated `useAuthentication()` (v1). Sign-ins created through
 * v1 appear here under {@link ENYO_AUTHENTICATION_V2_LEGACY_KEY}.
 *
 * ## First sign-in
 *
 * ```typescript
 * const auth = energyApp.useAuthenticationV2();
 *
 * auth.listenForAuthenticationResponse(async (response) => {
 *     const session = await vendor.login(response.usernamePassword!);
 *     if (!session.ok) {
 *         return {state: EnyoAuthenticationV2StateEnum.AuthenticationFailed, failureReason: 'invalidCredentials'};
 *     }
 *     return {state: EnyoAuthenticationV2StateEnum.Authenticated, accountName: session.email};
 * });
 *
 * await auth.upsert({
 *     authenticationKey: 'vendor-account',
 *     targets: [{type: 'vehicle', vehicleId}],
 *     name: [{language: 'de', value: 'Hersteller-Konto'}, {language: 'en', value: 'Vendor account'}],
 *     authenticationType: 'usernamePassword',
 *     usernamePassword: {
 *         usernameName: [{language: 'de', value: 'E-Mail'}, {language: 'en', value: 'E-mail'}],
 *         passwordName: [{language: 'de', value: 'Passwort'}, {language: 'en', value: 'Password'}],
 *     },
 * });
 * await auth.requestAuthentication('vendor-account');
 * ```
 *
 * ## Lost sign-in or missing permissions (re-authentication)
 *
 * Call {@link requireReauthentication} when the user has to sign in again —
 * because a session that used to work was rejected and a refresh failed
 * (`sessionExpired`), or because the package needs more rights than the
 * current sign-in grants (`insufficientPermissions`, e.g. new OAuth scopes).
 * It sets {@link EnyoAuthenticationV2StateEnum.ReauthenticationRequired} and
 * opens the sign-in in one step. Then — once per lost session — notify the
 * user:
 *
 * ```typescript
 * await auth.requireReauthentication('vendor-account', {
 *     reason: 'insufficientPermissions',
 *     stateReason: [
 *         {language: 'de', value: 'Für die Ladeplanung brauchen wir zusätzlich Zugriff auf den Ladestand.'},
 *         {language: 'en', value: 'For charge planning we also need access to the state of charge.'},
 *     ],
 * });
 * notification.sendNotification('authentication-required',
 *     {target: {type: 'authentication', authenticationKey: 'vendor-account'}}, texts);
 * ```
 *
 * The user's new sign-in arrives at {@link listenForAuthenticationResponse}
 * like any other; answering `Authenticated` ends the re-authentication. The
 * same happens when the user starts "sign in again" in the enyo app on their
 * own.
 *
 * Not permission-gated, like v1.
 */
export interface EnergyAppAuthenticationV2 {
    /**
     * Creates or replaces an authentication, identified by its
     * {@link EnyoAuthenticationV2Definition.authenticationKey}.
     *
     * Replacing keeps the state, the account name and any pending request, so
     * calling this on every start is safe. If the method
     * ({@link EnyoAuthenticationV2Definition.authenticationType}) changes, the
     * host resets the state to `Unauthenticated` and drops a pending request,
     * because the stored credentials no longer fit.
     *
     * @param definition - The full definition. Validate it locally with `validateAuthenticationV2Definition()`.
     * @returns The authentication as stored by the host, including its state.
     * @throws When the definition is invalid (see `validateAuthenticationV2Definition()`).
     */
    upsert(definition: EnyoAuthenticationV2Definition): Promise<EnyoAuthenticationV2>;

    /**
     * Adds targets to an existing authentication, e.g. after a car of the
     * vendor account was paired, or updates the
     * {@link EnyoAuthenticationV2TargetBase.externalIds} of targets already
     * present: for an existing target, given `externalIds` replace the stored
     * ones, omitted `externalIds` keep them.
     *
     * ```typescript
     * await auth.addTargets('vendor-account', [
     *     {type: 'vehicle', vehicleId, externalIds: {userId: account.userId, vendorVehicleId: car.id}},
     * ]);
     * ```
     *
     * @param authenticationKey - The authentication to extend.
     * @param targets - Appliance and/or vehicle targets to add or update. A package target cannot be added to a bound authentication.
     * @returns The updated authentication.
     * @throws When no authentication with this key exists.
     */
    addTargets(authenticationKey: string, targets: EnyoAuthenticationV2Target[]): Promise<EnyoAuthenticationV2>;

    /**
     * Removes targets from an authentication, e.g. after a car was unpaired.
     * The sign-in itself and its state are kept; removing the last target is
     * rejected — use {@link remove} for that. Removing a vehicle target does not
     * unpair the vehicle.
     *
     * @param authenticationKey - The authentication to shrink.
     * @param targets - Targets to remove. Targets not present are ignored.
     * @returns The updated authentication.
     * @throws When no authentication with this key exists or no target would remain.
     */
    removeTargets(authenticationKey: string, targets: EnyoAuthenticationV2Target[]): Promise<EnyoAuthenticationV2>;

    /**
     * Lists the package's authentications with their current state.
     *
     * Use the filter to answer "which sign-ins does this appliance / vehicle
     * have?". Without a filter, every authentication of the package is
     * returned, including ones migrated from v1.
     *
     * @param filter - Optional criteria; all given criteria must match.
     * @returns The matching authentications, in no particular order.
     */
    list(filter?: EnyoAuthenticationV2Filter): Promise<EnyoAuthenticationV2[]>;

    /**
     * Gets one authentication with its current state.
     *
     * @param authenticationKey - The key to look up.
     * @returns The authentication, or `null` when none exists with that key.
     */
    get(authenticationKey: string): Promise<EnyoAuthenticationV2 | null>;

    /**
     * Sets the state of an authentication, e.g. after validating a stored
     * session on start, after a token refresh, or when the vendor rejects a
     * session that used to work
     * ({@link EnyoAuthenticationV2StateEnum.ReauthenticationRequired}).
     *
     * Setting {@link EnyoAuthenticationV2StateEnum.Unauthenticated} does not
     * call sign-out listeners and does not unpair vehicles; use {@link signOut}
     * for that. Registered state-change listeners are called.
     *
     * @param authenticationKey - The authentication to update.
     * @param update - The new state and its optional explanation.
     * @returns The updated authentication.
     * @throws When no authentication with this key exists.
     */
    setState(authenticationKey: string, update: EnyoAuthenticationV2StateUpdate): Promise<EnyoAuthenticationV2>;

    /**
     * Marks an authentication as needing a new sign-in and asks the user for
     * it, in one step: sets
     * {@link EnyoAuthenticationV2StateEnum.ReauthenticationRequired} with the
     * given reason, explanation and affected targets, then opens a sign-in
     * request — also when the authentication is currently `Authenticated`,
     * which is the case for a permission update.
     *
     * Use it for a lost session (`sessionExpired`) and for missing rights
     * (`insufficientPermissions`, e.g. new OAuth scopes). For an OAuth
     * permission update, request the new scopes when building the authorize
     * URL in {@link listenForOauthStart}.
     *
     * Idempotent while the re-authentication is open: calling again updates
     * reason, explanation and affected targets and returns the pending
     * request's id. It does not send a notification; send
     * `authentication-required` yourself, once per lost session.
     *
     * The stored credentials are kept until the user signs in again, so a
     * package may keep using a session that still works partially.
     *
     * @param authenticationKey - The authentication the user has to sign in to again.
     * @param options - Why, with an optional explanation and the affected targets.
     * @returns The id of the sign-in request.
     * @throws When no authentication with this key exists, or an affected target is not a target of it.
     */
    requireReauthentication(authenticationKey: string, options: EnyoAuthenticationV2ReauthenticationOptions): Promise<string>;

    /**
     * Asks the user to sign in to an authentication. The host shows the
     * sign-in with the authentication's name, description and targets; the
     * credentials arrive at the listener registered with
     * {@link listenForAuthenticationResponse}.
     *
     * At most one request is pending per authentication: requesting again
     * returns the pending request's id instead of opening a second one.
     *
     * @param authenticationKey - The authentication to sign in to.
     * @param options - Optional request behaviour.
     * @returns The request id, also exposed as {@link EnyoAuthenticationV2.pendingRequestId}.
     * @throws When no authentication with this key exists.
     */
    requestAuthentication(authenticationKey: string, options?: EnyoAuthenticationV2RequestOptions): Promise<string>;

    /**
     * Withdraws the pending sign-in request of an authentication, if any. The
     * state is not changed.
     *
     * @param authenticationKey - The authentication whose request to withdraw.
     */
    cancelRequest(authenticationKey: string): Promise<void>;

    /**
     * Registers the listener that checks submitted credentials. One listener
     * serves every authentication of the package; tell them apart by
     * {@link EnyoAuthenticationV2Response.authenticationKey}.
     *
     * The resolved {@link EnyoAuthenticationV2Result} becomes the new state.
     * Resolve within the authentication's
     * {@link EnyoAuthenticationV2Definition.timeoutMs}; a rejection or timeout
     * is recorded as `AuthenticationFailed` with `technicalError`.
     *
     * @param listener - Checks the credentials and answers the resulting state.
     * @returns The listener id, for {@link removeListener}.
     */
    listenForAuthenticationResponse(listener: EnyoAuthenticationV2ResponseListener): string;

    /**
     * Registers the listener that builds the OAuth provider's authorize URL
     * when the user starts an OAuth sign-in.
     *
     * @param listener - Answers with the URL to send the user to.
     * @returns The listener id, for {@link removeListener}.
     */
    listenForOauthStart(listener: EnyoAuthenticationV2OauthStartListener): string;

    /**
     * Registers a listener called after the user signed out of an
     * authentication, in the enyo app or through {@link signOut}. The listener
     * receives the authentication as it was before sign-out.
     *
     * @param listener - Called once per sign-out.
     * @returns The listener id, for {@link removeListener}.
     */
    listenForSignOut(listener: EnyoAuthenticationV2SignOutListener): string;

    /**
     * Registers a listener called whenever the state of one of the package's
     * authentications changes — through the package, the user or the host.
     *
     * @param listener - Called with the updated authentication and its previous state.
     * @returns The listener id, for {@link removeListener}.
     */
    listenForStateChanges(listener: EnyoAuthenticationV2StateChangeListener): string;

    /**
     * Removes a listener registered with any of the `listenFor…` methods.
     *
     * @param listenerId - The id returned at registration.
     */
    removeListener(listenerId: string): void;

    /**
     * Signs out of one authentication: the state becomes `Unauthenticated`,
     * the account name and any pending request are dropped, and sign-out
     * listeners are called. The definition and targets are kept, so the user
     * can sign in again.
     *
     * For every {@link EnyoAuthenticationV2VehicleTarget} of the
     * authentication that is linked to this package, the host calls the
     * `useVehicle().onUnpairVehicle()` handler with reason `SignOut` and drops
     * the link. Vehicles of other authentications are not affected.
     *
     * @param authenticationKey - The authentication to sign out of.
     */
    signOut(authenticationKey: string): Promise<void>;

    /**
     * Deletes an authentication, e.g. when the vendor account is no longer
     * used. Signs out first (see {@link signOut}), then removes the definition.
     *
     * @param authenticationKey - The authentication to delete. Unknown keys are ignored.
     */
    remove(authenticationKey: string): Promise<void>;
}
