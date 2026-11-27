/**
 * Onboarding guide **v2 appliance select** — the host handing an energy app the
 * existing appliance an installer picked, and taking back the appliances the
 * app linked to it.
 *
 * The appliance counterpart of `./enyo-onboarding-v2-device-select.ts`. Where
 * the device pickers hand over hardware the run discovered, the
 * {@link EnyoOnboardingV2ApplianceSelectBlock} hands over an appliance that
 * already exists on the site — typically one another energy app created. A
 * dry-contact app (a relay on a heat pump's SG Ready inputs or a wallbox's
 * enable input) uses it to learn which device its relay acts on, and links
 * itself to that device.
 *
 * Registering is optional. Without a handler the run still takes the block's
 * `selected` branch and the pick stays readable as the block's input value; it
 * just links nothing.
 *
 * Pure type declarations (no runtime logic). Register the handler through
 * {@link EnergyAppOnboardingV2} (`../packages/energy-app-onboarding-v2.ts`).
 */

import type {EnyoAppliance} from './enyo-appliance.js';
import type {EnergyAppPackageConnectionTypeEnum} from '../energy-app-package-definition.js';

/**
 * One "the installer picked this appliance — link yourself to it" request.
 *
 * Raised after the installer confirmed an appliance on an
 * {@link EnyoOnboardingV2ApplianceSelectBlock} (or the host confirmed it because
 * {@link autoSelected}), so it is on the critical path of a screen someone is
 * waiting on.
 */
export interface EnyoOnboardingV2ApplianceSelectRequest {
    /** Correlates this request with its result. Unique per request. */
    requestId: string;
    /** The {@link EnyoOnboardingV2ApplianceSelectBlock.id} the pick ran on. */
    blockId: string;
    /**
     * The {@link EnyoOnboardingV2Step.name} the block sits on, so an app can tell
     * two picks apart in a guide that asks more than once (one relay channel
     * for the heat pump, another for the wallbox).
     */
    stepName: string;
    /**
     * The picked appliance, as stored now. Usually owned by another energy app:
     * read it, and change only what the platform lets a second app change —
     * a relay entry whose `applianceId` names one of this app's own
     * appliances: an `sgReadyRelays` entry on a heat pump or a
     * `contactRelays` entry on a wallbox.
     */
    appliance: EnyoAppliance;
    /**
     * The appliance the run is already bound to, when one exists — e.g. the
     * smart plug this app created for the relay in an earlier step, or the
     * appliance of a maintenance run.
     */
    applianceId?: string;
    /**
     * The connection type the user chose for this run (from the options built
     * by `findCompatibleAppOptions()`). Absent when the package declares no
     * connection type or the run did not start from such a choice. Record it
     * on the appliances the app creates (`metadata.packageConnectionType`).
     */
    connectionType?: EnergyAppPackageConnectionTypeEnum;
    /**
     * The budget for this request, in milliseconds.
     *
     * The host owns the clock: once it is spent the host stops waiting and
     * continues as if nothing had been linked. The handler is not notified, so
     * it must bound its own work.
     */
    timeoutMs: number;
    /**
     * `true` when the host picked the appliance on the installer's behalf
     * because {@link EnyoOnboardingV2PickerBlockBase.autoSelectSingleMatch} was
     * left on and exactly one appliance matched. Changes nothing about what the
     * handler must do; it exists for support logs.
     */
    autoSelected?: boolean;
}

/** An app's answer to one {@link EnyoOnboardingV2ApplianceSelectRequest}. */
export interface EnyoOnboardingV2ApplianceSelectResult {
    /** The {@link EnyoOnboardingV2ApplianceSelectRequest.requestId} this answers. */
    requestId: string;
    /**
     * The app's own appliances now linked to the picked one — e.g. the smart
     * plug that is the relay. The host binds the run to them.
     *
     * An empty array is a valid answer and means nothing was linked. It does
     * **not** re-route the flow — the run still takes the block's `selected`
     * branch.
     */
    applianceIds: string[];
    /** Untranslated technical detail for support, e.g. why nothing was linked. Not shown to users. */
    detail?: string;
}

/**
 * Handles the host's "link yourself to this appliance" requests.
 *
 * One handler serves every appliance-select block the app's guides declare —
 * switch on {@link EnyoOnboardingV2ApplianceSelectRequest.blockId} (and
 * `stepName`) when the treatment differs, and on the picked appliance's `type`
 * when one block offers several types.
 *
 * Throwing is treated the same as answering with no appliance ids: the run
 * continues on the block's `selected` branch, unbound.
 *
 * @example
 * ```typescript
 * await energyApp.useOnboardingV2().registerApplianceSelectHandler(async (request) => {
 *     const heatpump = request.appliance;
 *     const relays = heatpump.metadata.heatpump?.sgReadyRelays ?? [];
 *     const index = Math.max(-1, ...relays.map((r) => r.index)) + 1;
 *     await energyApp.useAppliances().save({
 *         ...heatpump,
 *         metadata: {...heatpump.metadata, heatpump: {...heatpump.metadata.heatpump!, sgReadyRelays: [
 *             ...relays,
 *             {index, function: EnyoHeatpumpSgReadyFunctionEnum.DhwHeatpump, applianceId: myRelayId},
 *         ]}},
 *     });
 *     return {requestId: request.requestId, applianceIds: [myRelayId]};
 * });
 * ```
 */
export type EnyoOnboardingV2ApplianceSelectHandler = (
    request: EnyoOnboardingV2ApplianceSelectRequest,
) => Promise<EnyoOnboardingV2ApplianceSelectResult>;
