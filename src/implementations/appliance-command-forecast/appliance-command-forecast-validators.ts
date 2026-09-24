import {
    AirConditioningForecast,
    AirConditioningForecastScheduleEntry,
    ApplianceForecastResolutionEnum,
    BatteryCommandForecast,
    BatteryCommandForecastDirectionEnum,
    BatteryCommandForecastModeEnum,
    BatteryCommandForecastScheduleEntry,
    ChargerForecast,
    ChargerForecastScheduleEntry,
    HeatingRodForecast,
    HeatingRodForecastScheduleEntry,
    HeatpumpForecast,
    HeatpumpForecastScheduleEntry,
    SmartPlugForecast,
    SmartPlugForecastScheduleEntry,
} from '../../types/enyo-appliance-command-forecast.js';
import {
    EnyoAirConditioningApplianceModeEnum,
    EnyoAirConditioningOptimizationModeEnum,
} from '../../types/enyo-air-conditioning-appliance.js';
import {EnyoAutomationTriggerTypeEnum} from '../../types/enyo-automation.js';
import {EnyoChargeModeEnum} from '../../types/enyo-data-bus-value.js';
import {EnyoSmartPlugApplianceStateEnum} from '../../types/enyo-smart-plug-appliance.js';

/**
 * Thrown when a forecast payload passed to one of the validators (or to
 * {@link EnergyAppApplianceEnergyManagerForecast.publishChargerForecast}
 * and friends) violates the invariants declared on its data interface.
 *
 * The message names the offending field / index so callers can surface it
 * directly to the user.
 */
export class ApplianceCommandForecastValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ApplianceCommandForecastValidationError';
    }
}

const TEMPERATURE_TRAJECTORY_MIN_C = -50;
const TEMPERATURE_TRAJECTORY_MAX_C = 150;

const RESOLUTION_SECONDS: Record<ApplianceForecastResolutionEnum, number> = {
    [ApplianceForecastResolutionEnum.OneMinute]: 60,
    [ApplianceForecastResolutionEnum.FifteenMinutes]: 900,
};

/**
 * Validates a {@link ChargerForecast}. Throws on the first violation —
 * the error message names the offending field / index.
 */
export function validateChargerForecast(forecast: ChargerForecast): void {
    if (!forecast || typeof forecast !== 'object') {
        throw new ApplianceCommandForecastValidationError(
            'ChargerForecast must be an object.',
        );
    }
    validateMetadata(forecast);
    if (forecast.chargeMode !== undefined) {
        const allowedModes = new Set<string>(Object.values(EnyoChargeModeEnum));
        if (!allowedModes.has(forecast.chargeMode)) {
            throw new ApplianceCommandForecastValidationError(
                `ChargerForecast.chargeMode is invalid: ${forecast.chargeMode}. Allowed values: ${Object.values(
                    EnyoChargeModeEnum,
                ).join(', ')}.`,
            );
        }
    }
    validateBooleanField(forecast.chargeActive, 'ChargerForecast.chargeActive');
    validateChargerSchedule(forecast.relativeSchedule, forecast.resolution);
}

/**
 * Validates a {@link BatteryCommandForecast}. Throws on the first
 * violation — the error message names the offending field / index.
 *
 * The forecast is a discriminated union on
 * {@link BatteryCommandForecastModeEnum}: when `mode = 'auto'` no
 * schedule is expected; when `mode = 'schedule'` the embedded
 * {@link BatteryCommandForecastScheduled.relativeSchedule} is validated
 * by {@link validateBatterySchedule}.
 */
export function validateBatteryCommandForecast(forecast: BatteryCommandForecast): void {
    if (!forecast || typeof forecast !== 'object') {
        throw new ApplianceCommandForecastValidationError(
            'BatteryCommandForecast must be an object.',
        );
    }
    validateMetadata(forecast);

    const allowedModes = new Set<string>(Object.values(BatteryCommandForecastModeEnum));
    if (!allowedModes.has(forecast.mode)) {
        throw new ApplianceCommandForecastValidationError(
            `BatteryCommandForecast.mode is invalid: ${forecast.mode}.`,
        );
    }

    if (forecast.mode === BatteryCommandForecastModeEnum.Auto) {
        if ((forecast as { relativeSchedule?: unknown }).relativeSchedule !== undefined) {
            throw new ApplianceCommandForecastValidationError(
                "BatteryCommandForecast with mode='auto' must not carry a relativeSchedule.",
            );
        }
        return;
    }

    validateBatterySchedule(forecast.relativeSchedule, forecast.resolution);
}

