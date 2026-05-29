/**
 * Typed catalogues of the SPINE wire identifiers the SDK exposes on its
 * structured surfaces (feature catalog, typed use-case clients, typed
 * errors).
 *
 * **Strings, not enums, on the low-level escape hatch.** SPINE defines a
 * large and growing set of feature / function / entity types. The typed
 * use-case clients and the structured feature-catalog surface use the
 * enums in this file because their consumer code routes on type and
 * benefits from exhaustiveness checking. The low-level
 * {@link EebusSpineLowLevel} API intentionally keeps `string` parameters
 * — it is the escape hatch precisely so callers can talk to features the
 * SDK does not yet model.
 *
 * **Adding new values.** When SPINE introduces a new feature type,
 * function, or entity, add it to the enum here in the same change that
 * exposes it through a typed client; the closed-set nature of the
 * structured surface is the point.
 */

/**
 * SPINE entity-type wire identifiers carried in
 * `NodeManagement.DetailedDiscoveryData`.
 *
 * Used wherever the SDK exposes a parsed entity type — most importantly
 * by {@link EebusFeatureCatalog.findFeatureAddresses} (the address
 * resolver) and by the `prefer` hint on typed use-case client options
 * for multi-entity peers.
 */
export enum SpineEntityType {
    DEVICE_INFORMATION = 'DeviceInformation',
    DEVICE_CLASSIFICATION = 'DeviceClassification',
    DEVICE_CONFIGURATION = 'DeviceConfiguration',
    DEVICE_DIAGNOSIS = 'DeviceDiagnosis',
    EV = 'EV',
    EVSE = 'EVSE',
    HM_COMPRESSOR = 'HeatManagerCompressor',
    HM_HEAT_PUMP = 'HeatManagerHeatPump',
    HM_HEATING_ZONE = 'HeatManagerHeatingZone',
    HM_SMART_GRID_CONNECTION = 'HeatManagerSmartGridConnection',
    CEM = 'CEM',
    BATTERY = 'Battery',
    PV_STRING = 'PVString',
    SOLAR_INVERTER = 'SolarInverter',
    HHES_BATTERY = 'HouseholdElectricityStorageBattery',
    HHES_HYBRID_INVERTER = 'HouseholdElectricityStorageHybridInverter',
    GENERIC = 'Generic',
    // HVAC temperature use cases (MRT, CRHT, MDT, MOT)
    HVAC_ROOM = 'HVACRoom',
    HEATING_CIRCUIT = 'HeatingCircuit',
    HEATING_ZONE = 'HeatingZone',
    DHW_CIRCUIT = 'DHWCircuit',
    OUTDOOR_TEMPERATURE_SENSOR = 'OutdoorTemperatureSensor',
}

/**
 * SPINE feature-type wire identifiers advertised by remote nodes in
 * `NodeManagement.DetailedDiscoveryData`.
 *
 * Used by the typed feature catalog ({@link EebusRemoteFeature.type},
 * {@link EebusFeatureCatalog.findFeatureAddresses}) and by typed errors.
 * The low-level SPINE API
 * ({@link EebusSpineLowLevel.readData} / `writeData` / `subscribe`)
 * deliberately accepts a wider `string` so callers can address features
 * not yet enumerated here.
 */
export enum SpineFeatureType {
    ACTUATOR_LEVEL = 'ActuatorLevel',
    ACTUATOR_SWITCH = 'ActuatorSwitch',
    ALARM = 'Alarm',
    BILL = 'Bill',
    DATA_TUNNEL_MANAGER = 'DataTunnelManager',
    DEVICE_CLASSIFICATION = 'DeviceClassification',
    DEVICE_CONFIGURATION = 'DeviceConfiguration',
    DEVICE_DIAGNOSIS = 'DeviceDiagnosis',
    DIRECT_CONTROL = 'DirectControl',
    ELECTRICAL_CONNECTION = 'ElectricalConnection',
    HVAC = 'Hvac',
    IDENTIFICATION = 'Identification',
    INCENTIVE_TABLE = 'IncentiveTable',
    LOAD_CONTROL = 'LoadControl',
    MEASUREMENT = 'Measurement',
    MESSAGING = 'Messaging',
    NETWORK_MANAGEMENT = 'NetworkManagement',
    NODE_MANAGEMENT = 'NodeManagement',
    OPERATING_CONSTRAINTS = 'OperatingConstraints',
    POWER_SEQUENCES = 'PowerSequences',
    SENSING = 'Sensing',
    SETPOINT = 'Setpoint',
    SMART_ENERGY_MANAGEMENT_PS = 'SmartEnergyManagementPs',
    SUPPLY_CONDITIONS = 'SupplyConditions',
    TARIFF_INFORMATION = 'TariffInformation',
    TASK_MANAGEMENT = 'TaskManagement',
    THRESHOLD = 'Threshold',
    TIME_INFORMATION = 'TimeInformation',
    TIME_SERIES = 'TimeSeries',
    TIME_TABLE = 'TimeTable',
}

