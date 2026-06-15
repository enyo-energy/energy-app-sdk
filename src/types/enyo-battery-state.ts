import {EnyoCurrencyEnum} from "./enyo-currency.js";

/**
 * Current runtime state of a single battery storage, keyed by the
 * battery's appliance ID. Returned by {@link EnergyAppBattery.getByApplianceId}
 * and {@link EnergyAppBattery.list}.
 *
 * Static battery configuration (capacity, mode, features, …) lives on
 * `EnyoBatteryApplianceMetadata` (accessible via the Appliance API); this
 * type intentionally only carries volatile runtime values.
 */
export interface EnyoBatteryState {
    /** Appliance ID of the battery (matches `EnyoAppliance.id` where `type === Storage`) */
    applianceId: string;
    /** Current state of charge in percent (0–100) */
    socPercent: number;
    /** Currently stored energy in kWh */
    energyKwh: number;
    /** Average price per kWh of the energy currently stored in the battery */
    pricePerKwh: number;
    /** Currency of {@link pricePerKwh} */
    currency: EnyoCurrencyEnum;
    /**
     * Optional share of the currently stored energy that originated from
     * solar production, in percent (0–100). Omitted when the runtime cannot
     * attribute energy provenance (e.g. no PV system or insufficient data).
     */
    solarSharePercent?: number;
}