/**
 * Validates a {@link HeatpumpForecast}. Throws on the first violation —
 * the error message names the offending field / index.
 *
 * The forecast carries a single unified relative schedule; every entry
 * is validated by {@link validateHeatpumpScheduleEntry}.
 */
export function validateHeatpumpForecast(forecast: HeatpumpForecast): void {
    if (!forecast || typeof forecast !== 'object') {
        throw new ApplianceCommandForecastValidationError(
            'HeatpumpForecast must be an object.',
        );
    }
    validateMetadata(forecast);
    validateHeatpumpSchedule(forecast.relativeSchedule, forecast.resolution);
}

/**
 * Validates a charger relative schedule (the inner schedule used by
 * {@link ChargerForecast.relativeSchedule}). The `resolution` argument
 * is the value declared on
 * {@link ApplianceForecastMetadata.resolution}; consecutive entries'
 * `seconds` must be spaced by exactly that many seconds.
 */
export function validateChargerSchedule(
    entries: ChargerForecastScheduleEntry[],
    resolution: ApplianceForecastResolutionEnum,
): void {
    const stepSeconds = resolveResolutionSeconds(resolution);
    validateNonEmptySchedule(entries, 'relativeSchedule');
    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i]!;
        validateSecondsField(entry.seconds, `relativeSchedule[${i}].seconds`);
        validatePowerW(entry.powerW, `relativeSchedule[${i}].powerW`);
        if (entry.priceCtPerKwh !== undefined && !Number.isFinite(entry.priceCtPerKwh)) {
            throw new ApplianceCommandForecastValidationError(
                `relativeSchedule[${i}].priceCtPerKwh=${entry.priceCtPerKwh} must be a finite number when provided (a negative price is legitimate; a non-number is not).`,
            );
        }
        if (entry.numberOfPhases !== undefined && ![1, 2, 3].includes(entry.numberOfPhases)) {
            throw new ApplianceCommandForecastValidationError(
                `relativeSchedule[${i}].numberOfPhases must be 1, 2, or 3; got ${entry.numberOfPhases}.`,
            );
        }
    }
    validateFirstEntryStartsAtZero(entries[0]!.seconds, 'relativeSchedule');
    validateSecondsMatchResolution(entries.map((e) => e.seconds), stepSeconds, 'relativeSchedule');
}

/**
 * Validates a battery relative schedule (the inner schedule used by
 * {@link BatteryCommandForecastScheduled.relativeSchedule}). The
 * `resolution` argument is the value declared on
 * {@link ApplianceForecastMetadata.resolution}; consecutive entries'
 * `seconds` must be spaced by exactly that many seconds.
 */
export function validateBatterySchedule(
    entries: BatteryCommandForecastScheduleEntry[],
    resolution: ApplianceForecastResolutionEnum,
): void {
    const stepSeconds = resolveResolutionSeconds(resolution);
    validateNonEmptySchedule(entries, 'relativeSchedule');
    const allowedDirections = new Set<string>(
        Object.values(BatteryCommandForecastDirectionEnum),
    );
    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i]!;
        validateSecondsField(entry.seconds, `relativeSchedule[${i}].seconds`);
        validatePowerW(entry.powerW, `relativeSchedule[${i}].powerW`);
        if (!allowedDirections.has(entry.direction)) {
            throw new ApplianceCommandForecastValidationError(
                `relativeSchedule[${i}].direction is invalid: ${entry.direction}.`,
            );
        }
        if (
            entry.direction === BatteryCommandForecastDirectionEnum.Idle
            && entry.powerW !== 0
        ) {
            throw new ApplianceCommandForecastValidationError(
                `relativeSchedule[${i}].powerW must be 0 when direction is '${BatteryCommandForecastDirectionEnum.Idle}'; got ${entry.powerW}.`,
            );
        }
    }
    validateFirstEntryStartsAtZero(entries[0]!.seconds, 'relativeSchedule');
    validateSecondsMatchResolution(entries.map((e) => e.seconds), stepSeconds, 'relativeSchedule');
}

