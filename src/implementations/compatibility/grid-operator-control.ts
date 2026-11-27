/**
 * How a model can be dimmed by the grid operator under §14a EnWG, condensed
 * into one value that sales, the enyo Store and onboarding can display.
 *
 * A model declares the interfaces it has in
 * {@link EnergyAppPackageCompatibilityModel.gridOperatorControlInterfaces};
 * {@link getGridOperatorControlSummary} is the one rule that turns that list
 * into "digital", "switching contact", "both", "none" or "unknown", so every
 * consumer labels a model the same way.
 */

import {EnergyAppModelGridOperatorControlInterfaceEnum} from '../../energy-app-model-feature.enum.js';
import type {EnergyAppPackageCompatibilityModel} from '../../energy-app-package-definition.js';

/** The §14a control of a model in one displayable value. */
export enum EnergyAppGridOperatorControlSummaryEnum {
    /** Only through a digital interface (EEBUS, Modbus or another digital one). */
    Digital = 'digital',
    /** Only through a switching contact. */
    SwitchingContact = 'switching-contact',
    /** Through a digital interface as well as a switching contact. */
    DigitalAndSwitchingContact = 'digital-and-switching-contact',
    /** The model cannot be dimmed under §14a (declared as an empty list). */
    None = 'none',
    /** Not declared. */
    Unknown = 'unknown',
}

/**
 * The digital interfaces among {@link EnergyAppModelGridOperatorControlInterfaceEnum} —
 * every member except the switching contact.
 */
export const ENERGY_APP_DIGITAL_GRID_OPERATOR_CONTROL_INTERFACES: readonly EnergyAppModelGridOperatorControlInterfaceEnum[] = [
    EnergyAppModelGridOperatorControlInterfaceEnum.Eebus,
    EnergyAppModelGridOperatorControlInterfaceEnum.Modbus,
    EnergyAppModelGridOperatorControlInterfaceEnum.OtherDigital,
];

/**
 * Condenses a model's §14a interfaces into one
 * {@link EnergyAppGridOperatorControlSummaryEnum} value.
 *
 * @param model - The model entry (or just its `gridOperatorControlInterfaces`);
 *   `undefined` when no model is known.
 * @returns `Unknown` when the field is omitted, `None` for an empty list, else
 *   whether the model has digital interfaces, a switching contact or both.
 *
 * @example
 * ```typescript
 * getGridOperatorControlSummary({gridOperatorControlInterfaces: [
 *     EnergyAppModelGridOperatorControlInterfaceEnum.Eebus,
 *     EnergyAppModelGridOperatorControlInterfaceEnum.SwitchingContact,
 * ]});
 * // EnergyAppGridOperatorControlSummaryEnum.DigitalAndSwitchingContact
 * ```
 */
export function getGridOperatorControlSummary(
    model: Pick<EnergyAppPackageCompatibilityModel, 'gridOperatorControlInterfaces'> | undefined,
): EnergyAppGridOperatorControlSummaryEnum {
    const interfaces = model?.gridOperatorControlInterfaces;
    if (!Array.isArray(interfaces)) return EnergyAppGridOperatorControlSummaryEnum.Unknown;
    if (interfaces.length === 0) return EnergyAppGridOperatorControlSummaryEnum.None;

    const digital = interfaces.some((i) => ENERGY_APP_DIGITAL_GRID_OPERATOR_CONTROL_INTERFACES.includes(i));
    const contact = interfaces.includes(EnergyAppModelGridOperatorControlInterfaceEnum.SwitchingContact);
    if (digital && contact) return EnergyAppGridOperatorControlSummaryEnum.DigitalAndSwitchingContact;
    if (contact) return EnergyAppGridOperatorControlSummaryEnum.SwitchingContact;
    if (digital) return EnergyAppGridOperatorControlSummaryEnum.Digital;
    return EnergyAppGridOperatorControlSummaryEnum.Unknown;
}
