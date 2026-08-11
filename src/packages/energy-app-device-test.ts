import {
    EnyoDeviceTestRequest,
    EnyoDeviceTestResult
} from "../types/enyo-device-test.js";

/**
 * Handler the host calls to test one or more detected network devices.
 *
 * The handler does the work and resolves — that promise is the whole protocol.
 * There is no progress channel and no cancellation callback: the host owns the
 * clock and stops waiting after {@link EnyoDeviceTestRequest.timeoutMs}, treating
 * the run as {@link EnyoDeviceTestOutcomeEnum.Failed}. An abandoned handler is
 * never told, so bound the work to fit the budget and do not leave sockets open
 * past the point where an answer could still matter.
 *
 * Registering a handler requires no permission, but the work inside it does:
 * reaching a device needs `NetworkDeviceAccess`, creating an appliance needs
 * `Appliance`. An app missing those is still called and should answer
 * {@link EnyoDeviceTestOutcomeEnum.AccessNotGranted} rather than throw.
 *
 * Rejecting the promise is equivalent to resolving with
 * {@link EnyoDeviceTestOutcomeEnum.Failed}, but loses the per-device detail and
 * the translated message — prefer resolving with a populated result.
 *
 * @param request - The devices to test, who asked, any installer-supplied inputs,
 *   and the time budget.
 * @returns A promise resolving to the verdict for the request.
 */
export type EnyoDeviceTestHandler = (
    request: EnyoDeviceTestRequest
) => Promise<EnyoDeviceTestResult>;

/**
 * Interface for answering the host's "is this device yours, and did it yield
 * appliances?" question.
 *
 * The new onboarding flow triggers network detection and then needs a verdict the
 * host cannot produce on its own — whether a detected box is a device this app
 * supports, and whether testing it created appliances or found ones that already
 * existed. An onboarding v2 guide reaches this through an
 * {@link EnyoOnboardingV2ActionKind.DeviceTest} action block whose outcomes are
 * the members of {@link EnyoDeviceTestOutcomeEnum}.
 *
 * The same handler also serves background auto-detection and user-triggered
 * re-tests (see {@link EnyoDeviceTestOriginEnum}), so identification logic is
 * written once rather than duplicated per entry point.
 *
 * This API is available to every app — it is not permission-gated. What the
 * handler *does* still is: see {@link EnyoDeviceTestHandler}.
 *
 * @example
 * ```typescript
 * energyApp.useDeviceTest().registerDeviceTestHandler(async (request) => {
 *     const devices: EnyoDeviceTestDeviceResult[] = [];
 *     const appliances: EnyoDeviceTestApplianceResult[] = [];
 *
 *     for (const device of request.devices) {
 *         const identity = await readVendorRegisters(device);   // your protocol
 *         if (!identity) {
 *             devices.push({
 *                 networkDeviceId: device.id,
 *                 outcome: EnyoDeviceTestOutcomeEnum.NotSupported
 *             });
 *             continue;
 *         }
 *
 *         const existing = await findApplianceForSerial(identity.serialNumber);
 *         const applianceId = await energyApp.useAppliances().save(
 *             buildAppliance(device, identity),
 *             existing?.id
 *         );
 *
 *         appliances.push({
 *             applianceId,
 *             applianceType: EnyoApplianceTypeEnum.Inverter,
 *             disposition: existing
 *                 ? EnyoDeviceTestApplianceDispositionEnum.Updated
 *                 : EnyoDeviceTestApplianceDispositionEnum.Created,
 *             networkDeviceId: device.id
 *         });
 *         devices.push({
 *             networkDeviceId: device.id,
 *             outcome: existing
 *                 ? EnyoDeviceTestOutcomeEnum.AppliancesAlreadyExisted
 *                 : EnyoDeviceTestOutcomeEnum.AppliancesCreated,
 *             vendor: identity.vendor,
 *             model: identity.model,
 *             serialNumber: identity.serialNumber
 *         });
 *     }
 *
 *     return {
 *         requestId: request.requestId,
 *         outcome: aggregateDeviceTestOutcome(devices),
 *         devices,
 *         appliances
 *     };
 * });
 * ```
 */
export interface EnergyAppDeviceTest {
    /**
     * Registers the handler the host calls to test network devices.
     *
     * One handler per package: registering again replaces the previous one, so a
     * hot-reloading app does not accumulate stale handlers. Register during
     * startup — a device test that arrives before registration is answered by the
     * host with {@link EnyoDeviceTestOutcomeEnum.Failed}, which in a guided run
     * means the installer sees the flow's failure branch.
     *
     * @param handler - Callback invoked once per device-test request.
     * @returns Promise that resolves once the handler is registered with the host.
     *
     * @example
     * ```typescript
     * const deviceTest = energyApp.useDeviceTest();
     * await deviceTest.registerDeviceTestHandler(async (request) => testDevices(request));
     * ```
     */
    registerDeviceTestHandler(handler: EnyoDeviceTestHandler): Promise<void>;

    /**
     * Removes the registered handler.
     *
     * After deregistration the host no longer routes device tests to this
     * package. If no handler is registered this operation is a no-op.
     *
     * @returns Promise that resolves once the handler has been removed.
     */
    deregisterDeviceTestHandler(): Promise<void>;
}