/**
 * Validates a heatpump unified relative schedule (the schedule used by
 * {@link HeatpumpForecast.relativeSchedule}). Enforces that the
 * schedule is non-empty, starts at `seconds = 0`, has entries spaced
 * by exactly `resolution`, and that every per-entry value falls in the
 * plausible range documented on
 * {@link HeatpumpForecastScheduleEntry}.
 */
export function validateHeatpumpSchedule(
    entries: HeatpumpForecastScheduleEntry[],
    resolution: ApplianceForecastResolutionEnum,
): void {
    const stepSeconds = resolveResolutionSeconds(resolution);
    validateNonEmptySchedule(entries, 'relativeSchedule');
    for (let i = 0; i < entries.length; i++) {
        validateHeatpumpScheduleEntry(entries[i]!, `relativeSchedule[${i}]`);
    }
    validateFirstEntryStartsAtZero(entries[0]!.seconds, 'relativeSchedule');
    validateSecondsMatchResolution(entries.map((e) => e.seconds), stepSeconds, 'relativeSchedule');
}

/**
 * Validates a single {@link HeatpumpForecastScheduleEntry}. Used by
 * {@link validateHeatpumpSchedule} and exposed for callers that build
 * entries incrementally.
 */
export function validateHeatpumpScheduleEntry(
    entry: HeatpumpForecastScheduleEntry,
    fieldName: string,
): void {
    validateSecondsField(entry.seconds, `${fieldName}.seconds`);
    if (entry.powerW !== undefined) {
        validatePowerW(entry.powerW, `${fieldName}.powerW`);
    }
    validateTemperatureField(entry.dhwTemperatureC, `${fieldName}.dhwTemperatureC`);
    validateTemperatureField(entry.roomTemperatureC, `${fieldName}.roomTemperatureC`);
    validateTemperatureField(
        entry.bufferTankTemperatureC,
        `${fieldName}.bufferTankTemperatureC`,
    );
    validateBooleanField(entry.dhwBoostActive, `${fieldName}.dhwBoostActive`);
    validateBooleanField(entry.roomPreHeatingActive, `${fieldName}.roomPreHeatingActive`);
    validateBooleanField(entry.bufferTankBoostActive, `${fieldName}.bufferTankBoostActive`);
    validateBooleanField(entry.availablePowerActive, `${fieldName}.availablePowerActive`);
}

/**
 * Validates a {@link HeatingRodForecast}. Throws on the first violation —
 * the error message names the offending field / index.
 *
 * The forecast carries a single relative schedule; every entry is
 * validated by {@link validateHeatingRodScheduleEntry}.
 */
export function validateHeatingRodForecast(forecast: HeatingRodForecast): void {
    if (!forecast || typeof forecast !== 'object') {
        throw new ApplianceCommandForecastValidationError(
            'HeatingRodForecast must be an object.',
        );
    }
    validateMetadata(forecast);
    validateHeatingRodSchedule(forecast.relativeSchedule, forecast.resolution);
}

/**
 * Validates a heating rod relative schedule (the schedule used by
 * {@link HeatingRodForecast.relativeSchedule}). Enforces that the
 * schedule is non-empty, starts at `seconds = 0`, has entries spaced by
 * exactly `resolution`, and that every per-entry value falls in the
 * plausible range documented on {@link HeatingRodForecastScheduleEntry}.
 */
export function validateHeatingRodSchedule(
    entries: HeatingRodForecastScheduleEntry[],
    resolution: ApplianceForecastResolutionEnum,
): void {
    const stepSeconds = resolveResolutionSeconds(resolution);
    validateNonEmptySchedule(entries, 'relativeSchedule');
    for (let i = 0; i < entries.length; i++) {
        validateHeatingRodScheduleEntry(entries[i]!, `relativeSchedule[${i}]`);
    }
    validateFirstEntryStartsAtZero(entries[0]!.seconds, 'relativeSchedule');
    validateSecondsMatchResolution(entries.map((e) => e.seconds), stepSeconds, 'relativeSchedule');
}

