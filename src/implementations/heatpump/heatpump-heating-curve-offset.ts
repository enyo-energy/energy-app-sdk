/**
 * Pure helpers for `SetHeatpumpHeatingCurveOffsetV1`: shifting a heating curve
 * by an offset, reading a flow temperature off a curve, and telling whether
 * someone changed the curve on the device by hand.
 *
 * No I/O — persisting the initial curve is done with
 * `ApplianceManager.rememberHeatpumpInitialHeatingCurve` /
 * `ApplianceManager.clearHeatpumpInitialHeatingCurve`.
 */

import type {
    EnyoHeatpumpApplianceHeatingCurve,
    EnyoHeatpumpApplianceHeatingCurvePoint,
} from '../../types/enyo-heatpump-appliance.js';

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
