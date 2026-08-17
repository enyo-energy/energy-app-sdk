import {describe, expect, it} from 'vitest';
import type {EnyoPackageConfigurationTranslatedValue} from '../../../types/enyo-settings.js';
import {
    EnyoModbusServerRegisterSpace,
    type EnyoModbusServerRegistration,
} from '../../../types/enyo-modbus-server.js';
import {modbusServerRegister} from '../define-modbus-server-register.js';
import {
    assertValidModbusServerRegistrations,
    modbusServerRegisterSpan,
    ModbusServerValidationError,
    validateModbusServerRegistrations,
} from '../modbus-server-validators.js';

/** Short de/en translated-value helper for terse fixtures. */
const t = (de: string, en: string): EnyoPackageConfigurationTranslatedValue[] => [
    {language: 'de', value: de},
    {language: 'en', value: en},
];

/** A holding register with the given address and data type, wired to a no-op read. */
function holding(
    key: string,
    address: number,
    dataType: 'uint16' | 'float32' | 'string' = 'uint16',
    extra: Partial<EnyoModbusServerRegistration> = {},
): EnyoModbusServerRegistration {
    return {
        space: EnyoModbusServerRegisterSpace.Holding,
        address,
        key,
        name: t('Leistung', 'Power'),
        dataType,
        onRead: () => 0,
        ...extra,
    } as EnyoModbusServerRegistration;
}

/** A coil with the given address, wired to a no-op read. */
function coil(key: string, address: number): EnyoModbusServerRegistration {
    return {
        space: EnyoModbusServerRegisterSpace.Coil,
        address,
        key,
        name: t('Freigabe', 'Enable'),
        onRead: () => false,
    };
}

describe('modbusServerRegister', () => {
    it('fills in the space for each factory', () => {
        expect(modbusServerRegister.coil({key: 'c', address: 1, name: t('A', 'A'), onRead: () => false}))
            .toMatchObject({space: EnyoModbusServerRegisterSpace.Coil});
        expect(
            modbusServerRegister.discreteInput({key: 'd', address: 1, name: t('A', 'A'), onRead: () => false}),
        ).toMatchObject({space: EnyoModbusServerRegisterSpace.DiscreteInput});
        expect(
            modbusServerRegister.holding({
                key: 'h', address: 1, name: t('A', 'A'), dataType: 'uint16', onRead: () => 0,
            }),
        ).toMatchObject({space: EnyoModbusServerRegisterSpace.Holding});
        expect(
            modbusServerRegister.input({
                key: 'i', address: 1, name: t('A', 'A'), dataType: 'uint16', onRead: () => 0,
            }),
        ).toMatchObject({space: EnyoModbusServerRegisterSpace.Input});
    });

    it('passes the descriptive metadata through untouched', () => {
        const register = modbusServerRegister.holding({
            key: 'active-power-w',
            address: 40071,
            name: t('Momentanleistung', 'Active power'),
            description: t('Aktuelle Wirkleistung.', 'Current active power.'),
            unit: 'W',
            dataType: 'float32',
            scale: 1,
            timeoutMs: 250,
            onRead: () => 230.5,
        });
        expect(register).toMatchObject({
            key: 'active-power-w',
            name: t('Momentanleistung', 'Active power'),
            description: t('Aktuelle Wirkleistung.', 'Current active power.'),
            unit: 'W',
            dataType: 'float32',
            scale: 1,
            timeoutMs: 250,
        });
    });

    it('produces registers the validator accepts', () => {
        const {ok, errors} = validateModbusServerRegistrations([
            modbusServerRegister.holding({
                key: 'power', address: 40071, name: t('Leistung', 'Power'), dataType: 'float32', onRead: () => 0,
            }),
            modbusServerRegister.input({
                key: 'serial', address: 40073, name: t('Seriennummer', 'Serial'), dataType: 'string',
                quantity: 8, onRead: () => 'abc',
            }),
        ]);
        expect(errors).toEqual([]);
        expect(ok).toBe(true);
    });
});

describe('modbusServerRegisterSpan', () => {
    it('gives a bit space a span of one', () => {
        expect(modbusServerRegisterSpan(coil('c', 1))).toBe(1);
    });

    it('derives one word for 16-bit types and two for 32-bit types', () => {
        expect(modbusServerRegisterSpan(holding('a', 40000, 'uint16'))).toBe(1);
        expect(modbusServerRegisterSpan(holding('b', 40000, 'float32'))).toBe(2);
    });

    it('uses the explicit quantity for a string register', () => {
        expect(modbusServerRegisterSpan(holding('s', 40000, 'string', {quantity: 8}))).toBe(8);
    });

    it('cannot derive a span for a string register without a quantity', () => {
        expect(modbusServerRegisterSpan(holding('s', 40000, 'string'))).toBeUndefined();
    });
});

