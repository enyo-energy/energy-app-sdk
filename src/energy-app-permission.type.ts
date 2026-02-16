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
    | 'OcppServer'
    | 'ChargingCard'
    | 'Vehicle'
    | 'Charge'
    | 'SecretManager'
    | 'LocationZipCode'
    | 'LocationCoordinates'
    | 'Timeseries'
    | 'EnergyManagerInfo'
    | 'ElectricityTariff'
    | 'WeatherForecastRegister'
    | 'WeatherForecastUse'
    | 'PvForecastRegister'
    | 'PvForecastUse'
    | 'PvSystemRegister'
    | 'PvSystemUse'
    | 'InverterControlCommands'
    | 'BatteryControlCommands'
    | 'ChargerControlCommands';

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
    ChargingCard = 'ChargingCard',
    Vehicle = 'Vehicle',
    Charge = 'Charge',
    SecretManager = 'SecretManager',
    LocationZipCode = 'LocationZipCode',
    LocationCoordinates = 'LocationCoordinates',
    Timeseries = 'Timeseries',
    EnergyManagerInfo = 'EnergyManagerInfo',
    ElectricityTariff = 'ElectricityTariff',
    WeatherForecastRegister = 'WeatherForecastRegister',
    WeatherForecastUse = 'WeatherForecastUse',
    PvForecastRegister = 'PvForecastRegister',
    PvForecastUse = 'PvForecastUse',
    PvSystemRegister = 'PvSystemRegister',
    PvSystemUse = 'PvSystemUse',
    InverterControlCommands = 'InverterControlCommands',
    BatteryControlCommands = 'BatteryControlCommands',
    ChargerControlCommands = 'ChargerControlCommands',
}