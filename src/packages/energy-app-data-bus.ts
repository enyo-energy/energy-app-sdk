import {
    HemsOneDataBusMessage, HemsOneDataBusMessageEnum,
} from "../types/hems-one-data-bus-value.js";

/**
 * Interface for interaction with the Data Bus to send data or listen for changes
 */
export interface EnergyAppDataBus {
    sendMessage: (messages: HemsOneDataBusMessage[], options?: EnergyAppDataBusSendDataOptions) => void;
    sendAnswer: (answer: HemsOneDataBusMessage, options?: EnergyAppDataBusSendDataOptions) => void;
    listenForMessages: (types: HemsOneDataBusMessageEnum[], listener: (entry: HemsOneDataBusMessage) => void) => string;
    unsubscribe: (listenerId: string) => void;
}

export interface EnergyAppDataBusSendDataOptions {
}