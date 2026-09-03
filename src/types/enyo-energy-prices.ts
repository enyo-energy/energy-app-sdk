import {EnyoTariffPricingTypeEnum} from "./enyo-electricity-tariff.js";


/**
 * Represents complete energy tariff information carried on the data bus by
 * `EnergyTariffUpdateV1`.
 *
 * Predates {@link EnergyAppElectricityTariff.publishPrices}, which is the
 * supported way to publish prices for a tariff slot. This shape still carries a
 * `tariffId`, a concept the tariff API no longer has — the two are not
 * interchangeable, and new code should publish through the tariff API.
 */
export interface EnyoEnergyPrices {
    /** Unique identifier for this tariff */
    tariffId: string;
    type: EnyoTariffPricingTypeEnum;
    /** Pricing data structure */
    prices: EnyoEnergyPriceEntry[];
}

export interface EnyoEnergyPriceEntry {
    /** Start time of this 15-minute interval in ISO format */
    timestampIso: string;
    /** Price per kWh for electricity consumption during this interval */
    consumptionPricePerKwh: number;
    /** Optional price per kWh for grid feed-in during this interval */
    feedInPricePerKwh?: number;
    currency: string;
}