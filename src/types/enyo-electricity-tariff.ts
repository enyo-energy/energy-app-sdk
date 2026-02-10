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
 * Input data for registering or updating an electricity tariff
 */
export interface ElectricityTariffRegistration {
    /** Unique identifier for the tariff */
    tariffId: string;
    /** The pricing model type of this tariff */
    tariffType: ElectricityTariffTypeEnum;
    /** Human-readable name of the tariff */
    tariffName: string;
    /** Name of the energy vendor/provider */
    vendorName: string;
    /** Optional ID of the primary meter appliance associated with this tariff */
    primaryMeterApplianceId?: string;
}

/**
 * Tariff registration data extended with default indicator.
 * Used in list responses to indicate which tariff is the system default.
 */
export interface ElectricityTariffWithDefault extends ElectricityTariffRegistration {
    /** Indicates whether this tariff is the system default */
    defaultTariff: boolean;
}
