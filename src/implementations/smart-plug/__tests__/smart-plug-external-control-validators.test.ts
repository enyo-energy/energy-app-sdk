import {describe, expect, it} from 'vitest';
import {validateSmartPlugExternalControlContact} from '../smart-plug-external-control-validators.js';
import {
    EnyoHeatpumpSgReadyFunctionEnum,
    EnyoHeatpumpSgReadyStateEnum,
} from '../../../types/enyo-heatpump-appliance.js';
import {
    type EnyoSmartPlugExternalControlContact,
    EnyoSmartPlugExternalControlTypeEnum,
} from '../../../types/enyo-smart-plug-appliance.js';

/** A minimal valid contact, so a test isolates the rule it is about. */
const contact = (overrides: Partial<EnyoSmartPlugExternalControlContact> = {}): EnyoSmartPlugExternalControlContact => ({
    type: EnyoSmartPlugExternalControlTypeEnum.HeatpumpSgReady,
    applianceId: 'hp-1',
    function: EnyoHeatpumpSgReadyFunctionEnum.Heating,
    ...overrides,
});

describe('validateSmartPlugExternalControlContact', () => {
    it('accepts a minimal contact, and null / undefined', () => {
        expect(validateSmartPlugExternalControlContact(contact())).toEqual({ok: true, errors: [], warnings: []});
        expect(validateSmartPlugExternalControlContact(null).ok).toBe(true);
        expect(validateSmartPlugExternalControlContact(undefined).ok).toBe(true);
    });

    it('accepts a zone and a forced On state', () => {
        const result = validateSmartPlugExternalControlContact(contact({
            function: EnyoHeatpumpSgReadyFunctionEnum.DhwHeatingRod,
            zoneIndex: 1,
            onState: EnyoHeatpumpSgReadyStateEnum.Forced,
        }));
        expect(result).toEqual({ok: true, errors: [], warnings: []});
    });

    it('rejects an unknown type', () => {
        const result = validateSmartPlugExternalControlContact(contact({type: 'wallbox' as never}));
        expect(result.ok).toBe(false);
        expect(result.errors).toEqual(['type "wallbox" is not a valid value']);
    });

    it('rejects an empty applianceId', () => {
        const result = validateSmartPlugExternalControlContact(contact({applianceId: '  '}));
        expect(result.errors).toEqual(['applianceId must be a non-empty string']);
    });

    it('rejects an unknown function', () => {
        const result = validateSmartPlugExternalControlContact(contact({function: 'cooling' as never}));
        expect(result.errors).toEqual(['function "cooling" is not a valid value']);
    });

    it.each([-1, 0.5, Number.NaN])('rejects zoneIndex %s', (zoneIndex) => {
        const result = validateSmartPlugExternalControlContact(contact({zoneIndex}));
        expect(result.ok).toBe(false);
        expect(result.errors[0]).toMatch(/zoneIndex .* must be a non-negative integer/);
    });

    it('rejects normal and unknown On states', () => {
        expect(validateSmartPlugExternalControlContact(contact({onState: EnyoHeatpumpSgReadyStateEnum.Normal})).errors)
            .toEqual(['onState must not be normal — relay Off already means normal']);
        expect(validateSmartPlugExternalControlContact(contact({onState: 'boost' as never})).errors)
            .toEqual(['onState "boost" is not a valid value']);
    });

    it('warns when the relay sits on the block contact', () => {
        const result = validateSmartPlugExternalControlContact(contact({onState: EnyoHeatpumpSgReadyStateEnum.Blocked}));
        expect(result.ok).toBe(true);
        expect(result.warnings).toHaveLength(1);
    });
});
