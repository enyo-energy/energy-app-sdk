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
    | 'DynamicPriceForecastRegister'
    | 'DynamicPriceForecastUse'
    | 'PvSystemRegister'
    | 'PvSystemUse'
    | 'InverterControlCommands'
    | 'BatteryControlCommands'
    | 'ChargerControlCommands'
    | 'ModbusRtu'
    | 'EnergyPrices'
    | 'EnergyManager'
    | 'EebusDeviceManagement'
    | 'EebusDataAccess'
    | 'EebusControl'
    | 'Mqtt'
    | 'Bluetooth'
    | 'Wifi'
    | 'ChildProcess'
    | 'Udp';

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
    EnergyManager = 'EnergyManager',
    ElectricityTariff = 'ElectricityTariff',
    ModbusRtu = 'ModbusRtu',
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
    ChargerControlCommands = 'ChargerControlCommands',
    EebusDeviceManagement = 'EebusDeviceManagement',
    EebusDataAccess = 'EebusDataAccess',
    EebusControl = 'EebusControl',
    Mqtt = 'Mqtt',
    Bluetooth = 'Bluetooth',
    Wifi = 'Wifi',
    ChildProcess = 'ChildProcess',
    Udp = 'Udp'
}