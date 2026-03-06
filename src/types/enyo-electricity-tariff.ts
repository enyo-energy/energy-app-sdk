/**
 * Enum representing the type of electricity tariff pricing model
 */
export enum ElectricityTariffTypeEnum {
    /** Fixed price that doesn't change over time */
    Static = 'static',
    /** Price varies based on time of day (e.g., peak/off-peak) */
    TimeVariable = 'time-variable',
    /** Price changes dynamically based on market conditions */
    Dynamic = 'dynamic'
}

/**
 * Pricing data for a static (fixed-price) electricity tariff
 */
export interface StaticTariffData {
    /** Price per kWh for consumption */
    pricePerKwh: number;
    /** Currency code (ISO 4217, e.g., 'EUR', 'USD') */
    currency: string;
}

/**
 * Pricing data for a dynamic electricity tariff
 */
export interface DynamicTariffData {
    /** Price per kWh for grid fees */
    gridFeePerKwh?: number;
    /** Currency code (ISO 4217, e.g., 'EUR', 'USD') */
    currency: string;
}

/**
 * A single entry in a time-variable tariff schedule
 */
export interface TimeVariableScheduleEntry {
    /** Relative start offset (e.g., minutes from start of day) */
    start: number;
    /** Price per kWh during this period */
    pricePerKwh: number;
}

/**
 * Pricing data for a time-variable electricity tariff
 */
export interface TimeVariableTariffData {
    /** Schedule of time-based price entries */
    schedule: TimeVariableScheduleEntry[];
    /** Currency code (ISO 4217, e.g., 'EUR', 'USD') */
    currency: string;
}

/**
 * Input data for registering or updating an electricity tariff
 */
export interface EnyoElectricityTariff {
    /** Unique identifier for the tariff */
    id: string;
    /** The pricing model type of this tariff */
    tariffType: ElectricityTariffTypeEnum;
    /** Human-readable name of the tariff */
    tariffName: string;
    /** Name of the energy vendor/provider */
    vendorName: string;
    /** Optional ID of the primary meter appliance associated with this tariff */
    primaryMeterApplianceId?: string;
    /** Optional static pricing data (relevant when tariffType is Static) */
    staticTariffData?: StaticTariffData;
    /** Optional time-variable pricing data (relevant when tariffType is TimeVariable) */
    timeVariableTariffData?: TimeVariableTariffData;
    /** Optional dynamic pricing data*/
    dynamicTariffData?: DynamicTariffData;
}

/**
 * Tariff registration data extended with default indicator.
 * Used in list responses to indicate which tariff is the system default.
 */
export interface EnyoElectricityTariffWithDefault extends EnyoElectricityTariff {
    /** Indicates whether this tariff is the system default */
    defaultTariff: boolean;
}
