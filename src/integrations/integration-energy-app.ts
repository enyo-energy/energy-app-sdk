import {EnergyApp} from "../energy-app.js";
import {
    EnyoCommandAcknowledgeAnswerEnum,
    EnyoDataBusCommandAcknowledgeV1,
    EnyoDataBusGridOperatorPowerLimitationExecutedV1,
    EnyoDataBusGridOperatorPowerLimitationV1,
    EnyoDataBusMessage,
    EnyoDataBusMessageEnum
} from "../types/enyo-data-bus-value.js";
import {EnyoApplianceTypeEnum} from "../types/enyo-appliance.js";
import {EnyoSourceEnum} from "../types/enyo-source.enum.js";
import {DataBusCommandHandler} from "../implementations/data-bus/data-bus-command-handler.js";
import {ApplianceManager} from "../implementations/appliances/appliance-manager.js";
import {
    IntegrationApplianceCommandResponse,
    IntegrationCommandResponse,
    IntegrationEnergyAppOptions
} from "./integration-types.js";

/**
 * Type-safe handler signature: given a data bus message of type `T`, return
 * how to acknowledge it.
 */
export type IntegrationCommandHandler<T extends EnyoDataBusMessage = EnyoDataBusMessage> =
    (message: T) => Promise<IntegrationCommandResponse>;

/**
 * Abstract base for every appliance-oriented integration class shipped by this
 * SDK (Heatpump, Wallbox, Air Conditioning, Storage, Inverter).
 *
 * Responsibilities:
 *  - Subscribe to the data bus message types each subclass declares via
 *    {@link registerCommandHandler}.
 *  - Dispatch each incoming message to its registered async handler.
 *  - Automatically build and send the matching `CommandAcknowledgeV1` from the
 *    handler's return value (`Accepted` / `Rejected` / `NotSupported`).
 *  - Provide one shared abstract handler for the broadcast
 *    `GridOperatorPowerLimitationV1` (§14a EnWG) command, dispatching it once
 *    per managed appliance ID.
 *  - Resolve "which appliance(s) am I responsible for?" by either an
 *    {@link ApplianceManager}, an explicit list of IDs, or a custom override
 *    in {@link resolveManagedApplianceIds}.
 *
 * Lifecycle:
 *  - Constructor optionally calls `start()` (default: yes).
 *  - `start()` is idempotent.
 *  - `stop()` unsubscribes all listeners and disposes the internal
 *    {@link DataBusCommandHandler} (lazily created via {@link useCommandHandler}).
 *  - When `autoStopOnShutdown` is true (default), `stop()` is wired into
 *    {@link EnergyApp.onShutdown}.
 *
 * Subclasses should:
 *  1. Override the `managedApplianceType` getter so the base can filter
 *     appliances when an {@link ApplianceManager} is supplied.
 *  2. Call {@link registerCommandHandler} for every command-style message
 *     type they want to support, from `registerHandlers()` (called by `start()`).
 *  3. Implement {@link handleGridOperatorPowerLimitation}.
 */
export abstract class IntegrationEnergyApp extends EnergyApp {
    /**
     * Source identifier used when this integration emits messages on the data bus.
     */
    protected readonly source: EnyoSourceEnum;

    private readonly options: IntegrationEnergyAppOptions;
    private readonly handlers: Map<EnyoDataBusMessageEnum, IntegrationCommandHandler> = new Map();
    private readonly listenerIds: string[] = [];
    private commandHandler: DataBusCommandHandler | undefined;
    private started = false;

    /**
     * @param options - Configuration shared by every appliance-oriented integration.
     */
    protected constructor(options: IntegrationEnergyAppOptions) {
        super();
        this.options = options;
        this.source = options.source;

        if (options.autoStopOnShutdown !== false) {
            this.onShutdown(() => this.stop());
        }

        if (options.autoStart !== false) {
            // Defer until subclass constructors finish so they can override
            // `managedApplianceType` and register handlers in `registerHandlers()`.
            queueMicrotask(() => this.start());
        }
    }

    /**
     * The appliance type this integration manages. When an
     * {@link ApplianceManager} is supplied, the base class filters appliances
     * by this type. Subclasses must override this getter.
     */
    protected abstract get managedApplianceType(): EnyoApplianceTypeEnum;

    /**
     * Called once on `start()` — subclasses register every command handler
     * they support here via {@link registerCommandHandler}.
     */
    protected abstract registerHandlers(): void;

