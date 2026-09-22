/**
 * Capabilities an inverter appliance can support.
 *
 * Declared by the owning app as a **claim** about the model, the same way every
 * other appliance type declares its `availableFeatures`. What a device actually
 * does under instruction is a separate question — see
 * {@link EnyoCalibratedFeatureEnum}.
 */
export enum EnyoInverterApplianceAvailableFeaturesEnum {
    /** The inverter's active power output can be limited. */
    PowerLimitation = 'PowerLimitation',
    /** Feed-in into the grid can be curtailed independently of production. */
    FeedInLimitation = 'FeedInLimitation',
    /** Per-DC-string values (power, voltage, current) can be read out. */
    DcStringReadout = 'DcStringReadout',
    /** Reactive power can be controlled. */
    ReactivePowerControl = 'ReactivePowerControl',
    /** The inverter reports its own AC energy meter reading. */
    EnergyMeterReadout = 'EnergyMeterReadout',
}

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

/**
 * How much trust to place in an {@link EnyoInverterIrradianceResponse}.
 *
 * The three levels form a progression: a value starts out as a `Prior` derived
 * from nameplate data, becomes `Provisional` once the first real measurements
 * have nudged it, and is only `Learned` once enough independent days of data
 * back it up.
 */
export enum EnyoInverterIrradianceResponseConfidenceEnum {
    /**
     * Derived from static installation data (peak power, orientation, typical
     * module and inverter efficiencies) without any measured production.
     */
    Prior = 'prior',
    /**
     * Fitted from measured production, but on too little data to be relied on —
     * few samples, or samples covering too narrow a range of conditions.
     */
    Provisional = 'provisional',
    /**
     * Fitted from measured production over enough samples spread across enough
     * distinct days to be used for planning.
     */
    Learned = 'learned',
}

/**
 * The inverter's measured (or assumed) response to plane-of-array irradiance:
 * how much AC power the installation produces per unit of irradiance hitting
 * the modules.
 *
 * This collapses module area, module efficiency, inverter efficiency, soiling
 * and wiring losses into a single linear coefficient, so that an irradiance
 * forecast (see `WeatherForecastEntry`) can be turned into an expected AC power
 * without knowing any of those individually:
 *
 * ```
 * expectedAcPowerW ≈ effectiveCapacityWPerWm2 * poaIrradianceWm2
 * ```
 *
 * clipped at the inverter's
 * {@link EnyoInverterApplianceMetadata.maxPvProductionW}.
 */
export interface EnyoInverterIrradianceResponse {
    /**
     * Effective capacity in Watt of AC output per W/m² of plane-of-array (POA)
     * irradiance.
     *
     * Example: a 10 kWp array producing about 8 kW at 1000 W/m² POA has an
     * effective capacity of roughly 8 W per W/m².
     */
    effectiveCapacityWPerWm2: number;
    /**
     * Tilt of the module plane in degrees against the horizontal: 0 = flat,
     * 90 = vertical. Given in degrees rather than the coarse orientation
     * description on {@link EnyoInverterModuleGroup}, because transposing an
     * irradiance forecast onto the module plane needs the actual angle.
     */
    tiltDeg?: number;
    /**
     * Azimuth of the module plane in degrees, 0 = North, 90 = East,
     * 180 = South, 270 = West. Continuous degrees, not one of the eight
     * compass sectors used elsewhere.
     */
    azimuthDeg?: number;
    /** How much this response can be trusted — see the enum for the progression. */
    confidence: EnyoInverterIrradianceResponseConfidenceEnum;
    /**
     * Number of individual measurement samples the fit is based on. `0` for a
     * pure {@link EnyoInverterIrradianceResponseConfidenceEnum.Prior}.
     */
    sampleCount: number;
    /**
     * Number of distinct calendar days the samples are spread across. Guards
     * against a fit that looks well-sampled but only ever saw a single day's
     * weather.
     */
    distinctDays: number;
    /** When this response was last (re-)computed, in ISO 8601 format. */
    learnedAtIso: string;
    /**
     * Identifier of whoever produced this response — e.g. the package or
     * algorithm name. Optional and purely informational.
     */
    learnedBy?: string;
}

export interface EnyoInverterApplianceMetadata {
    /**
     * Capabilities this inverter supports, as claimed by the owning app.
     *
     * Optional, unlike the `availableFeatures` on most other appliance types,
     * because inverters predate the field — absent means "not declared", not
     * "supports nothing".
     */
    availableFeatures?: EnyoInverterApplianceAvailableFeaturesEnum[];
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
    /**
     * Whether the energy manager may actively steer this inverter (e.g. curtail
     * production). When omitted, consumers fall back to their configured
     * default behaviour — same contract as the SDK's own `controlAllowed`.
     */
    controlAllowed?: boolean;
    /**
     * Peak power of the PV modules attached to this inverter, in Watt-peak, as
     * stated on the Anlagenpass. Distinct from `maxPvProductionW`, which is
     * what the inverter itself can put out on the AC side; together with
     * `moduleGroups` it also gives the power of a single module.
     */
    installedPeakPowerWp?: number;
    /**
     * How this installation converts plane-of-array irradiance into AC power,
     * together with the provenance of that figure.
     *
     * Additive and optional: absent means nothing is known about the
     * irradiance response and consumers should fall back to estimating from
     * {@link EnyoInverterApplianceMetadata.installedPeakPowerWp} and
     * {@link EnyoInverterApplianceMetadata.moduleGroups}.
     */
    irradianceResponse?: EnyoInverterIrradianceResponse;
}