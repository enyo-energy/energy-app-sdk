import type {EnyoHeatpumpControlAreaEnum} from './enyo-heatpump-appliance.js';
import type {EnyoLegionellaSlot} from './enyo-legionella.js';

/**
 * What an {@link EnyoHeatpumpRecommendation} proposes. Each type belongs to
 * exactly one {@link EnyoHeatpumpControlAreaEnum | area} and carries its own
 * `params`.
 */
export enum EnyoHeatpumpRecommendationTypeEnum {
    /** Heat domestic hot water in the solar window. Area {@link EnyoHeatpumpControlAreaEnum.SolarHotWater}. */
    SolarHotWaterBoost = 'solar-hot-water-boost',
    /** Pre-heat before heating starts. Area {@link EnyoHeatpumpControlAreaEnum.CostOptimizedHeating}. */
    PreHeat = 'pre-heat',
    /** Lower the heating curve of a heating circuit. Area {@link EnyoHeatpumpControlAreaEnum.HeatingCurve}. */
    HeatingCurveLowering = 'heating-curve-lowering',
    /**
     * Move the weekly legionella program to a better slot. Area
     * {@link EnyoHeatpumpControlAreaEnum.LegionellaProgram}. The only type a
     * heating rod gets.
     */
    LegionellaProgramShift = 'legionella-program-shift',
}

/**
 * Why the energy manager recommends something — the category the app shows
 * for an {@link EnyoHeatpumpRecommendation}.
 */
export enum EnyoHeatpumpRecommendationCauseEnum {
    /** Solar power is expected that would otherwise be fed into the grid. */
    SolarSurplus = 'solar-surplus',
    /** Cold weather is coming. */
    ColdWeather = 'cold-weather',
    /** Electricity is cheap in some hours. */
    CheapHours = 'cheap-hours',
    /** The rooms are warm enough to need less heat. */
    RoomsWarmEnough = 'rooms-warm-enough',
}

/**
 * The customer's answer to an {@link EnyoHeatpumpRecommendation}, sent with
 * {@link EnyoDataBusHeatpumpRecommendationAnswerV1}.
 */
export enum EnyoHeatpumpRecommendationAnswerEnum {
    /** Carry it out — see {@link EnyoHeatpumpRecommendationExecutionEnum}. */
    Accept = 'accept',
    /** The customer does not want it. Nothing runs and no status follows. */
    Reject = 'reject',
}

/**
 * What accepting an {@link EnyoHeatpumpRecommendation} does
 * ({@link EnyoDataBusHeatpumpRecommendationAnswerV1}).
 */
export enum EnyoHeatpumpRecommendationExecutionEnum {
    /**
     * The energy manager carries it out once inside
     * {@link EnyoHeatpumpRecommendationBase.window}; afterwards everything runs
     * as before.
     */
    OneTime = 'one-time',
    /**
     * The energy manager applies it and holds it until it is reset — the
     * heating curve on a heat pump declaring
     * {@link EnyoHeatpumpApplianceAvailableFeaturesEnum.HeatingCurveOffset},
     * or a legionella slot on an appliance declaring `LegionellaSchedule`.
     */
    Permanent = 'permanent',
    /**
     * The customer changes it on the device. Accepting means "I did it on the
     * device"; the energy manager computes with the new state from then on.
     */
    Manual = 'manual',
}

/** The unit of {@link EnyoHeatpumpRecommendationBenefit.value}. */
export enum EnyoHeatpumpRecommendationBenefitKindEnum {
    /** Solar power used in addition, in kWh. */
    SolarEnergyKwh = 'solar-energy-kwh',
    /** Less electricity used, in percent (0–100). */
    LessElectricityPercent = 'less-electricity-percent',
}

/** What a {@link EnyoHeatpumpRecommendationTypeEnum.PreHeat} recommendation heats. */
export enum EnyoHeatpumpPreHeatTargetEnum {
    /** The heating buffer tank. Same value as {@link EnyoHeatpumpControlTargetEnum.BufferTank}. */
    BufferTank = 'buffer-tank',
    /** The rooms of a heating circuit. Same value as {@link EnyoHeatpumpControlTargetEnum.Room}. */
    Room = 'room',
    /**
     * Whatever the heat pump chooses, by announcing available power
     * ({@link EnyoHeatpumpApplianceAvailableFeaturesEnum.PvSurplusSignal} /
     * {@link EnyoHeatpumpApplianceAvailableFeaturesEnum.AvailablePowerAnnouncement}).
     */
    AvailablePower = 'available-power',
}

