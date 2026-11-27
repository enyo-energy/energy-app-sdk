/**
 * Machine-readable grouping of {@link EnergyAppPackageConnectionTypeEnum} and
 * the rule for which connection types apply to a vendor or model.
 *
 * The enyo Store, onboarding and lead qualification all need both — to label
 * an option "local" or "cloud", and to know whether a model inherits the
 * package's connection types or declares its own. Exporting them here keeps
 * every consumer on the same rule.
 */

import {EnergyAppPackageConnectionTypeEnum} from '../../energy-app-package-definition.js';
import type {
    EnergyAppPackageCompatibilityModel,
    EnergyAppPackageCompatibilityVendor,
    EnergyAppPackageDefinition,
} from '../../energy-app-package-definition.js';

/**
 * Where the data path of a connection type runs: inside the customer's
 * network, or through the vendor's cloud.
 */
export enum EnergyAppConnectionScopeEnum {
    /** The enyo Box talks to the device (or a relay) directly; works without internet. */
    Local = 'local',
    /** The app talks to the vendor's cloud; needs internet and usually a vendor account. */
    Cloud = 'cloud',
}

/**
 * The {@link EnergyAppConnectionScopeEnum | scope} of each connection type —
 * exhaustive over the enum, enforced by the type.
 *
 * @example
 * ```typescript
 * ENERGY_APP_CONNECTION_TYPE_SCOPES[EnergyAppPackageConnectionTypeEnum.ModbusTcp];
 * // EnergyAppConnectionScopeEnum.Local
 * ```
 */
export const ENERGY_APP_CONNECTION_TYPE_SCOPES: Readonly<Record<EnergyAppPackageConnectionTypeEnum, EnergyAppConnectionScopeEnum>> = {
    [EnergyAppPackageConnectionTypeEnum.Cloud]: EnergyAppConnectionScopeEnum.Cloud,
    [EnergyAppPackageConnectionTypeEnum.ModbusTcp]: EnergyAppConnectionScopeEnum.Local,
    [EnergyAppPackageConnectionTypeEnum.ModbusRtu]: EnergyAppConnectionScopeEnum.Local,
    [EnergyAppPackageConnectionTypeEnum.Http]: EnergyAppConnectionScopeEnum.Local,
    [EnergyAppPackageConnectionTypeEnum.Mqtt]: EnergyAppConnectionScopeEnum.Local,
    [EnergyAppPackageConnectionTypeEnum.Eebus]: EnergyAppConnectionScopeEnum.Local,
    [EnergyAppPackageConnectionTypeEnum.Ocpp]: EnergyAppConnectionScopeEnum.Local,
    [EnergyAppPackageConnectionTypeEnum.DryContact]: EnergyAppConnectionScopeEnum.Local,
};

/**
 * Resolves the connection types that apply to a vendor's devices or to one
 * model: the model's own list if it declares one, else its vendor's, else the
 * package's. A declared list replaces the inherited one as a whole.
 *
 * @param definition - The package, or just its `connectionTypes`.
 * @param vendor - The vendor entry, if the question is about a vendor or model.
 * @param model - The model entry, if the question is about one model.
 * @returns A copy of the applicable list; empty when nothing is declared.
 *
 * @example
 * ```typescript
 * getEffectiveConnectionTypes(
 *     {connectionTypes: [EnergyAppPackageConnectionTypeEnum.ModbusTcp]},
 *     {vendorName: 'Daikin', models: []},
 *     {modelName: 'Altherma 4 H', features: [], connectionTypes: [EnergyAppPackageConnectionTypeEnum.Http]},
 * );
 * // [EnergyAppPackageConnectionTypeEnum.Http]
 * ```
 */
export function getEffectiveConnectionTypes(
    definition: Pick<EnergyAppPackageDefinition, 'connectionTypes'>,
    vendor?: Pick<EnergyAppPackageCompatibilityVendor, 'connectionTypes'>,
    model?: Pick<EnergyAppPackageCompatibilityModel, 'connectionTypes'>,
): EnergyAppPackageConnectionTypeEnum[] {
    return [...(model?.connectionTypes ?? vendor?.connectionTypes ?? definition.connectionTypes ?? [])];
}
