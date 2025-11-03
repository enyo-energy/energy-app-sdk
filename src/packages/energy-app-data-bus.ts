import {HemsOneDataBusValue, HemsOneDataBusValueTypeEnum} from "../types/hems-one-data-bus-value.js";
import {
    HemsOneDataBusCommand,
    HemsOneDataBusCommandAnswer,
    HemsOneDataBusCommandTypeEnum
} from "../types/hems-one-data-bus-command.js";

/**
 * Interface for interaction with the Data Bus to send data or listen for changes
 */
export interface EnergyAppDataBus {
    sendValues: (values: HemsOneDataBusValue[], options?: EnergyAppDataBusSendDataOptions) => void;

    sendCommands: (commands: HemsOneDataBusCommand[]) => void;

    answerReceivedCommand: (commandId: string, answer: HemsOneDataBusCommandAnswer) => void;

    listenForValues: (types: HemsOneDataBusValueTypeEnum[], listener: (entries: HemsOneDataBusValue[]) => void) => void;

    listenForCommands: (types: HemsOneDataBusCommandTypeEnum[], listener: (entries: HemsOneDataBusCommand[]) => void) => void;
}

export interface EnergyAppDataBusSendDataOptions {
}