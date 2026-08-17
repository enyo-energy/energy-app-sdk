/**
 * Ergonomic authoring helpers for {@link EnyoModbusServerRegistration}s.
 *
 * These exist for one concrete reason: type inference. A registration's handler
 * signatures depend on its `dataType` — a `float32` register reads a `number`, a
 * `string` register reads a `string` — but that link only holds when TypeScript
 * can *infer* the data type from the literal. Annotating an object literal as
 * {@link EnyoModbusServerRegistration} defeats that: the generic falls back to
 * the full data-type union and every handler widens to `string | number`.
 *
 * Building registers through these factories keeps the link intact, so a handler
 * returning the wrong shape is a compile error rather than a runtime decode
 * failure. They also fill in `space`, which is the one field that is pure
 * boilerplate.
 *
 * Mirrors the SDK's `onboardingV2Block` pattern.
 */

import {
    EnyoModbusServerRegisterSpace,
    type EnyoModbusServerCoilRegistration,
    type EnyoModbusServerDiscreteInputRegistration,
    type EnyoModbusServerHoldingRegistration,
    type EnyoModbusServerInputRegistration,
} from '../../types/enyo-modbus-server.js';
import type {EnergyAppModbusDataType} from './interfaces.js';

/**
 * Typed factories for each Modbus address space. Each fills in `space` and
 * returns the corresponding registration, inferring the word data type from the
 * supplied `dataType` so handler values stay exact.
 *
 * @example
 * ```typescript
 * const registers = [
 *     modbusServerRegister.holding({
 *         address: 40071,
 *         key: 'active-power-w',
 *         name: [{language: 'en', value: 'Active power'}],
 *         unit: 'W',
 *         dataType: 'float32',
 *         onRead: () => currentPowerW,        // must be a number
 *         onWrite: (value) => applyLimit(value),
 *     }),
 *     modbusServerRegister.input({
 *         address: 40080,
 *         key: 'serial',
 *         name: [{language: 'en', value: 'Serial number'}],
 *         dataType: 'string',
 *         quantity: 8,
 *         onRead: () => deviceSerial,          // must be a string
 *     }),
 * ];
 * ```
 */
export const modbusServerRegister = {
    /**
     * A read/write single-bit coil.
     * @param registration - Everything but `space`; omit `onWrite` for a read-only coil.
     */
    coil: (
        registration: Omit<EnyoModbusServerCoilRegistration, 'space'>,
    ): EnyoModbusServerCoilRegistration => ({
        ...registration,
        space: EnyoModbusServerRegisterSpace.Coil,
    }),
    /**
     * A read-only single-bit discrete input.
     * @param registration - Everything but `space`.
     */
    discreteInput: (
        registration: Omit<EnyoModbusServerDiscreteInputRegistration, 'space'>,
    ): EnyoModbusServerDiscreteInputRegistration => ({
        ...registration,
        space: EnyoModbusServerRegisterSpace.DiscreteInput,
    }),
    /**
     * A read/write 16-bit holding register.
     * @param registration - Everything but `space`. The `dataType` fixes the
     *   handler value types; omit `onWrite` for a read-only holding register.
     */
    holding: <D extends EnergyAppModbusDataType>(
        registration: Omit<EnyoModbusServerHoldingRegistration<D>, 'space'>,
    ): EnyoModbusServerHoldingRegistration<D> => ({
        ...registration,
        space: EnyoModbusServerRegisterSpace.Holding,
    }),
    /**
     * A read-only 16-bit input register.
     * @param registration - Everything but `space`. The `dataType` fixes the
     *   handler value type.
     */
    input: <D extends EnergyAppModbusDataType>(
        registration: Omit<EnyoModbusServerInputRegistration<D>, 'space'>,
    ): EnyoModbusServerInputRegistration<D> => ({
        ...registration,
        space: EnyoModbusServerRegisterSpace.Input,
    }),
};