describe('validateModbusServerRegistrations', () => {
    it('accepts an empty map', () => {
        expect(validateModbusServerRegistrations([])).toMatchObject({ok: true, errors: []});
    });

    it('accepts a non-overlapping map', () => {
        const {ok, errors} = validateModbusServerRegistrations([
            holding('power', 40071, 'float32'), // 40071..40072
            holding('soc', 40073, 'uint16'), // 40073
            coil('enable', 1),
        ]);
        expect(errors).toEqual([]);
        expect(ok).toBe(true);
    });

    it('flags a multi-word register overlapping the next address', () => {
        const {ok, errors} = validateModbusServerRegistrations([
            holding('power', 40071, 'float32'), // claims 40071..40072
            holding('soc', 40072, 'uint16'), // collides on 40072
        ]);
        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('40072..40072 overlaps'))).toBe(true);
    });

    it('does not treat the same address in different spaces as a conflict', () => {
        const {ok, errors} = validateModbusServerRegistrations([
            holding('power', 40071, 'uint16'),
            {
                space: EnyoModbusServerRegisterSpace.Input,
                address: 40071,
                key: 'power-in',
                name: t('Leistung', 'Power'),
                dataType: 'uint16',
                onRead: () => 0,
            },
        ]);
        expect(errors).toEqual([]);
        expect(ok).toBe(true);
    });

    it('flags a duplicate key', () => {
        const {ok, errors} = validateModbusServerRegistrations([
            holding('power', 40071),
            holding('power', 40080),
        ]);
        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('duplicate key "power"'))).toBe(true);
    });

    it('flags a missing key', () => {
        const {ok, errors} = validateModbusServerRegistrations([holding('', 40071)]);
        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('key is required'))).toBe(true);
    });

    it('flags a missing name', () => {
        const {ok, errors} = validateModbusServerRegistrations([
            holding('power', 40071, 'uint16', {name: []}),
        ]);
        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('name is required'))).toBe(true);
    });

    it('flags a string register without a quantity', () => {
        const {ok, errors} = validateModbusServerRegistrations([holding('serial', 40071, 'string')]);
        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('needs a positive quantity'))).toBe(true);
    });

    it('flags an unknown data type', () => {
        const {ok, errors} = validateModbusServerRegistrations([
            holding('power', 40071, 'uint64' as 'uint16'),
        ]);
        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('unknown dataType "uint64"'))).toBe(true);
    });

    it.each([-1, 1.5])('flags the invalid address %s', (address) => {
        const {ok, errors} = validateModbusServerRegistrations([holding('power', address)]);
        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('address must be a non-negative integer'))).toBe(true);
    });

    it('warns about a unit on a bit space', () => {
        const {ok, warnings} = validateModbusServerRegistrations([
            {...coil('enable', 1), unit: 'W'},
        ]);
        expect(ok).toBe(true);
        expect(warnings.some((w) => w.includes('a bit has no unit'))).toBe(true);
    });

    it('warns about a scale on a string register', () => {
        const {ok, warnings} = validateModbusServerRegistrations([
            holding('serial', 40071, 'string', {quantity: 8, scale: 2}),
        ]);
        expect(ok).toBe(true);
        expect(warnings.some((w) => w.includes('scale is ignored on a string register'))).toBe(true);
    });

    it('reports every problem in one pass rather than stopping at the first', () => {
        const {errors} = validateModbusServerRegistrations([
            holding('power', 40071, 'float32'),
            holding('power', 40072, 'uint16'), // duplicate key AND overlap
        ]);
        expect(errors.some((e) => e.includes('duplicate key'))).toBe(true);
        expect(errors.some((e) => e.includes('overlaps'))).toBe(true);
    });
});

describe('assertValidModbusServerRegistrations', () => {
    it('returns the list when valid', () => {
        const map = [holding('power', 40071)];
        expect(assertValidModbusServerRegistrations(map)).toBe(map);
    });

    it('throws ModbusServerValidationError with the errors when invalid', () => {
        let thrown: unknown;
        try {
            assertValidModbusServerRegistrations([holding('power', 40071), holding('power', 40080)]);
        } catch (e) {
            thrown = e;
        }
        expect(thrown).toBeInstanceOf(ModbusServerValidationError);
        expect((thrown as ModbusServerValidationError).errors).toHaveLength(1);
    });
});