/**
 * Where an accepted {@link EnyoHeatpumpRecommendation} stands, reported with
 * {@link EnyoDataBusHeatpumpRecommendationStatusV1}.
 *
 * `Accepted` and `Active` are intermediate; `Completed`, `Reset`, `Rejected`
 * and `Aborted` are final — no further status follows for that acceptance.
 */
export enum EnyoHeatpumpRecommendationStateEnum {
    /** Accepted, waiting for its window. */
    Accepted = 'accepted',
    /**
     * In effect right now. `activeUntilIso` is set for
     * {@link EnyoHeatpumpRecommendationExecutionEnum.OneTime}, and omitted for
     * {@link EnyoHeatpumpRecommendationExecutionEnum.Permanent} /
     * {@link EnyoHeatpumpRecommendationExecutionEnum.Manual}, which last until reset.
     */
    Active = 'active',
    /** Done; the heat pump runs as before again. Final. */
    Completed = 'completed',
    /** Ended by {@link EnyoDataBusResetHeatpumpRecommendationV1}. Final. */
    Reset = 'reset',
    /** Refused and never started. See the stop reason. Final. */
    Rejected = 'rejected',
    /** Started but ended early. See the stop reason. Final. */
    Aborted = 'aborted',
}

/**
 * Why an accepted {@link EnyoHeatpumpRecommendation} was
 * {@link EnyoHeatpumpRecommendationStateEnum.Rejected} or
 * {@link EnyoHeatpumpRecommendationStateEnum.Aborted}.
 */
export enum EnyoHeatpumpRecommendationStopReasonEnum {
    /** The energy manager does not know a recommendation with this id. */
    NotFound = 'not-found',
    /** Its `validUntilIso` (or its window) has passed. */
    Expired = 'expired',
    /** Checked again before acting, it no longer holds (e.g. the forecast changed). */
    NoLongerValid = 'no-longer-valid',
    /** Its area was switched to {@link EnyoHeatpumpControlModeEnum.Off} meanwhile. */
    ModeOff = 'mode-off',
    /** The heat pump is offline / unreachable. */
    ApplianceOffline = 'appliance-offline',
    /** The heat pump refused or cannot carry out the control it needs. */
    ControlNotPossible = 'control-not-possible',
    /** A newer recommendation for the same heat pump and area replaced it. */
    Superseded = 'superseded',
    /**
     * The owner changed the setting on the device meanwhile — e.g. set another
     * legionella slot by hand ({@link reconcileLegionellaProgram}).
     */
    ChangedOnDevice = 'changed-on-device',
    /** The device ran it but it did not succeed, e.g. a legionella run that did not reach its temperature. */
    Failed = 'failed',
}

/** A time window, as two ISO 8601 timestamps. */
export interface EnyoHeatpumpRecommendationTimeWindow {
    /** Inclusive start, ISO 8601. */
    startIso: string;
    /** Exclusive end, ISO 8601. Later than {@link startIso}. */
    endIso: string;
}

/** What an {@link EnyoHeatpumpRecommendation} gains — a number the app turns into text. */
export interface EnyoHeatpumpRecommendationBenefit {
    /** The unit of {@link value}. */
    kind: EnyoHeatpumpRecommendationBenefitKindEnum;
    /**
     * Finite and greater than `0`; at most `100` for
     * {@link EnyoHeatpumpRecommendationBenefitKindEnum.LessElectricityPercent}.
     */
    value: number;
}

/**
 * The timeline "so far / sun / new" the app draws for an
 * {@link EnyoHeatpumpRecommendation}.
 */
export interface EnyoHeatpumpRecommendationTimeline {
    /**
     * When the heat pump runs today, without the recommendation. Optional,
     * since the energy manager does not always know it (e.g. the
     * domestic-hot-water time program).
     */
    baseline?: EnyoHeatpumpRecommendationTimeWindow[];
    /** The solar window, when the recommendation is about solar power. */
    solar?: EnyoHeatpumpRecommendationTimeWindow;
    /** When the heat pump would run with the recommendation. */
    proposed: EnyoHeatpumpRecommendationTimeWindow[];
}

