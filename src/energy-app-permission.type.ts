export type EnergyAppPermissionType =
    'RestrictedInternetAccess'
    | 'NetworkDeviceDiscovery'
    | 'NetworkDeviceSearch'
    | 'NetworkDeviceAccess'
    | 'Modbus'
    | 'Storage'
    | 'Appliance'
    | 'AllAppliances'
    | 'SendDataBusValues'
    | 'SubscribeDataBus'
    | 'SendDataBusCommands'
    | 'OcppServer';

export enum EnergyAppPermissionTypeEnum {
    RestrictedInternetAccess = 'RestrictedInternetAccess',
    NetworkDeviceDiscovery = 'NetworkDeviceDiscovery',
    NetworkDeviceSearch = 'NetworkDeviceSearch',
    NetworkDeviceAccess = 'NetworkDeviceAccess',
    Modbus = 'Modbus',
    Storage = 'Storage',
    Appliance = 'Appliance',
    AllAppliances = 'AllAppliances',
    SendDataBusValues = 'SendDataBusValues',
    SubscribeDataBus = 'SubscribeDataBus',
    SendDataBusCommands = 'SendDataBusCommands',
    OcppServer = 'OcppServer',
}