    /**
     * Handler for the broadcast `GridOperatorPowerLimitationV1` command (§14a
     * EnWG). Called once per managed appliance ID.
     *
     * Return:
     *  - `Accepted` when the appliance will comply with the limitation.
     *  - `Rejected` when the appliance cannot comply right now (set
     *    `rejectionReason`).
     *  - `NotSupported` when the appliance does not implement the limitation
     *    contract at all.
     *
     * @param message - The grid operator power limitation message.
     * @param applianceId - The managed appliance ID this invocation is for.
     */
    protected abstract handleGridOperatorPowerLimitation(
        message: EnyoDataBusGridOperatorPowerLimitationV1,
        applianceId: string
    ): Promise<IntegrationCommandResponse>;

    /**
     * Subscribes to the data bus for every registered handler. Idempotent —
     * calling `start()` more than once has no effect.
     */
    public start(): void {
        if (this.started) {
            return;
        }
        this.started = true;

        this.registerHandlers();
        this.registerGridOperatorPowerLimitationHandler();

        const dataBus = this.useDataBus();
        for (const messageType of this.handlers.keys()) {
            const id = dataBus.listenForMessages([messageType], (msg) => {
                void this.dispatch(msg);
            });
            this.listenerIds.push(id);
        }
    }

    /**
     * Unsubscribes all data bus listeners and disposes the internal
     * {@link DataBusCommandHandler} (if any). Safe to call multiple times.
     */
    public stop(): void {
        if (!this.started) {
            return;
        }
        this.started = false;

        const dataBus = this.useDataBus();
        for (const id of this.listenerIds) {
            dataBus.unsubscribe(id);
        }
        this.listenerIds.length = 0;
        this.handlers.clear();

        if (this.commandHandler) {
            this.commandHandler.dispose();
            this.commandHandler = undefined;
        }
    }

    /**
     * Registers an async handler for a single data bus command message type.
     * The base class will subscribe to that message type on `start()` and
     * automatically send the matching `CommandAcknowledgeV1` from the handler's
     * return value.
     *
     * @param messageType - The `EnyoDataBusMessageEnum` value to listen for.
     * @param handler - Async handler returning the desired acknowledgment.
     */
    protected registerCommandHandler<T extends EnyoDataBusMessage>(
        messageType: EnyoDataBusMessageEnum,
        handler: IntegrationCommandHandler<T>
    ): void {
        this.handlers.set(messageType, handler as IntegrationCommandHandler);
    }

    /**
     * Lazily creates (and caches) a {@link DataBusCommandHandler} that
     * subclasses can use to send outbound commands and await their
     * acknowledgments. Disposed automatically by {@link stop}.
     */
    protected useCommandHandler(): DataBusCommandHandler {
        if (!this.commandHandler) {
            this.commandHandler = new DataBusCommandHandler(this.useDataBus());
        }
        return this.commandHandler;
    }

    /**
     * Builds and publishes a `CommandAcknowledgeV1` message on the data bus
     * for `originalMessage` on behalf of `applianceId`.
     *
     * Subclasses don't normally need to call this directly — it's invoked
     * automatically from registered handlers — but it is exposed so subclasses
     * with custom dispatch logic can fan acks out manually.
     *
     * @param originalMessage - The inbound command being acknowledged.
     * @param applianceId - The appliance ID acknowledging the command.
     * @param response - The handler response (`answer` + optional `rejectionReason`).
     */
    protected sendAcknowledge(
        originalMessage: EnyoDataBusMessage,
        applianceId: string,
        response: IntegrationCommandResponse
    ): void {
        const ack: EnyoDataBusCommandAcknowledgeV1 = {
            id: this.generateMessageId(),
            type: 'answer',
            message: EnyoDataBusMessageEnum.CommandAcknowledgeV1,
            source: this.source,
            applianceId,
            timestampIso: new Date().toISOString(),
            data: {
                messageId: originalMessage.id,
                acknowledgeMessage: originalMessage.message,
                answer: response.answer,
                rejectionReason: response.rejectionReason
            }
        };
        this.useDataBus().sendMessage([ack]);
    }

    /**
     * Publishes a `GridOperatorPowerLimitationExecutedV1` announcement reporting
     * the grid operator power limitation the given appliance actually executed.
     * Call this after applying a `GridOperatorPowerLimitationV1` command locally,
     * so the energy manager, analytics and UI can observe the concrete cap that
     * was enforced, when it ends and for how long.
     *
     * @param applianceId - The appliance that executed the limitation.
     * @param data - The applied limitation (watts), end timestamp, duration
     *   (seconds), and optional command correlation id / reason.
     */
    public publishGridOperatorPowerLimitationExecuted(
        applianceId: string,
        data: EnyoDataBusGridOperatorPowerLimitationExecutedV1['data']
    ): void {
        const msg: EnyoDataBusGridOperatorPowerLimitationExecutedV1 = {
            id: this.generateMessageId(),
            type: 'message',
            message: EnyoDataBusMessageEnum.GridOperatorPowerLimitationExecutedV1,
            source: this.source,
            applianceId,
            timestampIso: new Date().toISOString(),
            data
        };
        this.useDataBus().sendMessage([msg]);
    }

