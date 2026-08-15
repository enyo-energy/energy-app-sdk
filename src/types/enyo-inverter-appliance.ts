export interface EnyoInverterDcString {
    index: number;
    name?: string;
}

/**
 * A group of PV modules sharing the same physical orientation (e.g. a roof
 * face). Used to describe the layout of a PV installation attached to an
 * inverter.
 */
export interface EnyoInverterModuleGroup {
    /** Number of PV modules in this group */
    numberOfModules?: number;
    /**
     * Orientation of the modules in this group. A free-form description of the
     * compass direction the modules face (e.g. "South", "East-West").
     */
    orientation?: string;
}

export interface EnyoInverterApplianceMetadata {
    maxPvProductionW?: number;
    dcStrings?: EnyoInverterDcString[];
    /** Optional custom DC string names, keyed by DC string index */
    customDcStringNames?: Record<number, string>;
    /** Currently active production / feed-in limit in Watts (if any) */
    activeProductionLimitationW?: number;
    /** Year the inverter / PV installation was built (four-digit calendar year, e.g. 2021) */
    yearBuilt?: number;
    /** Groups of PV modules attached to this inverter, each with its own orientation */
    moduleGroups?: EnyoInverterModuleGroup[];
    /**
     * Whether grid feed-in of this inverter should be blocked while the
     * electricity price is negative.
     *
     * This is a user/installer configuration flag, not a live state: it
     * expresses the intent that during negative market prices (see
     * {@link EnergyAppEpexSpotPrice}) the inverter's export to the grid should
     * be curtailed to 0 W, because feeding in costs money instead of earning
     * it. Whoever controls the inverter — typically the energy manager sending
     * `SetInverterFeedInLimitV1` — is responsible for honoring the flag and for
     * lifting the curtailment once prices turn positive again.
     *
     * `undefined` means "not configured" and should be treated as `false`.
     */
    blockFeedInOnNegativePrices?: boolean;
}