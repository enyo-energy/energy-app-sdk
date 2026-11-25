/**
 * Pure helpers for `SetHeatpumpHeatingCurveOffsetV1`: shifting a heating curve
 * by an offset, reading a flow temperature off a curve, rounding an offset to
 * a device's step grid, and telling whether someone changed the curve on the
 * device by hand.
 *
 * No I/O — persisting the initial curve is done with
 * `ApplianceManager.rememberHeatpumpInitialHeatingCurve` /
 * `ApplianceManager.clearHeatpumpInitialHeatingCurve`.
 */

import type {
    EnyoHeatpumpApplianceHeatingCurve,
    EnyoHeatpumpApplianceHeatingCurvePoint,
    EnyoHeatpumpHeatingCurveOffsetRange,
} from '../../types/enyo-heatpump-appliance.js';

/**
 * How far an offset may be from a multiple of
 * {@link EnyoHeatpumpHeatingCurveOffsetRange.stepK} and still count as on the
 * grid — only absorbs floating point noise (e.g. `3 × 0.1`).
 */
const STEP_EPSILON_K = 1e-6;

/** How {@link roundHeatingCurveOffsetToStep} rounds an offset that lies between two steps. */
export enum EnyoHeatingCurveOffsetRoundingEnum {
    /** To the closest step; exactly halfway rounds away from `0`. */
    Nearest = 'nearest',
    /** To the step closer to `0` — never shifts further than asked. */
    TowardZero = 'toward-zero',
    /** To the step further from `0` — always shifts at least as far as asked. */
    AwayFromZero = 'away-from-zero',
}

/**
 * Whether `offsetK` lies on the step grid of a circuit
 * ({@link EnyoHeatpumpHeatingCurveOffsetRange.stepK}). Always `true` when the
 * range has no `stepK`, or no range is given. `0` is always on the grid.
 *
 * @param offsetK - The offset in K of flow temperature.
 * @param range - The circuit's `heatingCurveOffsetRangeK`.
 * @returns `true` when the offset is a multiple of `stepK`.
 *
 * @example
 * ```ts
 * isHeatingCurveOffsetOnStep(-5, {minK: -7.5, maxK: 7.5, stepK: 2.5}); // true
 * isHeatingCurveOffsetOnStep(-1, {minK: -7.5, maxK: 7.5, stepK: 2.5}); // false
 * ```
 */
export function isHeatingCurveOffsetOnStep(
    offsetK: number,
    range: EnyoHeatpumpHeatingCurveOffsetRange | undefined,
): boolean {
    const step = range?.stepK;
    if (step === undefined || !(step > 0)) return true;
    const steps = offsetK / step;
    return Math.abs(steps - Math.round(steps)) * step <= STEP_EPSILON_K;
}

/**
 * Rounds an offset to what a circuit can take: clamped to
 * {@link EnyoHeatpumpHeatingCurveOffsetRange.minK} …
 * {@link EnyoHeatpumpHeatingCurveOffsetRange.maxK} and, with
 * {@link EnyoHeatpumpHeatingCurveOffsetRange.stepK}, onto a multiple of the
 * step that lies inside the range. The energy manager sends only rounded
 * offsets; an offset off the grid is answered `Rejected`.
 *
 * A result equal to the circuit's `activeHeatingCurveOffsetK` means the device
 * cannot do the wanted change — send nothing, instead of waiting for a change
 * that never comes.
 *
 * @param offsetK - The wanted offset in K of flow temperature.
 * @param range - The circuit's `heatingCurveOffsetRangeK`; without it the
 *   offset is returned unchanged.
 * @param rounding - How to round between two steps; `Nearest` by default.
 * @returns The offset to send.
 *
 * @example
 * ```ts
 * const range = {minK: -7.5, maxK: 7.5, stepK: 2.5};
 * roundHeatingCurveOffsetToStep(-1, range);                                                 // 0
 * roundHeatingCurveOffsetToStep(-1.5, range);                                               // -2.5
 * roundHeatingCurveOffsetToStep(-1, range, EnyoHeatingCurveOffsetRoundingEnum.AwayFromZero); // -2.5
 * roundHeatingCurveOffsetToStep(-9, range);                                                 // -7.5
 * ```
 */
export function roundHeatingCurveOffsetToStep(
    offsetK: number,
    range: EnyoHeatpumpHeatingCurveOffsetRange | undefined,
    rounding: EnyoHeatingCurveOffsetRoundingEnum = EnyoHeatingCurveOffsetRoundingEnum.Nearest,
): number {
    if (!range) return offsetK;
    const clamped = Math.min(range.maxK, Math.max(range.minK, offsetK));
    const step = range.stepK;
    if (step === undefined || !(step > 0)) return clamped;

    const exact = clamped / step;
    const near = Math.round(exact);
    // Absorb floating point noise before choosing a direction.
    const raw = Math.abs(exact - near) * step <= STEP_EPSILON_K ? near : exact;
    let steps: number;
    switch (rounding) {
        case EnyoHeatingCurveOffsetRoundingEnum.TowardZero:
            steps = Math.trunc(raw);
            break;
        case EnyoHeatingCurveOffsetRoundingEnum.AwayFromZero:
            steps = raw < 0 ? Math.floor(raw) : Math.ceil(raw);
            break;
        default:
            steps = Math.sign(raw) * Math.round(Math.abs(raw));
    }
    // Stay inside the range when minK / maxK are not multiples of the step.
    const minSteps = Math.ceil(range.minK / step - STEP_EPSILON_K);
    const maxSteps = Math.floor(range.maxK / step + STEP_EPSILON_K);
    steps = Math.min(maxSteps, Math.max(minSteps, steps));
    const result = Number((steps * step).toFixed(6));
    return result === 0 ? 0 : result;
}

