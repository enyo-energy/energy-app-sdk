import {
    EnyoDataBusHeatpumpControlV3,
    EnyoHeatpumpControlAction,
} from '../../types/enyo-data-bus-value.js';

/**
 * Why a `HeatpumpControlV3` session ended — passed to
 * `HeatpumpIntegrationEnergyApp.onHeatpumpControlEnded`.
 */
export enum HeatpumpControlEndCauseEnum {
    /** `validUntilIso` passed without a newer message (the energy manager stopped repeating it). */
    Expired = 'expired',
    /** The energy manager sent a `HeatpumpControlV3` with no actions and no power. */
    Ended = 'ended',
    /** The energy manager cancelled the session with `HeatpumpControlCancelV3`. */
    Cancelled = 'cancelled',
}

/**
 * The state the SDK keeps for one heatpump's current `HeatpumpControlV3`
 * session.
 */
export interface HeatpumpControlSessionState {
    /** The session's `sessionId`. */
    sessionId: string;
    /** A stable key of the session's actions — changes when any action changes. */
    actionsKey: string;
    /** The latest `validUntilIso`, as epoch milliseconds. */
    validUntilMs: number;
}

/**
 * Key that identifies an action within a session — its target and zone index.
 *
 * @param action - The action.
 * @returns E.g. `dhw:0`, or `room:` for an action without index.
 */
export function heatpumpControlActionKey(action: Pick<EnyoHeatpumpControlAction, 'target' | 'index'>): string {
    return `${action.target}:${action.index ?? ''}`;
}

/**
 * Stable key of a whole action list, independent of the order the actions
 * were sent in. Two lists with the same key ask for the same thing.
 *
 * @param actions - The session's actions.
 * @returns A string that changes whenever any action's target, index,
 *   `deltaK` or `heatSource` changes.
 */
export function heatpumpControlActionsKey(actions: EnyoHeatpumpControlAction[]): string {
    return actions
        .map((a) => [a.target, a.index ?? '', a.deltaK ?? '', a.heatSource ?? ''].join('|'))
        .sort()
        .join(';');
}

/**
 * Tracks the `HeatpumpControlV3` session of each heatpump: which session is
 * running, which of its actions have been applied, and when it lapses.
 *
 * Rules:
 * - Same `sessionId` and same actions → the session continues; only
 *   {@link HeatpumpControlSessionState.validUntilMs} moves.
 * - New `sessionId` or changed actions → a fresh state; every action is
 *   applied anew.
 * - No new message by `validUntilIso` → the state is dropped and `onExpired`
 *   is called for that appliance.
 *
 * Used by `HeatpumpIntegrationEnergyApp`; exported so integrations that
 * override `handleHeatpumpControl` can reuse the same rules.
 *
 * @example
 * ```typescript
 * const tracker = new HeatpumpControlSessionTracker((applianceId) => resetHeatpump(applianceId));
 * const {state, isNew} = tracker.track(message.applianceId, message.data);
 * if (isNew) applyActions(message.data.actions);
 * ```
 */
export class HeatpumpControlSessionTracker {
    private readonly sessions = new Map<string, HeatpumpControlSessionState>();
    private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

    /**
     * @param onExpired - Called when an appliance's session lapses because no
     *   message arrived by its `validUntilIso`. Not called by {@link end}.
     * @param now - Clock in epoch milliseconds; injectable for tests.
     */
    constructor(
        private readonly onExpired: (applianceId: string) => void,
        private readonly now: () => number = () => Date.now(),
    ) {
    }

    /**
     * The current session state of an appliance, if one is running.
     *
     * @param applianceId - The heatpump appliance.
     * @returns The state, or `undefined`.
     */
    get(applianceId: string): HeatpumpControlSessionState | undefined {
        return this.sessions.get(applianceId);
    }

    /**
     * Records a received session message and (re)arms its expiry.
     *
     * @param applianceId - The heatpump appliance the message is for.
     * @param data - The message's data.
     * @returns The appliance's state, and `isNew` when the session or its
     *   actions changed — the moment to apply the actions anew.
     * @throws {Error} When `validUntilIso` is not an ISO 8601 timestamp.
     */
    track(
        applianceId: string,
        data: EnyoDataBusHeatpumpControlV3['data'],
    ): {state: HeatpumpControlSessionState; isNew: boolean} {
        const validUntilMs = Date.parse(data.validUntilIso);
        if (!Number.isFinite(validUntilMs)) {
            throw new Error(`validUntilIso is not an ISO 8601 timestamp: ${data.validUntilIso}`);
        }
        const actionsKey = heatpumpControlActionsKey(data.actions ?? []);
        const current = this.sessions.get(applianceId);
        const isNew = !current || current.sessionId !== data.sessionId || current.actionsKey !== actionsKey;
        const state: HeatpumpControlSessionState = isNew
            ? {sessionId: data.sessionId, actionsKey, validUntilMs}
            : {...current, validUntilMs};
        this.sessions.set(applianceId, state);
        this.armExpiry(applianceId, validUntilMs);
        return {state, isNew};
    }

    /**
     * Ends an appliance's session without calling `onExpired` — for an
     * explicit end the caller handles itself.
     *
     * @param applianceId - The heatpump appliance.
     * @returns `true` when a session was running.
     */
    end(applianceId: string): boolean {
        this.clearTimer(applianceId);
        return this.sessions.delete(applianceId);
    }

    /** Drops every session and timer. Call on shutdown. */
    dispose(): void {
        for (const applianceId of [...this.timers.keys()]) this.clearTimer(applianceId);
        this.sessions.clear();
    }

    private armExpiry(applianceId: string, validUntilMs: number): void {
        this.clearTimer(applianceId);
        const delayMs = Math.max(0, validUntilMs - this.now());
        this.timers.set(applianceId, setTimeout(() => {
            this.timers.delete(applianceId);
            const state = this.sessions.get(applianceId);
            if (!state || state.validUntilMs > this.now()) return;
            this.sessions.delete(applianceId);
            this.onExpired(applianceId);
        }, delayMs));
    }

    private clearTimer(applianceId: string): void {
        const timer = this.timers.get(applianceId);
        if (timer !== undefined) clearTimeout(timer);
        this.timers.delete(applianceId);
    }
}
