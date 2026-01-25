import {EnergyAppDataBus, EnergyAppDataBusSendDataOptions} from "../../packages/energy-app-data-bus.js";
import {EnyoDataBusMessage, EnyoDataBusMessageAnswer, EnyoDataBusMessageEnum} from "../../types/enyo-data-bus-value.js";

/**
 * Demo implementation of EnergyAppDataBus that logs messages to console
 * and maintains an in-memory message history and listener registry.
 */
export class DemoDataBus implements EnergyAppDataBus {
    private messageHistory: EnyoDataBusMessage[] = [];
    private listeners: Map<string, {
        types: EnyoDataBusMessageEnum[];
        callback: (entry: EnyoDataBusMessage) => void;
    }> = new Map();
    private nextListenerId: number = 1;
    private maxHistorySize: number = 1000;

    /**
     * Creates a new DemoDataBus instance.
     * @param enableConsoleLogging Whether to log messages to console (default: true)
     * @param maxHistorySize Maximum number of messages to keep in history (default: 1000)
     */
    constructor(
        private enableConsoleLogging: boolean = true,
        maxHistorySize?: number
    ) {
        if (maxHistorySize !== undefined) {
            this.maxHistorySize = maxHistorySize;
        }
    }

    /**
     * Sends messages to the data bus (logs to console and notifies listeners).
     * @param messages Array of messages to send
     * @param options Optional send options (not used in demo)
     */
    sendMessage(messages: EnyoDataBusMessage[], options?: EnergyAppDataBusSendDataOptions): void {
        for (const message of messages) {
            // Log to console if enabled
            if (this.enableConsoleLogging) {
                console.log('[DEMO DataBus] Message sent:', {
                    id: message.id,
                    type: message.message,
                    applianceId: message.applianceId,
                    timestamp: message.timestampIso,
                    data: message.data
                });
            }

            // Add to history
            this.addToHistory(message);

            // Notify listeners
            this.notifyListeners(message);
        }
    }

    /**
     * Sends an answer message to the data bus.
     * @param answer The answer message to send
     * @param options Optional send options (not used in demo)
     */
    sendAnswer(answer: EnyoDataBusMessageAnswer, options?: EnergyAppDataBusSendDataOptions): void {
        // Log to console if enabled
        if (this.enableConsoleLogging) {
            console.log('[DEMO DataBus] Answer sent:', {
                id: answer.id,
                type: answer.message,
                status: answer.data.status,
                applianceId: answer.applianceId,
                timestamp: answer.timestampIso
            });
        }

        // Add to history
        this.addToHistory(answer);

        // Notify listeners
        this.notifyListeners(answer);
    }

    /**
     * Registers a listener for specific message types.
     * @param types Array of message types to listen for
     * @param listener Callback function to invoke when matching messages are received
     * @returns Listener ID that can be used to unsubscribe
     */
    listenForMessages(
        types: EnyoDataBusMessageEnum[],
        listener: (entry: EnyoDataBusMessage) => void
    ): string {
        const listenerId = `listener_${this.nextListenerId++}`;

        this.listeners.set(listenerId, {
            types,
            callback: listener
        });

        if (this.enableConsoleLogging) {
            console.log(`[DEMO DataBus] Listener ${listenerId} registered for types:`, types);
        }

        return listenerId;
    }

    /**
     * Unsubscribes a listener from the data bus.
     * @param listenerId The ID of the listener to unsubscribe
     */
    unsubscribe(listenerId: string): void {
        if (this.listeners.has(listenerId)) {
            const listener = this.listeners.get(listenerId);
            this.listeners.delete(listenerId);

            if (this.enableConsoleLogging) {
                console.log(`[DEMO DataBus] Listener ${listenerId} unsubscribed`);
            }
        } else {
            console.warn(`[DEMO DataBus] Attempted to unsubscribe non-existent listener: ${listenerId}`);
        }
    }

    /**
     * Adds a message to the history, maintaining the maximum size limit.
     * @param message The message to add to history
     */
    private addToHistory(message: EnyoDataBusMessage): void {
        this.messageHistory.push(message);

        // Trim history if it exceeds the maximum size
        if (this.messageHistory.length > this.maxHistorySize) {
            this.messageHistory = this.messageHistory.slice(-this.maxHistorySize);
        }
    }