/**
 * How far, in Kelvin of flow temperature, the curve read from the device may
 * differ from `initialHeatingCurve + activeHeatingCurveOffsetK` at any point
 * before it counts as changed by hand.
 */
export const HEATPUMP_HEATING_CURVE_MANUAL_CHANGE_TOLERANCE_K = 0.5;

/**
 * Reads the target flow temperature off a curve at an outdoor temperature:
 * linear interpolation between neighbouring points, clamped to the first /
 * last point outside the covered range — the way every consumer of
 * {@link EnyoHeatpumpApplianceHeatingCurve.points} reads it.
 *
 * @param points - The curve points, sorted by increasing outdoor temperature.
 * @param outdoorTemperatureC - The outdoor temperature in °C.
 * @returns The flow temperature in °C, or `undefined` for an empty curve.
 *
 * @example
 * ```ts
 * interpolateHeatingCurve(curve.points, 7.5); // 30.0 between (5 → 31.4) and (10 → 28.5)
 * ```
 */
export function interpolateHeatingCurve(
    points: EnyoHeatpumpApplianceHeatingCurvePoint[],
    outdoorTemperatureC: number,
): number | undefined {
    if (points.length === 0) return undefined;
    const first = points[0];
    const last = points[points.length - 1];
    if (outdoorTemperatureC <= first.outdoorTemperatureC) return first.flowTemperatureC;
    if (outdoorTemperatureC >= last.outdoorTemperatureC) return last.flowTemperatureC;
    for (let i = 1; i < points.length; i++) {
        const right = points[i];
        if (outdoorTemperatureC <= right.outdoorTemperatureC) {
            const left = points[i - 1];
            const share = (outdoorTemperatureC - left.outdoorTemperatureC)
                / (right.outdoorTemperatureC - left.outdoorTemperatureC);
            return left.flowTemperatureC + share * (right.flowTemperatureC - left.flowTemperatureC);
        }
    }
    return last.flowTemperatureC;
}

/**
 * Shifts a heating curve in parallel: every point's flow temperature (and
 * every cooling point's) moves by `offsetK`. The vendor parameters and the
 * flow temperature bounds are kept as they are — the device still clamps to
 * them.
 *
 * @param curve - The curve to shift, typically the circuit's `initialHeatingCurve`.
 * @param offsetK - The shift in Kelvin of flow temperature; negative lowers.
 * @returns A new curve; `curve` is not modified.
 *
 * @example
 * ```ts
 * const expected = shiftHeatingCurve(circuit.initialHeatingCurve, -1.5);
 * ```
 */
export function shiftHeatingCurve(
    curve: EnyoHeatpumpApplianceHeatingCurve,
    offsetK: number,
): EnyoHeatpumpApplianceHeatingCurve {
    const shift = (points: EnyoHeatpumpApplianceHeatingCurvePoint[]) =>
        points.map((p) => ({...p, flowTemperatureC: p.flowTemperatureC + offsetK}));
    return {
        ...curve,
        points: shift(curve.points),
        ...(curve.coolingPoints ? {coolingPoints: shift(curve.coolingPoints)} : {}),
    };
}

/**
 * Whether the heating curve read from the device was changed by hand — i.e.
 * it differs from `initialCurve` shifted by `activeOffsetK` by more than
 * `toleranceK` at any point of either curve.
 *
 * When it returns `true`, the integration stores `readCurve` as the new
 * `initialHeatingCurve`, sets `activeHeatingCurveOffsetK` to `0` and logs it
 * in a plain sentence; the energy manager sees the jump to `0` and restarts
 * its controller.
 *
 * @param initialCurve - The circuit's stored `initialHeatingCurve`.
 * @param activeOffsetK - The offset in K the integration believes is in effect.
 * @param readCurve - The curve just read from the device.
 * @param toleranceK - Allowed difference per point, in K. Defaults to
 *   {@link HEATPUMP_HEATING_CURVE_MANUAL_CHANGE_TOLERANCE_K}.
 * @returns `true` when the curve was changed by hand.
 *
 * @example
 * ```ts
 * if (circuit.initialHeatingCurve
 *     && isHeatingCurveManuallyChanged(circuit.initialHeatingCurve, circuit.activeHeatingCurveOffsetK ?? 0, read)) {
 *     console.info('The heating curve was changed on the device; it is the new starting point.');
 *     await applianceManager.updateHeatpumpHeatingCircuit(id, 0, {
 *         heatingCurve: read, initialHeatingCurve: read, activeHeatingCurveOffsetK: 0,
 *     });
 * }
 * ```
 */
export function isHeatingCurveManuallyChanged(
    initialCurve: EnyoHeatpumpApplianceHeatingCurve,
    activeOffsetK: number,
    readCurve: EnyoHeatpumpApplianceHeatingCurve,
    toleranceK: number = HEATPUMP_HEATING_CURVE_MANUAL_CHANGE_TOLERANCE_K,
): boolean {
    const expected = shiftHeatingCurve(initialCurve, activeOffsetK).points;
    const read = readCurve.points;
    if (expected.length === 0 || read.length === 0) return expected.length !== read.length;
    const outdoorTemperatures = [...expected, ...read].map((p) => p.outdoorTemperatureC);
    return outdoorTemperatures.some((outdoorC) => {
        const a = interpolateHeatingCurve(expected, outdoorC) as number;
        const b = interpolateHeatingCurve(read, outdoorC) as number;
        return Math.abs(a - b) > toleranceK;
    });
}
