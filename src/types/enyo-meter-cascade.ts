import {
    EnyoElectricityTariff,
    EnyoTariffChangeTypeEnum,
    EnyoTariffPriceSeries,
} from "./enyo-electricity-tariff.js";
import {EnyoGridFeeInfo, EnyoGridFeeSeries} from "./enyo-grid-fee.js";
import {TimeseriesEntryBase} from "./enyo-timeseries.js";

/**
 * Operating status of the meter cascade, as computed by the core.
 *
 * Distinguishes "switched on but not working yet" from "working", which
 * {@link EnyoMeterCascade.active} alone cannot. Values match the hub's
 * `CascadeStatusEnum`.
 */
export enum EnyoCascadeStatusEnum {
    /** Both meters are read — the split carries live values and can be relied on. */
    Live = 'live',
    /**
     * The cascade is switched on, but has nothing to split off yet — no
     * cascade meter and no appliance assigned behind it. The user has to
     * finish the meter setup.
     */
    NoCascadeSource = 'noCascadeSource',
    /**
     * The cascade has a source, but there is no reading from the primary (grid)
     * meter, so the split between household and cascade cannot be computed.
     */
    NoGridReading = 'noGridReading',
}

/**
 * A meter cascade (Kaskadenschaltung): a second, billing-relevant meter (Z2)
 * installed **behind** the site's primary meter (Z1), measuring only part of
 * the installation — typically a heatpump or an EV charger on a dedicated
 * tariff with a reduced grid fee (e.g. §14a EnWG).
 *
 * Everything behind Z2 is billed on the cascade's tariff and grid fee;
 * everything else on the site's tariff (`useElectricityTariff()`) and grid fee
 * (`useGridFee()`). Z1 also counts everything that passes Z2, so never add the
 * two readings together.
 *
 * **Split rule.** PV and battery cover Z2 first: Z2 only pays the cascade
 * tariff for what Z1 imports from the grid at the same moment. Z1 importing
 * 2 kW while the battery supplies 1 kW and Z2 draws 2 kW gives a cascade grid
 * share of 1 kW, a cascade self-consumed share of 1 kW and a household grid
 * share of 1 kW. All feed-in leaves through Z1 and earns the site's feed-in
 * tariff.
 */
export interface EnyoMeterCascade {
    /**
     * Whether the cascade is switched on for billing. An inactive cascade is
     * configured but not used; appliances behind it are then billed on the
     * site's tariff.
     */
    active: boolean;
    /**
     * Operating status of the cascade. Check it in addition to {@link active}:
     * an active cascade that is not {@link EnyoCascadeStatusEnum.Live} has no
     * reliable split yet.
     */
    status: EnyoCascadeStatusEnum;
    /**
     * Whether Z2 is **calculated** as the sum of the appliances behind it
     * rather than measured by a physical meter. When `true`,
     * {@link meterApplianceId} is absent.
     */
    estimated: boolean;
    /**
     * Appliance ID of the cascade (Z2) meter. Absent when the cascade is
     * {@link estimated} — there is no physical meter then. The meter appliance
     * also carries the topology feature
     * {@link EnyoApplianceTopologyFeatureEnum.CascadeSubMeter}.
     */
    meterApplianceId?: string;
    /** Appliance ID of the meter Z2 sits behind, usually the primary meter (Z1) */
    parentMeterApplianceId?: string;
    /**
     * IDs of the appliances electrically behind Z2, i.e. the ones billed on
     * the cascade's tariff and grid fee. Does not include the cascade meter
     * itself.
     */
    applianceIds: string[];
}

/**
 * Kind of change reported by {@link EnyoMeterCascadeChangeEvent}.
 */
export enum EnyoMeterCascadeChangeTypeEnum {
    /** A cascade was configured where there was none */
    Created = 'Created',
    /** The cascade changed — activated, deactivated, status changed, or appliances moved behind / out of it */
    Updated = 'Updated',
    /** The cascade was removed */
    Removed = 'Removed',
}

/**
 * Event delivered to `useCascade().onCascadeChanged()` listeners whenever the
 * cascade is created, changed or removed.
 */
export interface EnyoMeterCascadeChangeEvent {
    /** What happened. */
    changeType: EnyoMeterCascadeChangeTypeEnum;
    /** The cascade after the change, or `null` when it was removed. */
    cascade: EnyoMeterCascade | null;
}

/**
 * Who currently owns the cascade's consumption tariff — and with it the
 * cascade's grid fee, which is provided by the same party.
 */
export enum EnyoCascadeTariffOwnerEnum {
    /** The core manages the tariff (entered by the user in the hub). The default. */
    Core = 'core',
    /** An energy app provides the tariff as a dynamic tariff and publishes its prices. */
    App = 'app',
}

/**
 * The cascade's consumption tariff as returned by `useCascade().getTariff()`.
 */
