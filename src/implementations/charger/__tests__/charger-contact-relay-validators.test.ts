import {describe, expect, it} from 'vitest';
import {
    EnyoChargerContactRelayFunctionEnum as Fn,
    type EnyoChargerApplianceContactRelay,
} from '../../../types/enyo-charger-appliance.js';
import {
    assertValidChargerContactRelays,
    ChargerContactRelaysValidationError,
    validateChargerContactRelays,
} from '../charger-contact-relay-validators.js';

describe('validateChargerContactRelays', () => {
    it('accepts no relays and a well-formed declaration', () => {
        expect(validateChargerContactRelays(undefined)).toEqual({ok: true, errors: [], warnings: []});
        expect(validateChargerContactRelays([
            {index: 0, function: Fn.ChargingEnable, applianceId: 'plug-0', name: 'EN'},
            {index: 1, function: Fn.PowerReduction, limitKw: 4.2, activeWhenOpen: true, active: false},
        ])).toEqual({ok: true, errors: [], warnings: []});
    });

    it('rejects invalid indexes, functions, limits and links', () => {
        const result = validateChargerContactRelays([
            {index: 0, function: Fn.ChargingEnable, applianceId: 'plug-0'},
            {index: 0, function: Fn.PowerReduction},
            {index: -1, function: 'dance' as Fn},
            {index: 2, function: Fn.ChargingEnable, limitKw: 3, applianceId: 'plug-0'},
            {index: 3, function: Fn.PowerReduction, limitKw: 2, applianceId: ''},
        ] as EnyoChargerApplianceContactRelay[]);
        expect(result.errors).toEqual([
            'contactRelays[1]: duplicate index 0.',
            'contactRelays[1]: power-reduction needs limitKw, a power in kW greater than 0.',
            'contactRelays[2]: index must be a whole number ≥ 0.',
            'contactRelays[2]: function "dance" is not a valid value.',
            'contactRelays[3]: limitKw only applies to power-reduction.',
            'contactRelays[3]: plug plug-0 is already linked to contactRelays[0].',
            'contactRelays[4]: applianceId must be a non-empty string.',
        ]);
    });

    it('warns about duplicate functions and active on a linked relay', () => {
        const result = validateChargerContactRelays([
            {index: 0, function: Fn.ChargingEnable, applianceId: 'plug-0', active: true},
            {index: 1, function: Fn.ChargingEnable},
        ]);
        expect(result.ok).toBe(true);
        expect(result.warnings).toEqual([
            'contactRelays[0]: active is ignored on a relay linked to a smart plug — its state is read from the plug.',
            'contactRelays[1]: another relay already has function charging-enable.',
        ]);
    });

    it('throws from the assert variant', () => {
        expect(() => assertValidChargerContactRelays([{index: 0, function: Fn.PowerReduction}]))
            .toThrow(ChargerContactRelaysValidationError);
        expect(assertValidChargerContactRelays(undefined)).toEqual([]);
    });
});