/**
 * Validates a single {@link HeatingRodForecastScheduleEntry}. Used by
 * {@link validateHeatingRodSchedule} and exposed for callers that build
 * entries incrementally.
 */
export function validateHeatingRodScheduleEntry(
    entry: HeatingRodForecastScheduleEntry,
    fieldName: string,
): void {
    validateSecondsField(entry.seconds, `${fieldName}.seconds`);
    if (entry.powerW !== undefined) {
        validatePowerW(entry.powerW, `${fieldName}.powerW`);
    }
    validateTemperatureField(entry.temperatureC, `${fieldName}.temperatureC`);
    validateBooleanField(entry.heatingActive, `${fieldName}.heatingActive`);
    validateBooleanField(entry.availablePowerActive, `${fieldName}.availablePowerActive`);
}

/**
 * Validates a {@link SmartPlugForecast}. Throws on the first violation —
 * the error message names the offending field / index.
 *
 * The forecast carries a single relative schedule of on/off slots; every
 * entry is validated by {@link validateSmartPlugScheduleEntry}.
 */
export function validateSmartPlugForecast(forecast: SmartPlugForecast): void {
    if (!forecast || typeof forecast !== 'object') {
        throw new ApplianceCommandForecastValidationError(
            'SmartPlugForecast must be an object.',
        );
    }
    validateMetadata(forecast);
    validateChannelOrRoomIndex(forecast.channelIndex, 'SmartPlugForecast.channelIndex');
    validateSmartPlugSchedule(forecast.relativeSchedule, forecast.resolution);
}

/**
 * Validates a smart plug relative schedule (the schedule used by
 * {@link SmartPlugForecast.relativeSchedule}). Enforces that the
 * schedule is non-empty, starts at `seconds = 0`, has entries spaced by
 * exactly `resolution`, and that every per-entry value satisfies the
 * invariants documented on {@link SmartPlugForecastScheduleEntry}.
 */
export function validateSmartPlugSchedule(
    entries: SmartPlugForecastScheduleEntry[],
    resolution: ApplianceForecastResolutionEnum,
): void {
    const stepSeconds = resolveResolutionSeconds(resolution);
    validateNonEmptySchedule(entries, 'relativeSchedule');
    for (let i = 0; i < entries.length; i++) {
        validateSmartPlugScheduleEntry(entries[i]!, `relativeSchedule[${i}]`);
    }
    validateFirstEntryStartsAtZero(entries[0]!.seconds, 'relativeSchedule');
    validateSecondsMatchResolution(entries.map((e) => e.seconds), stepSeconds, 'relativeSchedule');
}

/**
 * Validates a single {@link SmartPlugForecastScheduleEntry}. Used by
 * {@link validateSmartPlugSchedule} and exposed for callers that build
 * entries incrementally.
 *
 * `state` is mandatory (a plug slot without a relay state carries no
 * command); `triggerType`, when present, must be one of the
 * {@link EnyoAutomationTriggerTypeEnum} members so consumers can switch
 * on it exhaustively.
 */
export function validateSmartPlugScheduleEntry(
    entry: SmartPlugForecastScheduleEntry,
    fieldName: string,
): void {
    validateSecondsField(entry.seconds, `${fieldName}.seconds`);
    validateEnumField(
        entry.state,
        Object.values(EnyoSmartPlugApplianceStateEnum),
        `${fieldName}.state`,
        true,
    );
    validateEnumField(
        entry.triggerType,
        Object.values(EnyoAutomationTriggerTypeEnum),
        `${fieldName}.triggerType`,
        false,
    );
    if (entry.automationId !== undefined) {
        if (typeof entry.automationId !== 'string' || entry.automationId.length === 0) {
            throw new ApplianceCommandForecastValidationError(
                `${fieldName}.automationId must be a non-empty string when provided.`,
            );
        }
    }
    if (entry.powerW !== undefined) {
        validatePowerW(entry.powerW, `${fieldName}.powerW`);
    }
    validateBooleanField(entry.minDurationHold, `${fieldName}.minDurationHold`);
}