/**
 * SPINE function (data-set) wire identifiers advertised by the
 * `possibleOperations` of a feature.
 *
 * Defined as a `const` object + derived literal-union type rather than
 * a TypeScript `enum` so that consumers can pattern-match on the
 * underlying string values without an enum lookup (the lib hands raw
 * wire strings around) while still getting closed-set exhaustiveness
 * checks at the consumer boundary.
 *
 * The low-level SPINE API
 * ({@link EebusSpineLowLevel.readData} / `writeData`) keeps a wider
 * `string` parameter for `functionName` — newly-published SPINE
 * functions are reachable from there before the catalog here catches
 * up.
 */
export const SpineFunctionType = {
    // NodeManagement
    NodeManagementDetailedDiscoveryData: 'nodeManagementDetailedDiscoveryData',
    NodeManagementUseCaseData: 'nodeManagementUseCaseData',
    NodeManagementSubscriptionRequestCall: 'nodeManagementSubscriptionRequestCall',
    NodeManagementSubscriptionDeleteCall: 'nodeManagementSubscriptionDeleteCall',
    NodeManagementBindingRequestCall: 'nodeManagementBindingRequestCall',
    NodeManagementBindingDeleteCall: 'nodeManagementBindingDeleteCall',
    // LoadControl
    LoadControlLimitListData: 'loadControlLimitListData',
    LoadControlLimitDescriptionListData: 'loadControlLimitDescriptionListData',
    LoadControlLimitConstraintsListData: 'loadControlLimitConstraintsListData',
    LoadControlStateData: 'loadControlStateData',
    LoadControlEventListData: 'loadControlEventListData',
    LoadControlNodeData: 'loadControlNodeData',
    // Measurement
    MeasurementListData: 'measurementListData',
    MeasurementDescriptionListData: 'measurementDescriptionListData',
    MeasurementConstraintsListData: 'measurementConstraintsListData',
    // ElectricalConnection
    ElectricalConnectionDescriptionListData: 'electricalConnectionDescriptionListData',
    ElectricalConnectionParameterDescriptionListData: 'electricalConnectionParameterDescriptionListData',
    ElectricalConnectionPermittedValueSetListData: 'electricalConnectionPermittedValueSetListData',
    // DeviceClassification
    DeviceClassificationManufacturerData: 'deviceClassificationManufacturerData',
    DeviceClassificationUserData: 'deviceClassificationUserData',
    // DeviceConfiguration
    DeviceConfigurationKeyValueDescriptionListData: 'deviceConfigurationKeyValueDescriptionListData',
    DeviceConfigurationKeyValueListData: 'deviceConfigurationKeyValueListData',
    // DeviceDiagnosis
    DeviceDiagnosisStateData: 'deviceDiagnosisStateData',
    DeviceDiagnosisHeartbeatData: 'deviceDiagnosisHeartbeatData',
    // HVAC
    HvacSystemFunctionListData: 'hvacSystemFunctionListData',
    HvacOperationModeListData: 'hvacOperationModeListData',
    HvacOperationModeData: 'hvacOperationModeData',
    HvacOperationModeDescriptionListData: 'hvacOperationModeDescriptionListData',
    // HVAC — CRHT (Configuration of Room Heating Temperature) UC TS Table 10
    HvacSystemFunctionSetpointRelationListData: 'hvacSystemFunctionSetpointRelationListData',
    // HVAC — zone description + state (CRHT extension; VR940 advertises these)
    HvacZoneDescriptionListData: 'hvacZoneDescriptionListData',
    HvacZoneStateListData: 'hvacZoneStateListData',
    // Setpoint
    SetpointListData: 'setpointListData',
    SetpointData: 'setpointData',
    // Setpoint — CRHT / CDT UC TS Tables 7-8
    SetpointDescriptionListData: 'setpointDescriptionListData',
    SetpointConstraintsListData: 'setpointConstraintsListData',
    // SmartEnergyManagementPs — OHPCF UC TS Table 11
    SmartEnergyManagementPsData: 'smartEnergyManagementPsData',
    // IncentiveTable — OHPCF UC TS §3.5 (Tables 12-14)
    IncentiveDescriptionListData: 'incentiveDescriptionListData',
    IncentiveTableData: 'incentiveTableData',
    IncentiveListData: 'incentiveListData',
} as const;
/**
 * Literal-union view of {@link SpineFunctionType}. Use this type for
 * fields and parameters that should be constrained to the catalogue
 * above; use the `SpineFunctionType.XYZ` constants for values.
 */
export type SpineFunctionType = typeof SpineFunctionType[keyof typeof SpineFunctionType];
