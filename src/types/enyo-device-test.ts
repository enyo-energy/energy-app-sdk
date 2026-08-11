/**
 * Device test — the host asking an energy app to probe one or more detected
 * network devices and report whether appliances were found or created.
 *
 * Every other device-facing surface in this SDK points outward: the app scans
 * ({@link EnergyAppNetworkDevice.searchDevices}) or is notified
 * ({@link EnergyAppNetworkDevice.listenForDetectedDevice}) and then decides on
 * its own schedule what to do. This model inverts that. The host has found a box
 * at an IP and needs an answer it cannot produce itself — only the app knows the
 * register map, the auth handshake and the model fingerprint — so it calls into
 * the app and waits.
 *
 * The onboarding v2 graph drives this through an
 * {@link EnyoOnboardingV2ActionKind.DeviceTest} action block, whose outcomes are
 * exactly the members of {@link EnyoDeviceTestOutcomeEnum}; the same handler also
 * serves background auto-detection, so an app implements the identification logic
 * once (see {@link EnyoDeviceTestOriginEnum}).
 *
 * Pure type declarations (no runtime logic). Use `validateDeviceTestResult()`
 * (`../implementations/device-test/device-test-validators.ts`) to catch a
 * malformed result before it reaches the host.
 */

import type {EnyoNetworkDevice} from './enyo-network-device.js';
import type {EnyoApplianceTypeEnum} from './enyo-appliance.js';
import type {EnyoOnboardingTranslatedContent} from './enyo-onboarding.js';

/**
 * The verdict of a device test — the value an onboarding guide branches on.
 *
 * The list deliberately separates outcomes that lead the installer somewhere
 * different. `NotSupported` ends the flow, `AuthenticationRequired` routes to a
 * credentials step, `UserActionRequired` routes to "press the button on the
 * device" — collapsing them would strand the installer on a dead end.
 *
 * Everything that is merely a broken call — a crash, a timeout, a host that gave
 * up waiting — is {@link Failed}. There is no separate pending/cancelled state:
 * the handler returns a promise, and the promise's fate is the call's fate.
 */
export enum EnyoDeviceTestOutcomeEnum {
    /** Confirmed, and at least one appliance was newly created. */
    AppliancesCreated = 'appliances-created',
    /**
     * Confirmed, but every appliance already existed — nothing new was created.
     * This is a success, not a failure: the device is simply already set up.
     */
    AppliancesAlreadyExisted = 'appliances-already-existed',
    /**
     * Confirmed as a device this app supports, but it yields no appliance yet —
     * e.g. a gateway that still needs configuring before its appliances appear.
     */
    DeviceConfirmedNoAppliance = 'device-confirmed-no-appliance',
    /** Reachable, and definitely not a device this app supports. */
    NotSupported = 'not-supported',
    /** Could not be reached at all — offline, firewalled, wrong subnet. */
    Unreachable = 'unreachable',
    /** Reachable, but needs credentials the app does not have. */
    AuthenticationRequired = 'authentication-required',
    /**
     * Blocked by the user's network-device access grant. Registering a handler
     * needs no permission, but talking to the device does — an app without
     * `NetworkDeviceAccess` should report this rather than fail silently.
     */
    AccessNotGranted = 'access-not-granted',
    /**
     * Needs something done at the device before the test can succeed — press the
     * pairing button, enable Modbus TCP in its web UI, flip a DIP switch.
     */
    UserActionRequired = 'user-action-required',
    /**
     * The test could not be completed. Covers every breakdown: an unexpected
     * error in the app, or a run the host abandoned after
     * {@link EnyoDeviceTestRequest.timeoutMs}.
     */
    Failed = 'failed',
}

/**
 * What happened to one appliance as a result of the test — the "found or
 * created" distinction, per appliance.
 */
export enum EnyoDeviceTestApplianceDispositionEnum {
    /** The appliance did not exist before this test and was created by it. */
    Created = 'created',
    /** The appliance was already registered; the test only re-confirmed it. */
    AlreadyExisted = 'already-existed',
    /** The appliance already existed and the test refreshed its data. */
    Updated = 'updated',
}

/**
 * Who asked for the test. One handler serves every caller, so an app implements
 * its identification logic once; this field lets it adjust behaviour where that
 * genuinely matters (e.g. being noisier about failures during a guided run).
 */
export enum EnyoDeviceTestOriginEnum {
    /** An {@link EnyoOnboardingV2ActionKind.DeviceTest} block in a guided run. */
    OnboardingGuide = 'onboarding-guide',
    /** Background detection — the host matched a device against the package's detection rules. */
    AutoDetection = 'auto-detection',
    /** The user explicitly asked for a re-test from the host UI. */
    UserRequest = 'user-request',
}