/**
 * Validates an {@link AirConditioningForecast}. Throws on the first
 * violation — the error message names the offending field / index.
 *
 * The forecast carries a single relative schedule; every entry is
 * validated by {@link validateAirConditioningScheduleEntry}.
 */
export function validateAirConditioningForecast(forecast: AirConditioningForecast): void {
    if (!forecast || typeof forecast !== 'object') {
        throw new ApplianceCommandForecastValidationError(
            'AirConditioningForecast must be an object.',
        );
    }
    validateMetadata(forecast);
    validateChannelOrRoomIndex(forecast.roomIndex, 'AirConditioningForecast.roomIndex');
    validateAirConditioningSchedule(forecast.relativeSchedule, forecast.resolution);
}

/**
 * Validates an air conditioning relative schedule (the schedule used by
 * {@link AirConditioningForecast.relativeSchedule}). Enforces that the
 * schedule is non-empty, starts at `seconds = 0`, has entries spaced by
 * exactly `resolution`, and that every per-entry value falls in the
 * plausible range documented on
 * {@link AirConditioningForecastScheduleEntry}.
 */
export function validateAirConditioningSchedule(
    entries: AirConditioningForecastScheduleEntry[],
    resolution: ApplianceForecastResolutionEnum,
): void {
    const stepSeconds = resolveResolutionSeconds(resolution);
    validateNonEmptySchedule(entries, 'relativeSchedule');
    for (let i = 0; i < entries.length; i++) {
        validateAirConditioningScheduleEntry(entries[i]!, `relativeSchedule[${i}]`);
    }
    validateFirstEntryStartsAtZero(entries[0]!.seconds, 'relativeSchedule');
    validateSecondsMatchResolution(entries.map((e) => e.seconds), stepSeconds, 'relativeSchedule');
}

/**
 * Validates a single {@link AirConditioningForecastScheduleEntry}. Used
 * by {@link validateAirConditioningSchedule} and exposed for callers
 * that build entries incrementally.
 */
export function validateAirConditioningScheduleEntry(
    entry: AirConditioningForecastScheduleEntry,
    fieldName: string,
): void {
    validateSecondsField(entry.seconds, `${fieldName}.seconds`);
    if (entry.powerW !== undefined) {
        validatePowerW(entry.powerW, `${fieldName}.powerW`);
    }
    validateEnumField(
        entry.mode,
        Object.values(EnyoAirConditioningApplianceModeEnum),
        `${fieldName}.mode`,
        false,
    );
    validateEnumField(
        entry.optimizationMode,
        Object.values(EnyoAirConditioningOptimizationModeEnum),
        `${fieldName}.optimizationMode`,
        false,
    );
    validateTemperatureField(entry.targetTemperatureC, `${fieldName}.targetTemperatureC`);
    validateTemperatureField(entry.roomTemperatureC, `${fieldName}.roomTemperatureC`);
    validateBooleanField(entry.availablePowerActive, `${fieldName}.availablePowerActive`);
}

function validateMetadata(forecast: {
    resolution: ApplianceForecastResolutionEnum;
    estimatedSavings?: { currency: string; costSavings: number };
}): void {
    if (!(forecast.resolution in RESOLUTION_SECONDS)) {
        throw new ApplianceCommandForecastValidationError(
            `resolution is invalid: ${forecast.resolution}. Allowed values: ${Object.values(
                ApplianceForecastResolutionEnum,
            ).join(', ')}.`,
        );
    }
    if (forecast.estimatedSavings !== undefined) {
        const savings = forecast.estimatedSavings;
        if (typeof savings.currency !== 'string' || savings.currency.length === 0) {
            throw new ApplianceCommandForecastValidationError(
                'estimatedSavings.currency must be a non-empty string.',
            );
        }
        if (!Number.isFinite(savings.costSavings)) {
            throw new ApplianceCommandForecastValidationError(
                `estimatedSavings.costSavings must be a finite number; got ${savings.costSavings}.`,
            );
        }
    }
}

