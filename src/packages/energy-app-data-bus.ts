import {
    EnyoDataBusMessage, EnyoDataBusMessageAnswer, EnyoDataBusMessageEnum,
} from "../types/enyo-data-bus-value.js";

/**
 * Interface for interaction with the Data Bus to send data or listen for changes
 */
export interface EnergyAppDataBus {
    sendMessage: (messages: EnyoDataBusMessage[], options?: EnergyAppDataBusSendDataOptions) => void;
    sendAnswer: (answer: EnyoDataBusMessageAnswer, options?: EnergyAppDataBusSendDataOptions) => void;
    listenForMessages: (types: EnyoDataBusMessageEnum[], listener: (entry: EnyoDataBusMessage) => void) => string;
    unsubscribe: (listenerId: string) => void;
}

export interface EnergyAppDataBusSendDataOptions {
}