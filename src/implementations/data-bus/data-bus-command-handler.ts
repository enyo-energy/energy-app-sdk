import {EnergyAppDataBus} from "../../packages/energy-app-data-bus.js";
import {
    EnyoDataBusCommandAcknowledgeV1,
    EnyoDataBusMessage,
    EnyoDataBusMessageEnum
} from "../../types/enyo-data-bus-value.js";

/**
 * Configuration options for the {@link DataBusCommandHandler}.
 */
export interface DataBusCommandHandlerOptions {
    /**
     * Default timeout in milliseconds to wait for a command acknowledgment.
     * Individual calls to {@link DataBusCommandHandler.sendCommand} can override this value.
     * @default 10000
     */
    defaultTimeoutMs?: number;
}

/**
 * Per-call options for {@link DataBusCommandHandler.sendCommand}.
 */
export interface SendCommandOptions {
    /**
     * Timeout in milliseconds for this specific command.
     * Overrides the default timeout configured in {@link DataBusCommandHandlerOptions}.
     */
    timeoutMs?: number;
}

/**
 * Error thrown when a command does not receive an acknowledgment within the configured timeout.
 */
export class CommandTimeoutError extends Error {
    /**
     * The ID of the command message that timed out.
     */
    public readonly messageId: string;

    /**
     * The timeout duration in milliseconds that was exceeded.
     */
    public readonly timeoutMs: number;

    /**
     * Creates a new CommandTimeoutError.
     * @param messageId - The ID of the command message that timed out
     * @param timeoutMs - The timeout duration in milliseconds
     */
    constructor(messageId: string, timeoutMs: number) {
        super(`Command ${messageId} timed out after ${timeoutMs}ms without acknowledgment`);
        this.name = 'CommandTimeoutError';
        this.messageId = messageId;
        this.timeoutMs = timeoutMs;
    }
}

interface PendingCommand {
    resolve: (ack: EnyoDataBusCommandAcknowledgeV1) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
}

/**
 * Utility class that wraps an {@link EnergyAppDataBus} to provide promise-based command sending
 * with automatic acknowledgment matching and timeout handling.
 *
 * Commands are sent via the data bus and the handler waits for a matching
 * {@link EnyoDataBusMessageEnum.CommandAcknowledgeV1} message. The returned promise resolves
 * with the acknowledgment for all answer types (Accepted, Rejected, NotSupported) — the
 * consumer is responsible for inspecting the `data.answer` field. The promise only rejects
 * on timeout or when {@link dispose} is called.
 *
 * @example
 * ```typescript
 * const commandHandler = new DataBusCommandHandler(energyApp.useDataBus());
 *
 * try {
 *     const ack = await commandHandler.sendCommand(myStartChargeCommand);
 *     if (ack.data.answer === EnyoCommandAcknowledgeAnswerEnum.Accepted) {
 *         console.log('Command accepted');
 *     } else {
 *         console.log('Rejected:', ack.data.rejectionReason);
 *     }
 * } catch (error) {
 *     if (error instanceof CommandTimeoutError) {
 *         console.error('No acknowledgment within timeout');
 *     }
 * }
 *
 * // Clean up when done
 * commandHandler.dispose();
 * ```
 */
export class DataBusCommandHandler {
    private readonly defaultTimeoutMs: number;
    private readonly pendingCommands: Map<string, PendingCommand> = new Map();
    private readonly listenerId: string;
    private disposed = false;

    /**
     * Creates a new DataBusCommandHandler.
     * @param dataBus - The data bus instance to send commands through and listen for acknowledgments on
     * @param options - Optional configuration options
     */
    constructor(
        private readonly dataBus: EnergyAppDataBus,
        options?: DataBusCommandHandlerOptions
    ) {
        this.defaultTimeoutMs = options?.defaultTimeoutMs ?? 10_000;

        this.listenerId = this.dataBus.listenForMessages(
            [EnyoDataBusMessageEnum.CommandAcknowledgeV1],
            (entry) => this.handleAcknowledge(entry as EnyoDataBusCommandAcknowledgeV1)
        );
    }

    /**
     * Sends a command message on the data bus and waits for its acknowledgment.
     *
     * The returned promise resolves with the {@link EnyoDataBusCommandAcknowledgeV1} for all
     * acknowledgment answer types (Accepted, Rejected, NotSupported). It only rejects when:
     * - The timeout is exceeded (throws {@link CommandTimeoutError})
     * - The handler has been disposed
     *
     * @param command - The command message to send. Its `id` field is used to correlate
     *   the acknowledgment response.
     * @param options - Optional per-call options to override the default timeout
     * @returns A promise that resolves with the command acknowledgment
     * @throws {CommandTimeoutError} If no acknowledgment is received within the timeout
     * @throws {Error} If the handler has been disposed
     */
    sendCommand(
        command: EnyoDataBusMessage,
        options?: SendCommandOptions
    ): Promise<EnyoDataBusCommandAcknowledgeV1> {
        if (this.disposed) {
            return Promise.reject(new Error('DataBusCommandHandler has been disposed'));
        }

        const timeoutMs = options?.timeoutMs ?? this.defaultTimeoutMs;

        return new Promise<EnyoDataBusCommandAcknowledgeV1>((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pendingCommands.delete(command.id);
                reject(new CommandTimeoutError(command.id, timeoutMs));
            }, timeoutMs);

            // Store the pending entry BEFORE calling sendMessage to handle
            // synchronous acknowledgment (e.g. DemoDataBus notifies listeners inline).
            this.pendingCommands.set(command.id, {resolve, reject, timer});

            this.dataBus.sendMessage([command]);
        });
    }

    /**
     * Disposes the command handler by unsubscribing from the data bus,
     * rejecting all pending commands, and clearing internal state.
     *
     * After calling dispose, any subsequent calls to {@link sendCommand} will reject immediately.
     */
    dispose(): void {
        if (this.disposed) {
            return;
        }
        this.disposed = true;

        this.dataBus.unsubscribe(this.listenerId);

        for (const [messageId, pending] of this.pendingCommands) {
            clearTimeout(pending.timer);
            pending.reject(new Error(`DataBusCommandHandler disposed while waiting for acknowledgment of command ${messageId}`));
        }
        this.pendingCommands.clear();
    }

    /**
     * Handles an incoming CommandAcknowledgeV1 message by resolving the
     * corresponding pending command promise, if one exists.
     */
    private handleAcknowledge(ack: EnyoDataBusCommandAcknowledgeV1): void {
        const pending = this.pendingCommands.get(ack.data.messageId);
        if (!pending) {
            return;
        }

        clearTimeout(pending.timer);
        this.pendingCommands.delete(ack.data.messageId);
        pending.resolve(ack);
    }
}