function resolveResolutionSeconds(
    resolution: ApplianceForecastResolutionEnum,
): number {
    const step = RESOLUTION_SECONDS[resolution];
    if (step === undefined) {
        throw new ApplianceCommandForecastValidationError(
            `resolution is invalid: ${resolution}. Allowed values: ${Object.values(
                ApplianceForecastResolutionEnum,
            ).join(', ')}.`,
        );
    }
    return step;
}

function validateNonEmptySchedule(entries: unknown, fieldName: string): void {
    if (!Array.isArray(entries) || entries.length === 0) {
        throw new ApplianceCommandForecastValidationError(
            `${fieldName} must contain at least one entry.`,
        );
    }
}

function validateSecondsField(seconds: number, fieldName: string): void {
    if (!Number.isFinite(seconds) || seconds < 0) {
        throw new ApplianceCommandForecastValidationError(
            `${fieldName}=${seconds} must be a finite non-negative number.`,
        );
    }
}

function validatePowerW(powerW: number, fieldName: string): void {
    if (!Number.isFinite(powerW) || powerW < 0) {
        throw new ApplianceCommandForecastValidationError(
            `${fieldName}=${powerW} must be a finite non-negative number.`,
        );
    }
}

function validateTemperatureField(value: number | undefined, fieldName: string): void {
    if (value === undefined) {
        return;
    }
    if (
        !Number.isFinite(value) ||
        value < TEMPERATURE_TRAJECTORY_MIN_C ||
        value > TEMPERATURE_TRAJECTORY_MAX_C
    ) {
        throw new ApplianceCommandForecastValidationError(
            `${fieldName}=${value} is outside the plausible range [${TEMPERATURE_TRAJECTORY_MIN_C}, ${TEMPERATURE_TRAJECTORY_MAX_C}].`,
        );
    }
}

function validateBooleanField(value: boolean | undefined, fieldName: string): void {
    if (value === undefined) {
        return;
    }
    if (typeof value !== 'boolean') {
        throw new ApplianceCommandForecastValidationError(
            `${fieldName} must be a boolean when provided; got ${typeof value}.`,
        );
    }
}

function validateFirstEntryStartsAtZero(firstSeconds: number, fieldName: string): void {
    if (firstSeconds !== 0) {
        throw new ApplianceCommandForecastValidationError(
            `${fieldName}[0].seconds must be 0 (got ${firstSeconds}); the receiving appliance needs an authoritative "right now" setpoint.`,
        );
    }
}

function validateSecondsMatchResolution(
    secondsList: number[],
    stepSeconds: number,
    fieldName: string,
): void {
    for (let i = 1; i < secondsList.length; i++) {
        const delta = secondsList[i]! - secondsList[i - 1]!;
        if (delta !== stepSeconds) {
            throw new ApplianceCommandForecastValidationError(
                `${fieldName}[${i}].seconds (${secondsList[i]}) must be exactly ${stepSeconds}s after the previous entry (${secondsList[i - 1]}); got delta=${delta}s. The forecast's resolution determines the required step.`,
            );
        }
    }
}

function validateEnumField(
    value: string | undefined,
    allowedValues: string[],
    fieldName: string,
    required: boolean,
): void {
    if (value === undefined) {
        if (required) {
            throw new ApplianceCommandForecastValidationError(
                `${fieldName} is required. Allowed values: ${allowedValues.join(', ')}.`,
            );
        }
        return;
    }
    if (!allowedValues.includes(value)) {
        throw new ApplianceCommandForecastValidationError(
            `${fieldName} is invalid: ${value}. Allowed values: ${allowedValues.join(', ')}.`,
        );
    }
}

function validateChannelOrRoomIndex(value: number | undefined, fieldName: string): void {
    if (value === undefined) {
        return;
    }
    if (!Number.isInteger(value) || value < 0) {
        throw new ApplianceCommandForecastValidationError(
            `${fieldName}=${value} must be a non-negative integer when provided.`,
        );
    }
}
