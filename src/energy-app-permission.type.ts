/**
 * All permissions an Energy App package can request.
 *
 * Source of truth for the permission catalogue — {@link EnergyAppPermissionType}
 * is derived from it.
 */
export enum EnergyAppPermissionTypeEnum {
    RestrictedInternetAccess = 'RestrictedInternetAccess',
    NetworkDeviceDiscovery = 'NetworkDeviceDiscovery',
    NetworkDeviceSearch = 'NetworkDeviceSearch',
    NetworkDeviceAccess = 'NetworkDeviceAccess',
    AllNetworkDeviceAccess = 'AllNetworkDeviceAccess',
    Modbus = 'Modbus',
    Storage = 'Storage',
    Appliance = 'Appliance',
    AllAppliances = 'AllAppliances',
    SendDataBusValues = 'SendDataBusValues',
    SubscribeDataBus = 'SubscribeDataBus',
    SendDataBusCommands = 'SendDataBusCommands',
    OcppServer = 'OcppServer',
    ChargingCard = 'ChargingCard',
    Vehicle = 'Vehicle',
    Charge = 'Charge',
    SecretManager = 'SecretManager',
    LocationZipCode = 'LocationZipCode',
    LocationCoordinates = 'LocationCoordinates',
    Timeseries = 'Timeseries',
    EnergyManagerInfo = 'EnergyManagerInfo',
    EnergyManager = 'EnergyManager',
    ElectricityTariff = 'ElectricityTariff',
    ModbusRtu = 'ModbusRtu',
    ModbusServer = 'ModbusServer',
    EnergyPrices = 'EnergyPrices',
    WeatherForecastRegister = 'WeatherForecastRegister',
    WeatherForecastUse = 'WeatherForecastUse',
    PvForecastRegister = 'PvForecastRegister',
    PvForecastUse = 'PvForecastUse',
    DynamicPriceForecastRegister = 'DynamicPriceForecastRegister',
    DynamicPriceForecastUse = 'DynamicPriceForecastUse',
    PvSystemRegister = 'PvSystemRegister',
    PvSystemUse = 'PvSystemUse',
    InverterControlCommands = 'InverterControlCommands',
    BatteryControlCommands = 'BatteryControlCommands',
    BatteryStorageState = 'BatteryStorageState',
    ChargerControlCommands = 'ChargerControlCommands',
    EebusDeviceManagement = 'EebusDeviceManagement',
    EebusDataAccess = 'EebusDataAccess',
    EebusControl = 'EebusControl',
    Mqtt = 'Mqtt',
    Bluetooth = 'Bluetooth',
    Wifi = 'Wifi',
    ChildProcess = 'ChildProcess',
    Udp = 'Udp',
    ProvidedFiles = 'ProvidedFiles',
    Automation = 'Automation',
    Savings = 'Savings',
    EpexSpotPrices = 'EpexSpotPrices',
    FirmwareRegistry = 'FirmwareRegistry',
    GridFeeRegister = 'GridFeeRegister',
    GridFeeUse = 'GridFeeUse',
    CommandLog = 'CommandLog'
}

/**
 * String union of every permission name, derived from
 * {@link EnergyAppPermissionTypeEnum} so both spellings stay interchangeable.
 */
export type EnergyAppPermissionType = `${EnergyAppPermissionTypeEnum}`;