    /**
     * Resolves the list of appliance IDs this integration is responsible for.
     *
     * Default strategy:
     *  1. If an `applianceManager` was provided, fetch all appliances of
     *     `managedApplianceType` and return their IDs.
     *  2. Otherwise return `options.applianceIds` if provided.
     *  3. Otherwise throw — subclasses with custom bookkeeping should override
     *     this method.
     *
     * Subclasses are free to override to plug in any other source.
     */
    protected async resolveManagedApplianceIds(): Promise<string[]> {
        if (this.options.applianceManager) {
            const appliances = await this.options.applianceManager.getAppliancesByType(this.managedApplianceType);
            return appliances.map(a => a.id);
        }
        if (this.options.applianceIds) {
            return this.options.applianceIds;
        }
        throw new Error(
            `IntegrationEnergyApp: no applianceManager and no applianceIds provided. ` +
            `Either pass one of them in the constructor options, or override resolveManagedApplianceIds().`
        );
    }

    /**
     * Returns the applianceId associated with an inbound command. Most
     * commands carry it at the top level (`message.applianceId`); a few
     * (`PauseChargingV1`, `ResumeChargingV1`) carry it inside `data`.
     * Subclasses can override if they introduce other message shapes.
     */
    protected extractApplianceId(message: EnyoDataBusMessage): string | undefined {
        if (message.applianceId) {
            return message.applianceId;
        }
        const data = message.data as { applianceId?: string } | undefined;
        return data?.applianceId;
    }

    /**
     * Generates a unique message ID for outgoing messages.
     * Uses `crypto.randomUUID()` which is available in Node 19+.
     */
    protected generateMessageId(): string {
        return globalThis.crypto.randomUUID();
    }

    private registerGridOperatorPowerLimitationHandler(): void {
        this.registerCommandHandler<EnyoDataBusGridOperatorPowerLimitationV1>(
            EnyoDataBusMessageEnum.GridOperatorPowerLimitationV1,
            async () => {
                // Dispatched specially via dispatch() so we can fan out per
                // managed appliance. The handler registry slot must exist for
                // the listener to be wired, but the actual response is
                // produced inside dispatch().
                return {answer: EnyoCommandAcknowledgeAnswerEnum.NotSupported};
            }
        );
    }

    private async dispatch(message: EnyoDataBusMessage): Promise<void> {
        if (message.message === EnyoDataBusMessageEnum.GridOperatorPowerLimitationV1) {
            await this.dispatchGridOperatorPowerLimitation(message as EnyoDataBusGridOperatorPowerLimitationV1);
            return;
        }

        const handler = this.handlers.get(message.message);
        if (!handler) {
            return;
        }

        const applianceId = this.extractApplianceId(message);
        let response: IntegrationCommandResponse;
        try {
            response = await handler(message);
        } catch (error) {
            response = {
                answer: EnyoCommandAcknowledgeAnswerEnum.Rejected,
                rejectionReason: error instanceof Error ? error.message : String(error)
            };
        }

        if (!applianceId) {
            // No applianceId means we cannot construct a meaningful ack —
            // subclasses overriding `extractApplianceId` should ensure one is
            // returned for every command they care about.
            return;
        }
        this.sendAcknowledge(message, applianceId, response);
    }

    private async dispatchGridOperatorPowerLimitation(
        message: EnyoDataBusGridOperatorPowerLimitationV1
    ): Promise<void> {
        let applianceIds: string[];
        try {
            applianceIds = await this.resolveManagedApplianceIds();
        } catch (error) {
            // If we cannot resolve which appliances we manage, we cannot
            // acknowledge — surface the error to the integrator's logs but
            // do not crash the listener.
            console.error('IntegrationEnergyApp: failed to resolve managed appliance ids', error);
            return;
        }

        const responses: IntegrationApplianceCommandResponse[] = await Promise.all(
            applianceIds.map(async (applianceId) => {
                try {
                    const response = await this.handleGridOperatorPowerLimitation(message, applianceId);
                    return {applianceId, ...response};
                } catch (error) {
                    return {
                        applianceId,
                        answer: EnyoCommandAcknowledgeAnswerEnum.Rejected,
                        rejectionReason: error instanceof Error ? error.message : String(error)
                    };
                }
            })
        );

        for (const response of responses) {
            this.sendAcknowledge(message, response.applianceId, response);
        }
    }
}