    /**
     * Notifies all registered listeners that match the message type.
     * @param message The message to notify listeners about
     */
    private notifyListeners(message: EnyoDataBusMessage): void {
        for (const [listenerId, listener] of this.listeners.entries()) {
            if (listener.types.includes(message.message)) {
                try {
                    listener.callback(message);

                    if (this.enableConsoleLogging) {
                        console.log(`[DEMO DataBus] Notified listener ${listenerId} of ${message.message}`);
                    }
                } catch (error) {
                    console.error(`[DEMO DataBus] Error in listener ${listenerId}:`, error);
                }
            }
        }
    }

    /**
     * Gets the message history.
     * @param limit Optional limit on the number of messages to return
     * @returns Array of messages from history
     */
    getMessageHistory(limit?: number): EnyoDataBusMessage[] {
        if (limit && limit > 0) {
            return this.messageHistory.slice(-limit);
        }
        return [...this.messageHistory];
    }

    /**
     * Gets messages of specific types from history.
     * @param types Array of message types to filter by
     * @param limit Optional limit on the number of messages to return
     * @returns Filtered array of messages
     */
    getMessagesByType(types: EnyoDataBusMessageEnum[], limit?: number): EnyoDataBusMessage[] {
        const filtered = this.messageHistory.filter(msg => types.includes(msg.message));

        if (limit && limit > 0) {
            return filtered.slice(-limit);
        }
        return filtered;
    }

    /**
     * Gets messages for a specific appliance from history.
     * @param applianceId The appliance ID to filter by
     * @param limit Optional limit on the number of messages to return
     * @returns Filtered array of messages
     */
    getMessagesByAppliance(applianceId: string, limit?: number): EnyoDataBusMessage[] {
        const filtered = this.messageHistory.filter(msg => msg.applianceId === applianceId);

        if (limit && limit > 0) {
            return filtered.slice(-limit);
        }
        return filtered;
    }

    /**
     * Clears the message history.
     */
    clearHistory(): void {
        this.messageHistory = [];
        if (this.enableConsoleLogging) {
            console.log('[DEMO DataBus] Message history cleared');
        }
    }

    /**
     * Gets the current number of registered listeners.
     * @returns The number of active listeners
     */
    getListenerCount(): number {
        return this.listeners.size;
    }

    /**
     * Gets information about all registered listeners.
     * @returns Array of listener information
     */
    getListenerInfo(): Array<{ id: string; types: EnyoDataBusMessageEnum[] }> {
        return Array.from(this.listeners.entries()).map(([id, listener]) => ({
            id,
            types: listener.types
        }));
    }

    /**
     * Enables or disables console logging.
     * @param enabled Whether to enable console logging
     */
    setConsoleLogging(enabled: boolean): void {
        this.enableConsoleLogging = enabled;
        console.log(`[DEMO DataBus] Console logging ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Simulates receiving a message from an external source.
     * This is useful for testing listeners without actually sending messages.
     * @param message The message to simulate receiving
     */
    simulateIncomingMessage(message: EnyoDataBusMessage): void {
        if (this.enableConsoleLogging) {
            console.log('[DEMO DataBus] Simulating incoming message:', {
                id: message.id,
                type: message.message,
                applianceId: message.applianceId
            });
        }

        // Add to history
        this.addToHistory(message);

        // Notify listeners
        this.notifyListeners(message);
    }

    /**
     * Gets statistics about the data bus usage.
     * @returns Statistics object
     */
    getStatistics(): {
        totalMessages: number;
        messagesByType: Record<string, number>;
        activeListeners: number;
        messagesInLastHour: number;
    } {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

        const messagesByType: Record<string, number> = {};
        let messagesInLastHour = 0;

        for (const message of this.messageHistory) {
            // Count by type
            messagesByType[message.message] = (messagesByType[message.message] ?? 0) + 1;

            // Count messages in last hour
            if (new Date(message.timestampIso) > oneHourAgo) {
                messagesInLastHour++;
            }
        }

        return {
            totalMessages: this.messageHistory.length,
            messagesByType,
            activeListeners: this.listeners.size,
            messagesInLastHour
        };
    }
}