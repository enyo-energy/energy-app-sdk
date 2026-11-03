import {describe, expect, it} from 'vitest';
import {EnyoDataBusMessageEnum} from '../../../types/enyo-data-bus-value.js';
import {validateHeatpumpTemperatures} from '../heatpump-temperatures-validators.js';
import {installSdk, TestHeatpump} from './heatpump-test-harness.js';

describe('validateHeatpumpTemperatures', () => {
    it('accepts a payload without heating circuits', () => {
        expect(validateHeatpumpTemperatures({outdoorTemperatureC: 5})).toEqual({ok: true, errors: []});
    });

    it.each(['temperatureC', 'roomTemperatureC', 'flowTemperatureC', 'returnTemperatureC'])(
        'accepts a circuit that only sets %s',
        (field) => {
            const result = validateHeatpumpTemperatures({
                heatingCircuits: [{index: 0, targetTemperatureC: 21, [field]: 20}],
            });
            expect(result.ok).toBe(true);
        }
    );

    it('rejects a circuit without any current temperature', () => {
        const result = validateHeatpumpTemperatures({
            heatingCircuits: [
                {index: 0, targetTemperatureC: 21, temperatureC: 20},
                {index: 1, targetTemperatureC: 21, targetRoomTemperatureC: 21},
            ],
        });
        expect(result.ok).toBe(false);
        expect(result.errors).toEqual([
            'heatingCircuits[index=1] must set at least one of temperatureC, roomTemperatureC, flowTemperatureC, returnTemperatureC',
        ]);
    });

    it('does not count a non-finite value as set', () => {
        const result = validateHeatpumpTemperatures({
            heatingCircuits: [{index: 0, targetTemperatureC: 21, temperatureC: Number.NaN}],
        });
        expect(result.ok).toBe(false);
    });
});

describe('publishHeatpumpTemperatures', () => {
    it('publishes a circuit that reports only its room temperature', () => {
        const {sent} = installSdk({'hp-1': {heatpump: {availableFeatures: []}}});
        new TestHeatpump().publishHeatpumpTemperatures('hp-1', {
            heatingCircuits: [{index: 0, targetTemperatureC: 21, roomTemperatureC: 20.5}],
        });
        expect(sent).toHaveLength(1);
        expect(sent[0].message).toBe(EnyoDataBusMessageEnum.HeatpumpTemperaturesUpdateV1);
    });

    it('throws and publishes nothing for a circuit without any current temperature', () => {
        const {sent} = installSdk({'hp-1': {heatpump: {availableFeatures: []}}});
        expect(() => new TestHeatpump().publishHeatpumpTemperatures('hp-1', {
            heatingCircuits: [{index: 0, targetTemperatureC: 21}],
        })).toThrow(/Invalid heatpump temperatures: heatingCircuits\[index=0]/);
        expect(sent).toHaveLength(0);
    });
});