/**
 * A value the installer supplied earlier in the flow and that the test needs —
 * a password, a Modbus unit id, a serial number.
 *
 * Keys are app-defined and must match what the guide collected. Values may be
 * secrets: never log them, and prefer persisting them via
 * {@link EnergyAppSecretManager} over the app's own storage.
 */
export interface EnyoDeviceTestInput {
    /** App-defined key, e.g. `password`, `unitId`. */
    key: string;
    /** The value as entered by the installer, uninterpreted. */
    value: string;
}

/**
 * One test request from the host.
 *
 * A request may carry several devices — the host typically hands over everything
 * a scan turned up — and expects a verdict for each of them.
 */
export interface EnyoDeviceTestRequest {
    /** Correlates this request with its result. Unique per request. */
    requestId: string;
    /**
     * The devices to test, as detected by the host. Never empty. The app should
     * answer for each of them in {@link EnyoDeviceTestResult.devices}.
     */
    devices: EnyoNetworkDevice[];
    /** Who asked for this test. */
    origin: EnyoDeviceTestOriginEnum;
    /** Values the installer supplied earlier in the flow, if the guide collected any. */
    inputs?: EnyoDeviceTestInput[];
    /**
     * The budget for this request, in milliseconds.
     *
     * The host owns the clock: it stops waiting once the budget is spent and
     * treats the run as {@link EnyoDeviceTestOutcomeEnum.Failed}. The handler is
     * not notified when that happens, so it must bound its own work — cap socket
     * timeouts and retries so they fit, and never leave a connection open past
     * the point where an answer could still matter.
     */
    timeoutMs: number;
}

/**
 * The verdict for one device, plus whatever the app managed to identify about
 * it. Published for every device in the request: a twelve-device scan needs
 * twelve answers, not one, because "three are mine, one needs a password, eight
 * belong to the neighbour's printer" is the normal case.
 */
export interface EnyoDeviceTestDeviceResult {
    /** The {@link EnyoNetworkDevice.id} this verdict is for. */
    networkDeviceId: string;
    /** The verdict for this device alone. */
    outcome: EnyoDeviceTestOutcomeEnum;
    /** Vendor as identified during the test, when known. */
    vendor?: string;
    /** Model as identified during the test, when known. */
    model?: string;
    /** Serial number as read from the device, when available. */
    serialNumber?: string;
    /**
     * Untranslated technical detail for support and debugging, e.g.
     * `"modbus unit 3: illegal data address at 40001"`. Not shown to the user.
     */
    detail?: string;
}

/**
 * One appliance the test touched, and what happened to it.
 *
 * Both halves of the question the caller asked are here: which appliances exist
 * for this device now, and which of them this test actually brought into being.
 */
export interface EnyoDeviceTestApplianceResult {
    /** The appliance id, as returned by {@link EnergyAppAppliance.save}. */
    applianceId: string;
    /** The appliance's category. */
    applianceType: EnyoApplianceTypeEnum;
    /** Whether this test created the appliance, updated it, or merely found it. */
    disposition: EnyoDeviceTestApplianceDispositionEnum;
    /** Which of the request's devices this appliance came from. */
    networkDeviceId: string;
}

/**
 * The app's answer to one {@link EnyoDeviceTestRequest}.
 *
 * {@link outcome} is the aggregate the onboarding graph routes on; the per-device
 * and per-appliance arrays carry the detail behind it. Derive the aggregate with
 * `aggregateDeviceTestOutcome()` rather than by hand — the precedence between a
 * partly-successful scan's outcomes is easy to get subtly wrong.
 */
export interface EnyoDeviceTestResult {
    /** The {@link EnyoDeviceTestRequest.requestId} this answers. */
    requestId: string;
    /**
     * The aggregate verdict for the whole request — what the guide branches on.
     * Success dominates: if any device produced an appliance, a sibling device's
     * failure does not turn the run into a failure.
     */
    outcome: EnyoDeviceTestOutcomeEnum;
    /** One entry per device in the request. */
    devices: EnyoDeviceTestDeviceResult[];
    /**
     * Every appliance the test touched, created or not. Empty when the outcome
     * produced none.
     */
    appliances: EnyoDeviceTestApplianceResult[];
    /**
     * Translated, installer-facing explanation shown on the waiting step (de/en).
     * Most valuable on the outcomes that ask the installer to do something —
     * which button to press, which setting to enable.
     */
    message?: EnyoOnboardingTranslatedContent[];
    /** Untranslated technical summary for support. Not shown to the user. */
    detail?: string;
}