/**
 * The fields every {@link EnyoHeatpumpRecommendation} has, whatever its
 * {@link EnyoHeatpumpRecommendationTypeEnum | type}.
 *
 * **No texts.** The energy manager sends type and parameters, the app builds
 * the texts from them — nothing is localised on the device. There are no
 * fields for a title or description, and no amounts of money.
 */
export interface EnyoHeatpumpRecommendationBase {
    /**
     * Built **deterministically** by the energy manager from the heat pump,
     * the type and the window — or, for the heating curve, the circuit and the
     * step. The same recommendation keeps the same id across evaluations; the
     * host remembers the customer's decision (later, dismissed) by it.
     */
    id: string;
    /** The area this recommendation belongs to; fixed by the {@link EnyoHeatpumpRecommendation | type}. */
    area: EnyoHeatpumpControlAreaEnum;
    /** What it proposes. */
    type: EnyoHeatpumpRecommendationTypeEnum;
    /** Why — the category the app shows. */
    cause: EnyoHeatpumpRecommendationCauseEnum;
    /** What accepting it does; fixed or narrowed by the type. */
    execution: EnyoHeatpumpRecommendationExecutionEnum;
    /**
     * When it takes effect. Required for
     * {@link EnyoHeatpumpRecommendationExecutionEnum.OneTime}.
     */
    window?: EnyoHeatpumpRecommendationTimeWindow;
    /** After this ISO 8601 timestamp the recommendation has expired and can no longer be accepted. */
    validUntilIso: string;
    /** What it gains. */
    benefit: EnyoHeatpumpRecommendationBenefit;
    /** Data for the timeline "so far / sun / new". */
    timeline?: EnyoHeatpumpRecommendationTimeline;
    /**
     * Security of supply in °C, e.g. "the tank does not fall below 42 °C".
     * Omitted when there is nothing to promise.
     */
    floorTemperatureC?: number;
}

/** The parameters of a {@link EnyoHeatpumpRecommendationTypeEnum.SolarHotWaterBoost}. */
export interface EnyoHeatpumpSolarHotWaterBoostParams {
    /** The domestic-hot-water temperature in °C to heat to. */
    targetTemperatureC: number;
}

/** The parameters of a {@link EnyoHeatpumpRecommendationTypeEnum.PreHeat}. */
export interface EnyoHeatpumpPreHeatParams {
    /** What is pre-heated. */
    target: EnyoHeatpumpPreHeatTargetEnum;
    /** The temperature in °C to pre-heat to, when the target has one. */
    targetTemperatureC?: number;
    /** How far the target is raised, in Kelvin, when that is the clearer number. */
    deltaK?: number;
    /** The outdoor temperature in °C expected at {@link heatingOnsetIso}, when that is the cause. */
    outdoorTemperatureC?: number;
    /** When heating would start without the recommendation, ISO 8601. */
    heatingOnsetIso: string;
}

/** The parameters of a {@link EnyoHeatpumpRecommendationTypeEnum.HeatingCurveLowering}. */
export interface EnyoHeatpumpHeatingCurveLoweringParams {
    /** The {@link EnyoHeatpumpApplianceHeatingCircuit.index} of the circuit. */
    heatingCircuitIndex: number;
    /**
     * The target offset in Kelvin of flow temperature relative to the
     * circuit's {@link EnyoHeatpumpApplianceHeatingCircuit.initialHeatingCurve}.
     * Negative, and at least
     * `-`{@link HEATPUMP_CURVE_OPTIMIZATION_MAX_LOWERING_K}. On the circuit's
     * step grid ({@link EnyoHeatpumpHeatingCurveOffsetRange.stepK}) when it
     * declares one, also for `Manual` — the customer can only set whole steps.
     */
    offsetK: number;
    /** The offset in Kelvin currently in effect, same reference as {@link offsetK}. */
    currentOffsetK: number;
}

/** The parameters of a {@link EnyoHeatpumpRecommendationTypeEnum.LegionellaProgramShift}. */
export interface EnyoLegionellaProgramShiftParams {
    /**
     * {@link EnyoHeatpumpApplianceDomesticHotWater.index} of the heat pump's
     * zone. Omitted for a heating rod and for the first (or only) zone.
     */
    domesticHotWaterIndex?: number;
    /** The slot the device holds now — usually the owner's. */
    currentSlot: EnyoLegionellaSlot;
    /** The proposed slot. Differs from {@link currentSlot}. */
    proposedSlot: EnyoLegionellaSlot;
    /**
     * When the next run would start with {@link proposedSlot}, ISO 8601. For
     * {@link EnyoHeatpumpRecommendationExecutionEnum.OneTime} it lies inside
     * the recommendation's `window`.
     */
    nextRunIso: string;
    /** The temperature the run heats to, in °C, when known. */
    targetTemperatureC?: number;
}

