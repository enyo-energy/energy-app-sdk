import {EnyoDataBusHeatpumpTemperaturesV1} from '../../types/enyo-data-bus-value.js';

/**
 * Result of {@link validateHeatpumpTemperatures}: `ok` is `false` when there
 * are errors.
 */
export interface HeatpumpTemperaturesValidationResult {
    /** `true` when there are no errors. */
    ok: boolean;
    /** Problems that make the temperature update wrong. */
    errors: string[];
}

/** The current-temperature fields of a heating circuit, at least one of which must be set. */
const HEATING_CIRCUIT_CURRENT_TEMPERATURE_FIELDS = [
    'temperatureC',
    'roomTemperatureC',
    'flowTemperatureC',
    'returnTemperatureC',
] as const;

/**
 * Validates the data of a `HeatpumpTemperaturesUpdateV1`.
 *
 * Errors:
 * - A heating circuit carries no current temperature — none of
 *   `temperatureC`, `roomTemperatureC`, `flowTemperatureC` or
 *   `returnTemperatureC` is a finite number. Since `temperatureC` is optional,
 *   such a circuit would report nothing but its target.
 *
 * @param data - The message's `data`.
 * @returns The validation result; `ok` is `false` when there are errors.
 */
export function validateHeatpumpTemperatures(
    data: EnyoDataBusHeatpumpTemperaturesV1['data']
): HeatpumpTemperaturesValidationResult {
    const errors: string[] = [];
    for (const circuit of data.heatingCircuits ?? []) {
        const hasCurrentTemperature = HEATING_CIRCUIT_CURRENT_TEMPERATURE_FIELDS.some(
            (field) => Number.isFinite(circuit[field])
        );
        if (!hasCurrentTemperature) {
            errors.push(
                `heatingCircuits[index=${circuit.index}] must set at least one of ` +
                `${HEATING_CIRCUIT_CURRENT_TEMPERATURE_FIELDS.join(', ')}`
            );
        }
    }
    return {ok: errors.length === 0, errors};
}
