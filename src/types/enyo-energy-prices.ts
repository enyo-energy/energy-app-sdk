import {ElectricityTariffTypeEnum} from "./enyo-electricity-tariff.js";


/**
 * Represents complete energy tariff information
 */
export interface EnyoEnergyPrices {
    /** Unique identifier for this tariff */
    tariffId: string;
    type: ElectricityTariffTypeEnum;
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