/** Heat domestic hot water in the solar window — carried out once. */
export interface EnyoHeatpumpSolarHotWaterBoostRecommendation extends EnyoHeatpumpRecommendationBase {
    type: EnyoHeatpumpRecommendationTypeEnum.SolarHotWaterBoost;
    area: EnyoHeatpumpControlAreaEnum.SolarHotWater;
    execution: EnyoHeatpumpRecommendationExecutionEnum.OneTime;
    window: EnyoHeatpumpRecommendationTimeWindow;
    params: EnyoHeatpumpSolarHotWaterBoostParams;
}

/** Pre-heat before heating starts — carried out once. */
export interface EnyoHeatpumpPreHeatRecommendation extends EnyoHeatpumpRecommendationBase {
    type: EnyoHeatpumpRecommendationTypeEnum.PreHeat;
    area: EnyoHeatpumpControlAreaEnum.CostOptimizedHeating;
    execution: EnyoHeatpumpRecommendationExecutionEnum.OneTime;
    window: EnyoHeatpumpRecommendationTimeWindow;
    params: EnyoHeatpumpPreHeatParams;
}

/**
 * Lower the heating curve of a circuit — applied and held by the energy
 * manager ({@link EnyoHeatpumpRecommendationExecutionEnum.Permanent}, needs
 * {@link EnyoHeatpumpApplianceAvailableFeaturesEnum.HeatingCurveOffset}), or
 * changed by the customer on the device
 * ({@link EnyoHeatpumpRecommendationExecutionEnum.Manual}).
 */
export interface EnyoHeatpumpHeatingCurveLoweringRecommendation extends EnyoHeatpumpRecommendationBase {
    type: EnyoHeatpumpRecommendationTypeEnum.HeatingCurveLowering;
    area: EnyoHeatpumpControlAreaEnum.HeatingCurve;
    execution: EnyoHeatpumpRecommendationExecutionEnum.Permanent | EnyoHeatpumpRecommendationExecutionEnum.Manual;
    params: EnyoHeatpumpHeatingCurveLoweringParams;
}

/**
 * Move the weekly legionella program of a heat pump's hot water zone or a
 * heating rod to a better slot. By `execution`:
 * - {@link EnyoHeatpumpRecommendationExecutionEnum.OneTime}: the energy manager
 *   moves only the next run (inside `window`) and puts the owner's slot back
 *   afterwards. Needs the feature `LegionellaSchedule`.
 * - {@link EnyoHeatpumpRecommendationExecutionEnum.Permanent}: the energy
 *   manager writes {@link EnyoLegionellaProgramShiftParams.proposedSlot} and
 *   holds it until reset; a reset puts the owner's slot back. Needs the
 *   feature `LegionellaSchedule`.
 * - {@link EnyoHeatpumpRecommendationExecutionEnum.Manual}: the customer sets
 *   the new slot on the device — for devices without the feature.
 */
export interface EnyoLegionellaProgramShiftRecommendation extends EnyoHeatpumpRecommendationBase {
    type: EnyoHeatpumpRecommendationTypeEnum.LegionellaProgramShift;
    area: EnyoHeatpumpControlAreaEnum.LegionellaProgram;
    execution:
        | EnyoHeatpumpRecommendationExecutionEnum.OneTime
        | EnyoHeatpumpRecommendationExecutionEnum.Permanent
        | EnyoHeatpumpRecommendationExecutionEnum.Manual;
    params: EnyoLegionellaProgramShiftParams;
}

/**
 * One open proposal of the energy manager for a heat pump, sent in
 * {@link EnyoDataBusHeatpumpRecommendationsV1}. A discriminated union over
 * `type`: narrowing on it types `area`, `execution`, `window` and `params`.
 *
 * Validate with {@link validateHeatpumpRecommendation}.
 */
export type EnyoHeatpumpRecommendation =
    | EnyoHeatpumpSolarHotWaterBoostRecommendation
    | EnyoHeatpumpPreHeatRecommendation
    | EnyoHeatpumpHeatingCurveLoweringRecommendation
    | EnyoLegionellaProgramShiftRecommendation;