export type EnyoCascadeTariff = EnyoElectricityTariff & {
    /**
     * `true` when Z2 has no tariff of its own and the site's (Z1) consumption
     * tariff is returned instead — the hub prices Z2 with Z1's tariff until Z2
     * has one.
     */
    inheritedFromSite: boolean;
    /** Who owns the cascade tariff; absent when {@link inheritedFromSite} */
    owner?: EnyoCascadeTariffOwnerEnum;
};

/**
 * Event delivered to `useCascade().onTariffChanged()` listeners whenever the
 * cascade's own consumption tariff is set, taken over, replaced or cleared.
 */
export interface EnyoCascadeTariffChangeEvent {
    /** What happened. */
    changeType: EnyoTariffChangeTypeEnum;
    /**
     * The cascade's own tariff now in force, or `null` when it was cleared
     * (Z2 then inherits the site's tariff).
     */
    tariff: EnyoElectricityTariff | null;
    /** Who owns the tariff after the change; omitted when it was cleared. */
    owner?: EnyoCascadeTariffOwnerEnum;
}

/**
 * The cascade's consumption prices as returned by `useCascade().getPrices()`:
 * the effective price per kWh, including the grid fee and taxes the series'
 * `includes` declares.
 */
export type EnyoCascadePriceSeries = EnyoTariffPriceSeries & {
    /**
     * `true` when Z2 has no tariff of its own and the site's (Z1) prices are
     * returned instead.
     */
    inheritedFromSite: boolean;
};

/**
 * The cascade's grid fee as returned by `useCascade().getGridFee()`.
 */
export type EnyoCascadeGridFeeInfo = EnyoGridFeeInfo & {
    /**
     * `true` when Z2 has no grid fee of its own and the site's (Z1) grid fee
     * is returned instead — the hub prices Z2 with Z1's fee until Z2 has one.
     */
    inheritedFromSite: boolean;
    /**
     * Who provides Z2's own grid fee: the core, or the app that owns the
     * cascade tariff. Absent when {@link inheritedFromSite}.
     */
    owner?: EnyoCascadeTariffOwnerEnum;
};

/**
 * The cascade's grid fee series as returned by
 * `useCascade().getGridFeeValues()`.
 */
export type EnyoCascadeGridFeeSeries = EnyoGridFeeSeries & {
    /**
     * `true` when Z2 has no grid fee of its own and the site's (Z1) fee
     * series is returned instead.
     */
    inheritedFromSite: boolean;
};

/**
 * Bucket size of the cascade history. `'1m'` buckets are kept for 31 days
 * only; ranges further back must use a coarser resolution.
 */
export type EnyoCascadeTimeseriesResolution = '1m' | '15m' | '1d' | '1mo';

/**
 * Request for `useCascade().getCascadeTimeseries()`.
 */
export interface EnyoCascadeTimeseriesRequest {
    /** Start of the range in ISO format (inclusive) */
    fromIso: string;
    /** End of the range in ISO format (exclusive) */
    untilIso: string;
    /** Bucket size. Defaults to `'15m'` when omitted. */
    resolution?: EnyoCascadeTimeseriesResolution;
}

/**
 * One bucket of the cascade history: energy per share and what each share
 * cost.
 *
 * The shares follow the split rule (see {@link EnyoMeterCascade}): PV and
 * battery cover Z2 first, so `cascadeGridKwh + cascadeSelfConsumedKwh` is what
 * passed Z2, and `householdGridKwh + cascadeGridKwh` is the site's grid
 * import. Energy values are in kWh and never negative.
 *
 * Costs are in **ct** and priced when the history is read, with the tariff in
 * force at read time — the same way the hub re-prices the site's own history —
 * not frozen at aggregation time.
 */
export interface EnyoCascadeTimeseriesEntry extends TimeseriesEntryBase {
    /** Grid import billed on the primary meter's (Z1) tariff — the household share, in kWh */
    householdGridKwh: number;
    /** Grid import that passed Z2, billed on the cascade's tariff, in kWh */
    cascadeGridKwh: number;
    /** Energy Z2 drew from PV or battery instead of the grid — costs nothing, in kWh */
    cascadeSelfConsumedKwh: number;
    /** Cost of {@link householdGridKwh} on the site's tariff, in ct */
    householdCostCt: number;
    /** Cost of {@link cascadeGridKwh} on the cascade's tariff, in ct */
    cascadeCostCt: number;
    /** The cascade tariff's price in this bucket, in ct/kWh; `null` while Z2 has no tariff */
    cascadePriceCt: number | null;
    /** Whether the Z2 figures of this bucket were summed from appliances rather than measured */
    estimated: boolean;
}

/**
 * Response of `useCascade().getCascadeTimeseries()`.
 */
export interface EnyoCascadeTimeseriesResponse {
    /** Bucket size of {@link entries} */
    resolution: EnyoCascadeTimeseriesResolution;
    /** Buckets sorted ascending by `timestampIso`; buckets without an active cascade are omitted */
    entries: EnyoCascadeTimeseriesEntry[];
}
