import {ConnectInterval} from "./packages/connect-interval.js";
import {ConnectModbus} from "./packages/connect-modbus.js";
import {ConnectNetworkDevices} from "./packages/connect-network-devices.js";

export interface ConnectEmsApi {
    register: (callback: (packageName: string, version: number) => void) => void;
    onShutdown: (callback: () => Promise<void>) => void;
    isOnline: () => boolean;
    useFetch: () => typeof fetch;
    useInterval: () => ConnectInterval;
    useModbus: () => ConnectModbus;
    useNetworkDevices: () => ConnectNetworkDevices;
}