import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {
    EnyoChargeInitiatorEnum,
    EnyoChargeModeEnum,
    EnyoPriceLimitModeEnum,
    type EnyoDataBusChangeChargeModeV1,
    EnyoChargingStopReason,
    EnyoCommandAcknowledgeAnswerEnum,
    EnyoDataBusChargerStatusChangedV1,
    EnyoDataBusChargingMeterValuesV1,
    EnyoDataBusChargingStartedV1,
    EnyoDataBusChargingStoppedV1,
    EnyoDataBusCommandAcknowledgeV1,
    EnyoDataBusMessage,
    EnyoDataBusMessageEnum,
} from '../../types/enyo-data-bus-value.js';
import {
    EnyoChargerApplianceAuthorizationModeEnum,
    EnyoChargerApplianceAvailableFeaturesEnum,
    EnyoChargerApplianceStatusEnum,
    EnyoChargerApplianceSuspendedReasonEnum,
} from '../../types/enyo-charger-appliance.js';
import {EnyoSourceEnum} from '../../types/enyo-source.enum.js';
import {ApplianceManager} from '../../implementations/appliances/appliance-manager.js';
import {
    VirtualWallboxIntegrationEnergyApp,
    VirtualWallboxIntegrationEnergyAppOptions,
    VirtualWallboxSwitchContext,
    VirtualWallboxSwitchResult,
    virtualWallboxChargerMetadata,
} from '../virtual-wallbox-integration-energy-app.js';

const {Accepted, Rejected, NotSupported} = EnyoCommandAcknowledgeAnswerEnum;
const {Available, Occupied, Charging, Suspended, Finishing} = EnyoChargerApplianceStatusEnum;
const CAR = 'car-1';
const MINUTE = 60_000;

/** Minimal stand-in for the runtime SDK: a recording data bus and an appliance store. */
function installSdk(defaultChargeMode?: EnyoChargeModeEnum, stored = new Map<string, unknown>(), openCharge?: object) {
    const sent: EnyoDataBusMessage[] = [];
    const listeners: Array<{types: EnyoDataBusMessageEnum[]; cb: (m: EnyoDataBusMessage) => void}> = [];
    /** The host's charge records: the open one, and every save. */
    const charges: {active: object | null; saved: {charge: object; id?: string}[]} = {active: openCharge ?? null, saved: []};
    (globalThis as Record<string, unknown>).energyAppSdkInstance = {
        useDataBus: () => ({
            listenForMessages: (types: EnyoDataBusMessageEnum[], cb: (m: EnyoDataBusMessage) => void) => {
                listeners.push({types, cb});
                return `listener-${listeners.length}`;
            },
            sendMessage: (messages: EnyoDataBusMessage[]) => sent.push(...messages),
            unsubscribe: () => undefined,
        }),
        useAppliances: () => ({
            getById: async (id: string) => id === CAR ? {id, charger: {defaultChargeMode}} : null,
        }),
        useCharge: () => ({
            findActiveCharge: () => Promise.resolve(charges.active),
            save: async (charge: object, id?: string) => { charges.saved.push({charge, id}); },
        }),
        useStorage: () => ({
            load: async (key: string) => stored.get(key) ?? null,
            save: async (key: string, value: unknown) => { stored.set(key, value); },
        }),
    };
    return {sent, listeners, stored, charges};
}

/** A virtual wallbox whose vehicle answers every switch with {@link result}. */
class TestWallbox extends VirtualWallboxIntegrationEnergyApp {
    readonly switches: boolean[] = [];
    readonly contexts: VirtualWallboxSwitchContext[] = [];
    result: () => Promise<VirtualWallboxSwitchResult> = async () => ({accepted: true});

    constructor(options: Partial<VirtualWallboxIntegrationEnergyAppOptions> = {}) {
        super({source: EnyoSourceEnum.Device, applianceIds: [CAR], autoStart: false, autoStopOnShutdown: false, ...options});
    }

    protected async switchVehicleCharging(
        _applianceId: string,
        on: boolean,
        context: VirtualWallboxSwitchContext,
    ): Promise<VirtualWallboxSwitchResult> {
        this.switches.push(on);
        this.contexts.push(context);
        return this.result();
    }
}

type Sdk = ReturnType<typeof installSdk>;

let sdk: Sdk;
let wallbox: TestWallbox;
let seq = 0;

/** Hands `message` to every listener subscribed to its type and lets the dispatch finish. */
async function deliver(message: EnyoDataBusMessage): Promise<EnyoDataBusCommandAcknowledgeV1['data']> {
    for (const listener of sdk.listeners) {
        if (listener.types.includes(message.message)) listener.cb(message);
    }
    await vi.advanceTimersByTimeAsync(0);
    const ack = sdk.sent.filter((m): m is EnyoDataBusCommandAcknowledgeV1 =>
        m.message === EnyoDataBusMessageEnum.CommandAcknowledgeV1 && m.data.messageId === message.id).pop();
    if (!ack) throw new Error(`no acknowledgment for ${message.message}`);
    return ack.data;
}

function command(message: EnyoDataBusMessageEnum, data: object, applianceId: string | undefined = CAR): EnyoDataBusMessage {
    return {
        id: `cmd-${++seq}`,
        type: 'message',
        message,
        source: EnyoSourceEnum.Device,
        timestampIso: new Date().toISOString(),
        ...(applianceId ? {applianceId} : {}),
        data,
    } as EnyoDataBusMessage;
}

/** A start from the enyo app; "Sofort laden" unless a test says otherwise, the one mode that switches on itself. */
const start = (chargeMode = EnyoChargeModeEnum.Immediate, vehicleId?: string, targetSocPercent?: number) =>
    deliver(command(EnyoDataBusMessageEnum.StartChargeV1, {idTag: 'enyo', requestId: 'r', chargeMode, vehicleId, targetSocPercent}));
const stop = () => deliver(command(EnyoDataBusMessageEnum.StopChargeV1, {}));
const power = (powerW: number) => deliver(command(EnyoDataBusMessageEnum.SetChargerAvailablePowerV2, {powerW}));
const pause = () => deliver(command(EnyoDataBusMessageEnum.PauseChargingV1, {applianceId: CAR}, undefined));
const schedule = (relativeSchedule: {seconds: number; chargingPowerLimitW: number}[]) =>
    deliver(command(EnyoDataBusMessageEnum.SetChargingScheduleV1, {relativeSchedule}));

const ofType = <T extends EnyoDataBusMessage>(type: EnyoDataBusMessageEnum) =>
    sdk.sent.filter((m): m is T => m.message === type);
const statuses = () => ofType<EnyoDataBusChargerStatusChangedV1>(EnyoDataBusMessageEnum.ChargerStatusChangedV1)
    .map((m) => m.data.status);
const started = () => ofType<EnyoDataBusChargingStartedV1>(EnyoDataBusMessageEnum.ChargingStartedV1);
const stopped = () => ofType<EnyoDataBusChargingStoppedV1>(EnyoDataBusMessageEnum.ChargingStoppedV1);
const meters = () => ofType<EnyoDataBusChargingMeterValuesV1>(EnyoDataBusMessageEnum.ChargingMeterValuesUpdateV1);

const plugged = (extra: object = {}) => wallbox.updateVehicleState(CAR, {pluggedIn: true, charging: false, ...extra});
const charging = (extra: object = {}) => wallbox.updateVehicleState(CAR, {pluggedIn: true, charging: true, ...extra});
const unplugged = () => wallbox.updateVehicleState(CAR, {pluggedIn: false, charging: false});

/** Most tests run with 15 minutes, 4 switches a day and no plug-in budget, so a scenario fits in a few switches. */
function setUp(options: Partial<VirtualWallboxIntegrationEnergyAppOptions> = {}, defaultChargeMode?: EnyoChargeModeEnum) {
    sdk = installSdk(defaultChargeMode);
    wallbox = new TestWallbox({minSwitchIntervalMinutes: 15, maxSwitchesPerDay: 4, maxBlocksPerPlugIn: 100, ...options});
    wallbox.start();
}

beforeEach(() => {
    vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date']});
    vi.setSystemTime(new Date('2026-11-12T10:00:00Z'));
    setUp();
});

afterEach(() => {
    wallbox.stop();
    vi.useRealTimers();
});

describe('virtualWallboxChargerMetadata', () => {
    it('declares an on/off charger at the vehicle\'s power with the switching limits', () => {
        expect(virtualWallboxChargerMetadata({chargingPowerKw: 11})).toEqual({
            availableFeatures: [
                EnyoChargerApplianceAvailableFeaturesEnum.VirtualWallbox,
                EnyoChargerApplianceAvailableFeaturesEnum.SmartChargingSchedule,
            ],
            status: Available,
            authorizationMode: EnyoChargerApplianceAuthorizationModeEnum.NoAuthorization,
            minChargingPowerKw: 11,
            maxChargingPowerKw: 11,
            minChargingCurrentAmpere: 16,
            availablePhases: [3],
            phaseSwitchDisabled: true,
            virtualWallbox: {minSwitchIntervalMinutes: 60, maxBlocksPerPlugIn: 1, maxSwitchesPerDay: 4},
        });
        expect(virtualWallboxChargerMetadata({
            chargingPowerKw: 7.4, status: Charging, minSwitchIntervalMinutes: 30, maxSwitchesPerDay: 2,
        })).toMatchObject({status: Charging, virtualWallbox: {minSwitchIntervalMinutes: 30, maxSwitchesPerDay: 2}});
        expect(virtualWallboxChargerMetadata({chargingPowerKw: 7.4, phases: 1}))
            .toMatchObject({minChargingCurrentAmpere: 32, availablePhases: [1]});
    });
});

describe('commands become on/off', () => {
    it('switches on for a start and any non-zero power, off for zero — once per change', async () => {
        await plugged();
        expect(await start()).toMatchObject({answer: Accepted});
        expect(await power(11_000)).toMatchObject({answer: Accepted});
        expect(wallbox.switches).toEqual([true]);

        await vi.advanceTimersByTimeAsync(15 * MINUTE);
        expect(await power(0)).toMatchObject({answer: Accepted});
        expect(await power(0)).toMatchObject({answer: Accepted});
        expect(wallbox.switches).toEqual([true, false]);
    });

    it('allows one charging block per plug-in by default', async () => {
        sdk = installSdk();
        wallbox.stop();
        wallbox = new TestWallbox();
        wallbox.start();
        await plugged();
        await power(11_000);
        await vi.advanceTimersByTimeAsync(59 * MINUTE);
        await power(0);
        expect(wallbox.switches).toEqual([true]);
        await vi.advanceTimersByTimeAsync(MINUTE);
        expect(wallbox.switches).toEqual([true, false]);

        // The block is used: no second one, however long the car stays plugged in.
        await vi.advanceTimersByTimeAsync(60 * MINUTE);
        await power(11_000);
        await vi.advanceTimersByTimeAsync(48 * 60 * MINUTE);
        expect(wallbox.switches).toEqual([true, false]);

        // A new plug-in brings a new block.
        await unplugged();
        await plugged();
        await power(11_000);
        expect(wallbox.switches).toEqual([true, false, true]);
    });

    it('caps starts of a car plugged in and out often at the daily limit, never a switch off', async () => {
        setUp({minSwitchIntervalMinutes: 0, maxBlocksPerPlugIn: 1, maxSwitchesPerDay: 2});
        await plugged();
        await power(11_000);
        await power(0);
        await unplugged();
        await plugged();
        await power(11_000);
        expect(wallbox.switches).toEqual([true, false]);
        await vi.advanceTimersByTimeAsync(24 * 60 * MINUTE);
        expect(wallbox.switches).toEqual([true, false, true]);
        await power(0);
        expect(wallbox.switches).toEqual([true, false, true, false]);
    });

    it('never leaves a car charging that the energy manager wants off', async () => {
        setUp({minSwitchIntervalMinutes: 0, maxBlocksPerPlugIn: 1});
        await plugged();
        await power(11_000);
        await charging();
        await vi.advanceTimersByTimeAsync(3 * MINUTE);
        await plugged();
        // The car stopped at its limit by itself; an explicit start begins a second block.
        await start();
        await power(0);
        expect(wallbox.switches).toEqual([true, true, false]);
    });

    it('lets an explicit start through a used-up plug-in budget', async () => {
        setUp({minSwitchIntervalMinutes: 0, maxBlocksPerPlugIn: 1});
        await plugged();
        await power(11_000);
        await power(0);
        expect(await start()).toMatchObject({answer: Accepted});
        expect(wallbox.switches).toEqual([true, false, true]);
    });

    it('keeps the plug-in budget across a restart', async () => {
        setUp({minSwitchIntervalMinutes: 0, maxBlocksPerPlugIn: 1});
        await plugged();
        await power(11_000);
        await power(0);

        wallbox.stop();
        sdk = installSdk(undefined, sdk.stored);
        wallbox = new TestWallbox({minSwitchIntervalMinutes: 0, maxBlocksPerPlugIn: 1});
        wallbox.start();
        await plugged();
        await power(11_000);
        await vi.advanceTimersByTimeAsync(48 * 60 * MINUTE);
        expect(wallbox.switches).toEqual([]);
        await unplugged();
        await plugged();
        await power(11_000);
        expect(wallbox.switches).toEqual([true]);
    });

    it('keeps the daily budget across a restart', async () => {
        setUp({minSwitchIntervalMinutes: 0, maxSwitchesPerDay: 2});
        await plugged();
        await power(11_000);
        await power(0);
        expect(wallbox.switches).toEqual([true, false]);

        wallbox.stop();
        sdk = installSdk(undefined, sdk.stored);
        wallbox = new TestWallbox({minSwitchIntervalMinutes: 0, maxSwitchesPerDay: 2, maxBlocksPerPlugIn: 100});
        wallbox.start();
        await plugged();
        await power(11_000);
        expect(wallbox.switches).toEqual([]);
        await vi.advanceTimersByTimeAsync(24 * 60 * MINUTE);
        expect(wallbox.switches).toEqual([true]);
    });

    it('holds a switch back until the minimum interval has passed', async () => {
        await plugged();
        await power(11_000);
        await vi.advanceTimersByTimeAsync(5 * MINUTE);

        expect(await power(0)).toMatchObject({answer: Accepted});
        expect(wallbox.switches).toEqual([true]);
        await vi.advanceTimersByTimeAsync(10 * MINUTE - 1);
        expect(wallbox.switches).toEqual([true]);
        await vi.advanceTimersByTimeAsync(1);
        expect(wallbox.switches).toEqual([true, false]);
    });

    it('applies only the latest wish once the interval has passed', async () => {
        await plugged();
        await power(11_000);
        await power(0);
        await power(11_000);
        await vi.advanceTimersByTimeAsync(15 * MINUTE);
        expect(wallbox.switches).toEqual([true]);
    });

    it('keeps to the daily budget and switches once a switch has left the window', async () => {
        setUp({minSwitchIntervalMinutes: 0, maxSwitchesPerDay: 2});
        await plugged();
        await power(11_000);
        await power(0);
        await power(11_000);
        expect(wallbox.switches).toEqual([true, false]);

        await vi.advanceTimersByTimeAsync(24 * 60 * MINUTE);
        expect(wallbox.switches).toEqual([true, false, true]);
    });

    it('sends an explicit start or stop at once', async () => {
        await plugged();
        await start();
        expect(await stop()).toMatchObject({answer: Accepted});
        expect(await start()).toMatchObject({answer: Accepted});
        expect(wallbox.switches).toEqual([true, false, true]);
    });

    it('rejects power, schedule and resume after a stop until the next start', async () => {
        await plugged();
        await start();
        await stop();

        expect(await power(11_000)).toMatchObject({answer: Rejected});
        expect(await schedule([{seconds: 0, chargingPowerLimitW: 11_000}])).toMatchObject({answer: Rejected});
        expect(await deliver(command(EnyoDataBusMessageEnum.ResumeChargingV1, {applianceId: CAR, maxChargingPowerKw: 11}, undefined)))
            .toMatchObject({answer: Rejected});
        expect(await pause()).toMatchObject({answer: Accepted});
        expect(wallbox.switches).toEqual([true, false]);

        await start();
        expect(wallbox.switches).toEqual([true, false, true]);
    });

    it('passes the vehicle\'s refusal on, and a thrown error as one', async () => {
        await plugged();
        wallbox.result = async () => ({accepted: false, reason: 'Vehicle asleep'});
        expect(await start()).toEqual(expect.objectContaining({answer: Rejected, rejectionReason: 'Vehicle asleep'}));

        wallbox.result = async () => { throw new Error('network down'); };
        expect(await start()).toEqual(expect.objectContaining({answer: Rejected, rejectionReason: 'Error: network down'}));
    });

    it('sends nothing while the vehicle is unplugged', async () => {
        await unplugged();
        expect(await power(11_000)).toMatchObject({answer: Accepted});
        expect(await start()).toEqual(expect.objectContaining({answer: Rejected, rejectionReason: 'The vehicle is not plugged in'}));
        expect(wallbox.switches).toEqual([]);
    });

    it('emulates a charging schedule; a new one replaces the old', async () => {
        await charging();
        await schedule([{seconds: 0, chargingPowerLimitW: 0}, {seconds: 3600, chargingPowerLimitW: 11_000}]);
        expect(wallbox.switches).toEqual([false]);
        await plugged();

        await vi.advanceTimersByTimeAsync(3600 * 1000);
        expect(wallbox.switches).toEqual([false, true]);

        await vi.advanceTimersByTimeAsync(15 * MINUTE);
        await schedule([{seconds: 1800, chargingPowerLimitW: 0}]);
        await schedule([{seconds: 7200, chargingPowerLimitW: 0}]);
        await vi.advanceTimersByTimeAsync(1800 * 1000);
        expect(wallbox.switches).toEqual([false, true]);
        await vi.advanceTimersByTimeAsync(5400 * 1000);
        expect(wallbox.switches).toEqual([false, true, false]);
    });

    it('sends no stop to a car that is plugged in but not charging', async () => {
        await plugged();
        expect(await power(0)).toMatchObject({answer: Accepted});
        expect(await schedule([{seconds: 0, chargingPowerLimitW: 0}])).toMatchObject({answer: Accepted});
        expect(wallbox.switches).toEqual([]);
    });

    it('stops a car that reported idle at the plug-in and then starts by itself against the plan', async () => {
        await plugged();
        await schedule([{seconds: 0, chargingPowerLimitW: 0}, {seconds: 3 * 3600, chargingPowerLimitW: 11_000}]);
        expect(wallbox.switches).toEqual([]);

        await charging();
        await vi.advanceTimersByTimeAsync(0);
        expect(wallbox.switches).toEqual([false]);
        await plugged();

        await vi.advanceTimersByTimeAsync(3 * 60 * MINUTE);
        expect(wallbox.switches).toEqual([false, true]);
    });

    it('sends no second stop for a car that still reports charging right after a pause', async () => {
        await plugged();
        await power(11_000);
        await charging();
        await vi.advanceTimersByTimeAsync(15 * MINUTE);
        await power(0);
        expect(wallbox.switches).toEqual([true, false]);

        await charging();
        await vi.advanceTimersByTimeAsync(0);
        await plugged();
        await vi.advanceTimersByTimeAsync(60 * MINUTE);
        expect(wallbox.switches).toEqual([true, false]);
    });

    it('answers what a vehicle cannot do with NotSupported', async () => {
        expect(await deliver(command(EnyoDataBusMessageEnum.ResetChargerV1, {}))).toMatchObject({answer: NotSupported});
        expect(await deliver(command(EnyoDataBusMessageEnum.RebootChargerV1, {}))).toMatchObject({answer: NotSupported});
        expect(await deliver(command(EnyoDataBusMessageEnum.GridOperatorPowerLimitationV1,
            {active: true, powerLimitationW: 4200, endTimestampIso: new Date().toISOString()}, undefined)))
            .toMatchObject({answer: NotSupported});
    });
});

describe('the vehicle\'s state becomes the charger\'s', () => {
    it('reports plug-in, a charge the car starts on its own and the unplug', async () => {
        setUp({}, EnyoChargeModeEnum.PriceLimit);
        await plugged();
        await charging({chargingPowerW: 11_000, sessionEnergyWh: 0, vehicleId: 'v-1'});
        await charging({chargingPowerW: 11_000, sessionEnergyWh: 2_500, socPercent: 40});
        await unplugged();

        expect(statuses()).toEqual([Occupied, Charging, Available]);
        expect(started()).toHaveLength(1);
        expect(started()[0].data).toMatchObject({
            initiator: EnyoChargeInitiatorEnum.Charger,
            chargeMode: EnyoChargeModeEnum.PriceLimit,
            meterValueWh: 0,
            vehicleId: 'v-1',
        });
        expect(stopped()[0].data).toMatchObject({
            transactionId: started()[0].data.transactionId,
            energyDeliveredWh: 2_500,
            meterValueWh: 2_500,
            stopReason: EnyoChargingStopReason.EVDisconnected,
        });
        expect(meters().map((m) => [m.data.context, m.data.chargingPowerW, m.data.energyDeliveredWh])).toEqual([
            ['Transaction.Begin', 11_000, 0],
            ['Sample.Periodic', 11_000, 2_500],
            ['Transaction.End', 0, 2_500],
        ]);
        expect(meters()[1].data.evStateOfChargePercent).toBe(40);
    });

    it('falls back to Immediate when the wallbox has no default charge mode', async () => {
        await charging();
        expect(started()[0].data.chargeMode).toBe(EnyoChargeModeEnum.Immediate);
    });

    it('opens the session of a smart start at once, paused by the EVSE until the energy manager\'s window', async () => {
        await plugged();
        await deliver(command(EnyoDataBusMessageEnum.StartChargeV1, {
            idTag: 'enyo', requestId: 'r', chargeMode: EnyoChargeModeEnum.CostOptimized, vehicleId: 'v-9',
            targetSocPercent: 80, completeChargeAtIso: '2026-11-13T06:00:00Z',
        }));
        // As a real wallbox opens its transaction: the energy manager plans from the session.
        expect(started()).toHaveLength(1);
        expect(started()[0].data).toMatchObject({
            initiator: EnyoChargeInitiatorEnum.App,
            chargeMode: EnyoChargeModeEnum.CostOptimized,
            vehicleId: 'v-9',
            completeChargeAtIso: '2026-11-13T06:00:00Z',
        });
        expect(statuses()).toEqual([Occupied, Suspended]);
        expect(ofType<EnyoDataBusChargerStatusChangedV1>(EnyoDataBusMessageEnum.ChargerStatusChangedV1)[1].data.suspendedReason)
            .toBe(EnyoChargerApplianceSuspendedReasonEnum.Evse);
        expect(wallbox.switches).toEqual([]);

        await power(11_000);
        await charging({chargingPowerW: 7_000});
        expect(wallbox.switches).toEqual([true]);
        expect(wallbox.contexts).toEqual([{targetSocPercent: 80}]);
        expect(started()).toHaveLength(1);
        expect(statuses()).toEqual([Occupied, Suspended, Charging]);
    });

    describe('a change of mode or deadline while the session waits', () => {
        const startWith = (data: object) => deliver(command(EnyoDataBusMessageEnum.StartChargeV1, {
            idTag: 'enyo', requestId: 'r', ...data,
        }));
        const modeChanges = () => ofType<EnyoDataBusChangeChargeModeV1>(EnyoDataBusMessageEnum.ChangeChargeModeV1)
            .map((m) => m.data);

        it('reaches the energy manager and the charge record', async () => {
            await plugged();
            await startWith({chargeMode: EnyoChargeModeEnum.CostOptimized, completeChargeAtIso: '2026-11-13T06:00:00Z'});
            sdk.charges.active = {
                id: 'charge-1', transactionId: started()[0].data.transactionId, applianceId: CAR,
                chargeMode: EnyoChargeModeEnum.CostOptimized, completeAtIsoTimestamp: '2026-11-13T06:00:00Z',
            };
            await vi.advanceTimersByTimeAsync(30 * MINUTE);

            await startWith({chargeMode: EnyoChargeModeEnum.PriceLimit, completeChargeAtIso: '2026-11-13T09:00:00Z'});
            expect(modeChanges()).toEqual([{chargeMode: EnyoChargeModeEnum.PriceLimit, completeChargeAtIso: '2026-11-13T09:00:00Z'}]);
            expect(sdk.charges.saved).toEqual([{
                id: 'charge-1',
                charge: expect.objectContaining({
                    chargeMode: EnyoChargeModeEnum.PriceLimit, completeAtIsoTimestamp: '2026-11-13T09:00:00Z',
                }),
            }]);
            expect(started()).toHaveLength(1);

            // The same settings again change nothing.
            await startWith({chargeMode: EnyoChargeModeEnum.PriceLimit});
            expect(modeChanges()).toHaveLength(1);
        });

        it('passes the start\'s price ceiling on with it', async () => {
            await plugged();
            await startWith({chargeMode: EnyoChargeModeEnum.CostOptimized});
            await startWith({
                chargeMode: EnyoChargeModeEnum.CostOptimized, completeChargeAtIso: '2026-11-13T07:00:00Z',
                priceLimitMode: EnyoPriceLimitModeEnum.CtPerKwh, priceLimitCtPerKwh: 25,
            });
            expect(modeChanges()).toEqual([{
                chargeMode: EnyoChargeModeEnum.CostOptimized, completeChargeAtIso: '2026-11-13T07:00:00Z',
                priceLimitMode: EnyoPriceLimitModeEnum.CtPerKwh, priceLimitCtPerKwh: 25,
            }]);
        });

        it('announces a change of the price ceiling alone, and a start without one as no ceiling', async () => {
            await plugged();
            await startWith({chargeMode: EnyoChargeModeEnum.CostOptimized, priceLimitMode: EnyoPriceLimitModeEnum.CtPerKwh, priceLimitCtPerKwh: 25});
            expect(modeChanges()).toEqual([]);
            await startWith({chargeMode: EnyoChargeModeEnum.CostOptimized, priceLimitMode: EnyoPriceLimitModeEnum.CtPerKwh, priceLimitCtPerKwh: 30});
            await startWith({chargeMode: EnyoChargeModeEnum.CostOptimized});
            expect(modeChanges()).toEqual([
                {chargeMode: EnyoChargeModeEnum.CostOptimized, priceLimitMode: EnyoPriceLimitModeEnum.CtPerKwh, priceLimitCtPerKwh: 30},
                {chargeMode: EnyoChargeModeEnum.CostOptimized},
            ]);
        });

        it('writes only the session\'s own charge record', async () => {
            await plugged();
            await startWith({chargeMode: EnyoChargeModeEnum.CostOptimized});
            sdk.charges.active = {id: 'charge-old', transactionId: 'tx-of-another-charge', chargeMode: EnyoChargeModeEnum.CostOptimized};
            await startWith({chargeMode: EnyoChargeModeEnum.PriceLimit});
            expect(modeChanges()).toHaveLength(1);
            expect(sdk.charges.saved).toEqual([]);
        });

        it('tells the energy manager of "Sofort laden", so it does not switch the car off again', async () => {
            await plugged();
            await startWith({chargeMode: EnyoChargeModeEnum.CostOptimized});
            await startWith({chargeMode: EnyoChargeModeEnum.Immediate});
            expect(modeChanges()).toEqual([{chargeMode: EnyoChargeModeEnum.Immediate}]);
            expect(wallbox.switches).toEqual([true]);
        });
    });

    it('opens the paused session of a smart start that came before the first report of the car', async () => {
        expect(await start(EnyoChargeModeEnum.CostOptimized, 'v-9')).toMatchObject({answer: Accepted});
        expect(started()).toHaveLength(0);
        await plugged();
        expect(started()).toHaveLength(1);
        expect(started()[0].data).toMatchObject({initiator: EnyoChargeInitiatorEnum.App, vehicleId: 'v-9'});
        expect(statuses()).toEqual([Suspended]);
        expect(wallbox.switches).toEqual([]);
    });

    it('opens the session of an immediate start once the car charges', async () => {
        await plugged();
        await start(EnyoChargeModeEnum.Immediate, 'v-9');
        expect(started()).toHaveLength(0);
        await charging({chargingPowerW: 7_000});
        expect(started()[0].data).toMatchObject({initiator: EnyoChargeInitiatorEnum.App, chargeMode: EnyoChargeModeEnum.Immediate});
    });

    it('keeps the session through a pause and reports it as suspended by the EVSE', async () => {
        await plugged();
        await start();
        await charging();
        await vi.advanceTimersByTimeAsync(15 * MINUTE);
        await pause();
        await plugged();

        expect(statuses()).toEqual([Occupied, Charging, Suspended]);
        expect(ofType<EnyoDataBusChargerStatusChangedV1>(EnyoDataBusMessageEnum.ChargerStatusChangedV1)[2].data.suspendedReason)
            .toBe(EnyoChargerApplianceSuspendedReasonEnum.Evse);
        expect(stopped()).toHaveLength(0);
    });

    it('ends the session when the car stops by itself while switched on', async () => {
        await plugged();
        await start();
        await charging();
        await vi.advanceTimersByTimeAsync(3 * MINUTE);
        await plugged();

        expect(statuses()).toEqual([Occupied, Charging, Occupied]);
        expect(stopped()[0].data.stopReason).toBe(EnyoChargingStopReason.Other);

        await vi.advanceTimersByTimeAsync(15 * MINUTE);
        expect(await power(0)).toMatchObject({answer: Accepted});
        expect(wallbox.switches).toEqual([true]);
    });

    it('ends a stopped charge as Remote once the car has stopped, and an unplug lifts the stop', async () => {
        await plugged();
        await start();
        await charging();
        await stop();
        await charging();
        expect(stopped()).toHaveLength(0);

        await plugged();
        expect(statuses()).toEqual([Occupied, Charging, Finishing]);
        expect(stopped()[0].data.stopReason).toBe(EnyoChargingStopReason.Remote);

        await unplugged();
        await plugged();
        expect(await power(11_000)).toMatchObject({answer: Accepted});
        // The switching limits outlast the unplug: they protect the car, not the session.
        expect(wallbox.switches).toEqual([true, false]);
        await vi.advanceTimersByTimeAsync(15 * MINUTE);
        expect(wallbox.switches).toEqual([true, false, true]);
    });

    it('ends a paused session at once on a stop, without a command to the car', async () => {
        await plugged();
        await charging();
        await power(0);
        await plugged();
        expect(statuses()).toEqual([Occupied, Charging, Suspended]);

        expect(await stop()).toMatchObject({answer: Accepted});
        expect(wallbox.switches).toEqual([false]);
        expect(statuses()).toEqual([Occupied, Charging, Suspended, Finishing]);
        expect(stopped()[0].data.stopReason).toBe(EnyoChargingStopReason.Remote);
    });

    it('takes a car that has not followed a start yet as suspended by the car, not as stopped', async () => {
        await plugged();
        await charging();
        await power(0);
        await vi.advanceTimersByTimeAsync(15 * MINUTE);
        await power(11_000);
        // A report taken before the start arrives after it.
        await plugged();
        expect(statuses()).toEqual([Occupied, Charging, Suspended]);
        expect(ofType<EnyoDataBusChargerStatusChangedV1>(EnyoDataBusMessageEnum.ChargerStatusChangedV1)[2].data.suspendedReason)
            .toBe(EnyoChargerApplianceSuspendedReasonEnum.Ev);
        expect(stopped()).toHaveLength(0);

        await vi.advanceTimersByTimeAsync(3 * MINUTE);
        await plugged();
        expect(statuses()).toEqual([Occupied, Charging, Suspended, Occupied]);
        expect(stopped()).toHaveLength(1);
    });

    it('takes a smart start for a running session as a change of mode, leaving on/off to the energy manager', async () => {
        await plugged();
        await charging();
        await power(0);
        expect(await start(EnyoChargeModeEnum.CostOptimized)).toMatchObject({answer: Accepted});
        await vi.advanceTimersByTimeAsync(60 * MINUTE);
        expect(wallbox.switches).toEqual([false]);
    });

    it('switches on at once for "Sofort laden" in a running session, as the owner expects', async () => {
        await plugged();
        await charging();
        await power(0);
        expect(await start(EnyoChargeModeEnum.Immediate)).toMatchObject({answer: Accepted});
        expect(wallbox.switches).toEqual([false, true]);
    });

    it('switches on at once for "Sofort laden" right after a smart start, with production limits', async () => {
        sdk = installSdk();
        wallbox.stop();
        wallbox = new TestWallbox();
        wallbox.start();
        await plugged();
        await start(EnyoChargeModeEnum.Immediate);
        await charging();
        await vi.advanceTimersByTimeAsync(20 * MINUTE);
        await stop();
        await plugged();
        await vi.advanceTimersByTimeAsync(5 * MINUTE);
        await start(EnyoChargeModeEnum.CostOptimized);
        await vi.advanceTimersByTimeAsync(MINUTE);
        expect(await start(EnyoChargeModeEnum.Immediate)).toMatchObject({answer: Accepted});
        expect(wallbox.switches).toEqual([true, false, true]);
    });

    it('opens no session for a smart start when an unplug report ran first in the queue', async () => {
        let release: () => void = () => undefined;
        await plugged();
        wallbox.result = () => new Promise((resolve) => { release = () => resolve({accepted: true}); });
        const dispatch = (message: EnyoDataBusMessage) => sdk.listeners
            .filter((listener) => listener.types.includes(message.message))
            .forEach((listener) => listener.cb(message));

        // A switch to the vehicle cloud is on its way; an unplug and a smart start queue behind it.
        dispatch(command(EnyoDataBusMessageEnum.SetChargerAvailablePowerV2, {powerW: 11_000}));
        await vi.advanceTimersByTimeAsync(0);
        const unplugging = unplugged();
        dispatch(command(EnyoDataBusMessageEnum.StartChargeV1, {
            idTag: 'enyo', requestId: 'r', chargeMode: EnyoChargeModeEnum.CostOptimized,
        }));
        release();
        await unplugging;
        await vi.advanceTimersByTimeAsync(0);

        expect(started()).toHaveLength(0);
        expect(statuses().at(-1)).toBe(Available);
    });

    it('hands the target of the start command to the switch, and keeps it for the session', async () => {
        setUp({maxSwitchesPerDay: 10});
        await plugged();
        await start(EnyoChargeModeEnum.CostOptimized, undefined, 90);
        await power(11_000);
        await charging();
        await vi.advanceTimersByTimeAsync(15 * MINUTE);
        await power(0);
        await vi.advanceTimersByTimeAsync(15 * MINUTE);
        await power(11_000);
        expect(wallbox.contexts).toEqual([{targetSocPercent: 90}, {targetSocPercent: 90}, {targetSocPercent: 90}]);

        // A new plug-in is a new charge: no target until a start states one.
        await unplugged();
        await plugged();
        await vi.advanceTimersByTimeAsync(15 * MINUTE);
        await power(11_000);
        expect(wallbox.contexts.at(-1)).toEqual({});
    });

    describe('a start under a smart charge mode', () => {
        /** The energy manager's cost-optimised plan: off now, the cheap window from 3 h to 5 h. */
        const cheapWindowPlan = () => schedule([
            {seconds: 0, chargingPowerLimitW: 0},
            {seconds: 3 * 60 * MINUTE / 1000, chargingPowerLimitW: 11_000},
            {seconds: 5 * 60 * MINUTE / 1000, chargingPowerLimitW: 0},
        ]);

        beforeEach(() => setUp({minSwitchIntervalMinutes: 60, maxSwitchesPerDay: 2, maxBlocksPerPlugIn: 1}));

        it('leaves a car that is not charging off and charges it in the energy manager\'s window', async () => {
            await plugged();
            expect(await start(EnyoChargeModeEnum.CostOptimized, 'v-1', 80)).toMatchObject({answer: Accepted});
            expect(await cheapWindowPlan()).toMatchObject({answer: Accepted});
            expect(wallbox.switches).toEqual([]);

            await vi.advanceTimersByTimeAsync(3 * 60 * MINUTE);
            expect(wallbox.switches).toEqual([true]);
            expect(wallbox.contexts).toEqual([{targetSocPercent: 80}]);
            await charging();
            expect(started()[0].data).toMatchObject({chargeMode: EnyoChargeModeEnum.CostOptimized, vehicleId: 'v-1'});

            await vi.advanceTimersByTimeAsync(2 * 60 * MINUTE);
            expect(wallbox.switches).toEqual([true, false]);
        });

        it('switches a car that charges by itself off until the window, then on', async () => {
            await charging();
            expect(await start(EnyoChargeModeEnum.CostOptimized)).toMatchObject({answer: Accepted});
            await cheapWindowPlan();
            expect(wallbox.switches).toEqual([false]);
            await plugged();

            await vi.advanceTimersByTimeAsync(3 * 60 * MINUTE);
            expect(wallbox.switches).toEqual([false, true]);
        });

        it('takes PV only the same way', async () => {
            await plugged();
            await start(EnyoChargeModeEnum.PriceLimit);
            expect(wallbox.switches).toEqual([]);
            await power(11_000);
            expect(wallbox.switches).toEqual([true]);
        });

        it('ends the charge at a stop: a smart start after it waits for the energy manager\'s new plan', async () => {
            setUp({minSwitchIntervalMinutes: 15, maxSwitchesPerDay: 4, maxBlocksPerPlugIn: 100});
            await plugged();
            await start(EnyoChargeModeEnum.CostOptimized);
            await cheapWindowPlan();
            await stop();
            expect(await start(EnyoChargeModeEnum.CostOptimized)).toMatchObject({answer: Accepted});
            // Neither the old "off now" nor the old window: the plan was the stopped charge's.
            await vi.advanceTimersByTimeAsync(5 * 60 * MINUTE);
            expect(wallbox.switches).toEqual([]);

            await power(11_000);
            expect(wallbox.switches).toEqual([true]);
        });

        it('still switches off at the end of the window when one gap in the car\'s reports closed the session', async () => {
            await plugged();
            await start(EnyoChargeModeEnum.CostOptimized);
            await cheapWindowPlan();
            await vi.advanceTimersByTimeAsync(3 * 60 * MINUTE);
            await charging();
            await vi.advanceTimersByTimeAsync(60 * MINUTE);
            // One report says "not charging": the session closes; then the car charges on.
            await plugged();
            await vi.advanceTimersByTimeAsync(5 * MINUTE);
            await charging();
            await vi.advanceTimersByTimeAsync(60 * MINUTE);
            expect(wallbox.switches).toEqual([true, false]);
        });

        it('keeps a plan that arrives while stopped for the next start', async () => {
            await plugged();
            await stop();
            expect(await cheapWindowPlan()).toMatchObject({answer: Rejected});
            await start(EnyoChargeModeEnum.CostOptimized);
            // An idle car needs no stop command.
            expect(wallbox.switches).toEqual([]);

            await vi.advanceTimersByTimeAsync(3 * 60 * MINUTE);
            expect(wallbox.switches).toEqual([true]);
        });

        it('gives a new smart start of the owner a charging block of its own', async () => {
            setUp({minSwitchIntervalMinutes: 15, maxSwitchesPerDay: 4, maxBlocksPerPlugIn: 1});
            await plugged();
            await start(EnyoChargeModeEnum.CostOptimized, 'v', 80);
            expect(wallbox.switches).toEqual([]);
            await power(11_000);
            await charging();
            await vi.advanceTimersByTimeAsync(60 * MINUTE);
            // The car stopped at 80 % by itself; the owner wants 100 % for a trip.
            await plugged();
            await power(0);
            await vi.advanceTimersByTimeAsync(60 * MINUTE);
            expect(await start(EnyoChargeModeEnum.CostOptimized, 'v', 100)).toMatchObject({answer: Accepted});
            // The start leaves the moment to the energy manager; its "on" is not held back by the used block.
            expect(wallbox.switches).toEqual([true]);
            await power(11_000);
            expect(wallbox.switches).toEqual([true, true]);
            expect(wallbox.contexts.at(-1)).toEqual({targetSocPercent: 100});
        });

        it('charges again after a stop and a new smart start', async () => {
            setUp({minSwitchIntervalMinutes: 15, maxSwitchesPerDay: 4, maxBlocksPerPlugIn: 1});
            await plugged();
            await power(11_000);
            await charging();
            await vi.advanceTimersByTimeAsync(15 * MINUTE);
            await stop();
            await plugged();
            await start(EnyoChargeModeEnum.CostOptimized);
            expect(wallbox.switches).toEqual([true, false]);
            await power(11_000);
            await vi.advanceTimersByTimeAsync(15 * MINUTE);
            expect(wallbox.switches).toEqual([true, false, true]);
        });

        it('does not switch a new smart start on with the "on" of a charge that ended at the car\'s limit', async () => {
            setUp({minSwitchIntervalMinutes: 15, maxSwitchesPerDay: 4, maxBlocksPerPlugIn: 1});
            await plugged();
            await start(EnyoChargeModeEnum.CostOptimized, 'v', 80);
            await power(11_000);
            await charging();
            await vi.advanceTimersByTimeAsync(60 * MINUTE);
            // At 80 % the car stops by itself; the energy manager sends nothing more.
            await plugged();
            await vi.advanceTimersByTimeAsync(12 * 60 * MINUTE);

            await start(EnyoChargeModeEnum.CostOptimized, 'v', 100);
            expect(wallbox.switches).toEqual([true]);
            // The new charge's own plan decides.
            await power(11_000);
            expect(wallbox.switches).toEqual([true, true]);
        });

        it('does not revive the "on" entries of an ended charge\'s plan for a new smart start', async () => {
            setUp({minSwitchIntervalMinutes: 15, maxSwitchesPerDay: 10, maxBlocksPerPlugIn: 1});
            await plugged();
            await start(EnyoChargeModeEnum.CostOptimized);
            // Two cheap windows: 1–2 h and 4–5 h.
            await schedule([
                {seconds: 0, chargingPowerLimitW: 0},
                {seconds: 3600, chargingPowerLimitW: 11_000},
                {seconds: 2 * 3600, chargingPowerLimitW: 0},
                {seconds: 4 * 3600, chargingPowerLimitW: 11_000},
                {seconds: 5 * 3600, chargingPowerLimitW: 0},
            ]);
            await vi.advanceTimersByTimeAsync(60 * MINUTE);
            await charging();
            await vi.advanceTimersByTimeAsync(30 * MINUTE);
            // At its limit the car stops by itself: the charge ends.
            await plugged();
            await vi.advanceTimersByTimeAsync(2 * 60 * MINUTE + 40 * MINUTE);
            await start(EnyoChargeModeEnum.CostOptimized);
            await vi.advanceTimersByTimeAsync(2 * 60 * MINUTE);
            expect(wallbox.switches).toEqual([true]);
        });

        it('does not let an "on" of an ended charge\'s plan fire into the session of a new smart start', async () => {
            setUp({minSwitchIntervalMinutes: 15, maxSwitchesPerDay: 10, maxBlocksPerPlugIn: 1});
            await plugged();
            await start(EnyoChargeModeEnum.CostOptimized);
            await schedule([
                {seconds: 0, chargingPowerLimitW: 0},
                {seconds: 3600, chargingPowerLimitW: 11_000},
                {seconds: 2 * 3600, chargingPowerLimitW: 0},
                {seconds: 4 * 3600, chargingPowerLimitW: 11_000},
                {seconds: 5 * 3600, chargingPowerLimitW: 0},
            ]);
            await vi.advanceTimersByTimeAsync(60 * MINUTE);
            await charging();
            await vi.advanceTimersByTimeAsync(30 * MINUTE);
            await plugged();
            // The new charge starts before the old plan's second window.
            await vi.advanceTimersByTimeAsync(60 * MINUTE);
            await start(EnyoChargeModeEnum.CostOptimized);
            await vi.advanceTimersByTimeAsync(3 * 60 * MINUTE);
            expect(wallbox.switches).toEqual([true]);
        });

        it('keeps the whole plan of a charge whose session closed on one gap in the car\'s reports', async () => {
            setUp({minSwitchIntervalMinutes: 15, maxSwitchesPerDay: 10, maxBlocksPerPlugIn: 100});
            await plugged();
            await start(EnyoChargeModeEnum.CostOptimized);
            await schedule([
                {seconds: 0, chargingPowerLimitW: 0},
                {seconds: 3600, chargingPowerLimitW: 11_000},
                {seconds: 2 * 3600, chargingPowerLimitW: 0},
                {seconds: 4 * 3600, chargingPowerLimitW: 11_000},
                {seconds: 5 * 3600, chargingPowerLimitW: 0},
            ]);
            await vi.advanceTimersByTimeAsync(60 * MINUTE);
            await charging();
            await vi.advanceTimersByTimeAsync(30 * MINUTE);
            await plugged();
            await vi.advanceTimersByTimeAsync(5 * MINUTE);
            await charging();
            await vi.advanceTimersByTimeAsync(26 * MINUTE);
            await plugged();
            await vi.advanceTimersByTimeAsync(2 * 60 * MINUTE + 10 * MINUTE);
            // The second window still gets its start.
            expect(wallbox.switches).toEqual([true, false, true]);
        });

        it('lets no "off" of an ended charge\'s plan switch off a new charge the owner started', async () => {
            setUp({minSwitchIntervalMinutes: 15, maxSwitchesPerDay: 10, maxBlocksPerPlugIn: 1});
            await plugged();
            await start(EnyoChargeModeEnum.CostOptimized);
            await schedule([
                {seconds: 0, chargingPowerLimitW: 0},
                {seconds: 3600, chargingPowerLimitW: 11_000},
                {seconds: 5 * 3600, chargingPowerLimitW: 0},
            ]);
            await vi.advanceTimersByTimeAsync(60 * MINUTE);
            await charging();
            await vi.advanceTimersByTimeAsync(30 * MINUTE);
            // At its limit the car stops: the charge ends.
            await plugged();
            await vi.advanceTimersByTimeAsync(60 * MINUTE);
            // The owner starts "Nur Sonne"; the energy manager switches it on by power.
            await start(EnyoChargeModeEnum.PriceLimit);
            await power(11_000);
            await charging();
            await vi.advanceTimersByTimeAsync(4 * 60 * MINUTE);
            expect(wallbox.switches).toEqual([true, true]);
        });

        it('does not revive an "on" left at the end of an ended charge\'s plan', async () => {
            setUp({minSwitchIntervalMinutes: 15, maxSwitchesPerDay: 10, maxBlocksPerPlugIn: 1});
            await plugged();
            await start(EnyoChargeModeEnum.CostOptimized);
            await schedule([
                {seconds: 0, chargingPowerLimitW: 0},
                {seconds: 3600, chargingPowerLimitW: 11_000},
                {seconds: 3 * 3600, chargingPowerLimitW: 7_000},
            ]);
            await vi.advanceTimersByTimeAsync(60 * MINUTE);
            await charging();
            await vi.advanceTimersByTimeAsync(30 * MINUTE);
            await plugged();
            await vi.advanceTimersByTimeAsync(12 * 60 * MINUTE);
            await start(EnyoChargeModeEnum.CostOptimized);
            expect(wallbox.switches).toEqual([true]);
            // The new charge's own plan decides.
            await schedule([{seconds: 0, chargingPowerLimitW: 11_000}]);
            expect(wallbox.switches).toEqual([true, true]);
        });

        it('does not switch a new smart start on with the "on" of a charge the owner stopped', async () => {
            setUp({minSwitchIntervalMinutes: 15, maxSwitchesPerDay: 4, maxBlocksPerPlugIn: 1});
            await plugged();
            await start(EnyoChargeModeEnum.CostOptimized);
            await power(11_000);
            await charging();
            await vi.advanceTimersByTimeAsync(15 * MINUTE);
            await stop();
            await plugged();
            await vi.advanceTimersByTimeAsync(10 * 60 * MINUTE);

            await start(EnyoChargeModeEnum.CostOptimized);
            expect(wallbox.switches).toEqual([true, false]);
            await power(11_000);
            expect(wallbox.switches).toEqual([true, false, true]);
        });

        it('rejects a start for a car that is not plugged in, under every mode', async () => {
            await unplugged();
            expect(await start(EnyoChargeModeEnum.CostOptimized)).toMatchObject({answer: Rejected});
            expect(await start(EnyoChargeModeEnum.Immediate)).toMatchObject({answer: Rejected});
            expect(wallbox.switches).toEqual([]);
        });
    });

    it('sends no start for a car that is already charging', async () => {
        await charging();
        expect(await power(11_000)).toMatchObject({answer: Accepted});
        expect(wallbox.switches).toEqual([]);
    });

    it('takes a charge the owner starts after enyo switched off as on', async () => {
        await charging();
        await power(0);
        await plugged();
        expect(wallbox.switches).toEqual([false]);

        // The owner starts the car well after enyo's stop: kept, no stop of enyo's own.
        await vi.advanceTimersByTimeAsync(30 * MINUTE);
        await charging();
        await vi.advanceTimersByTimeAsync(60 * MINUTE);
        expect(wallbox.switches).toEqual([false]);

        // Only the energy manager's next "off" stops it again.
        await power(0);
        expect(wallbox.switches).toEqual([false, false]);
    });

    it('takes the handshake window from the options', async () => {
        setUp({plugInHandshakeMinutes: 2});
        await plugged();
        await power(0);
        await vi.advanceTimersByTimeAsync(3 * MINUTE);
        await charging();
        await vi.advanceTimersByTimeAsync(0);
        expect(wallbox.switches).toEqual([]);
    });

    it('stops a car whose cloud reports the start of charging a few minutes late', async () => {
        await plugged();
        await power(0);
        expect(wallbox.switches).toEqual([]);
        await vi.advanceTimersByTimeAsync(6 * MINUTE);
        await charging();
        await vi.advanceTimersByTimeAsync(0);
        expect(wallbox.switches).toEqual([false]);
    });

    it('keeps a charge the owner starts long after an idle plug-in', async () => {
        await plugged();
        await power(0);
        await vi.advanceTimersByTimeAsync(30 * MINUTE);
        await charging();
        await vi.advanceTimersByTimeAsync(60 * MINUTE);
        expect(wallbox.switches).toEqual([]);
    });

    it('stops a car that keeps starting by itself at most once per plug-in, with production limits', async () => {
        sdk = installSdk();
        wallbox.stop();
        wallbox = new TestWallbox();
        wallbox.start();
        await plugged();
        await power(0);
        expect(wallbox.switches).toEqual([]);
        await charging();
        await vi.advanceTimersByTimeAsync(0);
        expect(wallbox.switches).toEqual([false]);

        for (let cycle = 0; cycle < 6; cycle++) {
            await plugged();
            await vi.advanceTimersByTimeAsync(10 * MINUTE);
            await charging();
            await vi.advanceTimersByTimeAsync(60 * MINUTE);
        }
        expect(wallbox.switches).toEqual([false]);
    });

    it('lets "Sofort laden" after a stop override the plan from before it', async () => {
        await charging();
        await schedule([
            {seconds: 0, chargingPowerLimitW: 0},
            {seconds: 3600, chargingPowerLimitW: 11_000},
            {seconds: 7200, chargingPowerLimitW: 0},
        ]);
        await plugged();
        await stop();
        await start(EnyoChargeModeEnum.Immediate);
        await charging();
        await vi.advanceTimersByTimeAsync(7200 * 1000);
        expect(wallbox.switches).toEqual([false, true]);
    });

    it('counts a counter the vehicle restarts as new energy', async () => {
        await charging({chargingPowerW: 3_000, sessionEnergyWh: 5_000});
        await charging({chargingPowerW: 3_000, sessionEnergyWh: 6_000});
        await charging({chargingPowerW: 3_000, sessionEnergyWh: 500});
        expect(meters().map((m) => m.data.energyDeliveredWh)).toEqual([0, 1_000, 1_500]);
    });

    it('publishes the last meter value again every minute while the car reports nothing new', async () => {
        await charging({chargingPowerW: 11_000, sessionEnergyWh: 1_000});
        expect(meters()).toHaveLength(1);

        await vi.advanceTimersByTimeAsync(3 * MINUTE);
        expect(meters()).toHaveLength(4);
        expect(meters().at(-1)?.data).toMatchObject({chargingPowerW: 11_000, context: 'Sample.Periodic'});

        await unplugged();
        const count = meters().length;
        await vi.advanceTimersByTimeAsync(3 * MINUTE);
        expect(meters()).toHaveLength(count);
    });

    it('publishes no meter value while the car charges without telling its power', async () => {
        await charging();
        await charging({sessionEnergyWh: 100});
        expect(started()).toHaveLength(1);
        expect(meters()).toHaveLength(0);
    });

    describe('after a restart', () => {
        const openCharge = {
            transactionId: 'tx-old', chargeMode: EnyoChargeModeEnum.CostOptimized, meterStartValueWh: 1_000, totalEnergyKwh: 2,
        };

        function restart(stored = new Map<string, unknown>()) {
            wallbox.stop();
            sdk = installSdk(undefined, stored, openCharge);
            wallbox = new TestWallbox({minSwitchIntervalMinutes: 15, maxSwitchesPerDay: 4, maxBlocksPerPlugIn: 100});
            wallbox.start();
        }

        it('takes over the charge the host still holds open instead of announcing a new one', async () => {
            restart();
            await charging({chargingPowerW: 11_000, sessionEnergyWh: 0});
            await charging({chargingPowerW: 11_000, sessionEnergyWh: 500});

            expect(started()).toHaveLength(0);
            expect(meters().map((m) => [m.data.transactionId, m.data.meterValueWh, m.data.energyDeliveredWh]))
                .toEqual([['tx-old', 3_000, 2_000], ['tx-old', 3_500, 2_500]]);
        });

        it('closes that charge when the car no longer charges', async () => {
            restart();
            await vi.advanceTimersByTimeAsync(3 * MINUTE);
            await plugged();
            expect(stopped()).toHaveLength(1);
            expect(stopped()[0].data).toMatchObject({transactionId: 'tx-old', stopReason: EnyoChargingStopReason.Other});
        });

        it('keeps a paused charge paused', async () => {
            await plugged();
            await charging();
            await power(0);
            restart(sdk.stored);
            await plugged();

            expect(statuses()).toEqual([Suspended]);
            expect(stopped()).toHaveLength(0);
        });
    });

    it('keeps the registry status in step and retries a failed write', async () => {
        const updateAppliance = vi.fn()
            .mockRejectedValueOnce(new Error('store busy'))
            .mockResolvedValue(undefined);
        setUp({applianceManager: {updateAppliance} as unknown as ApplianceManager, applianceIds: [CAR]});

        await plugged();
        await vi.advanceTimersByTimeAsync(0);
        await plugged();
        await vi.advanceTimersByTimeAsync(0);
        await plugged();
        await vi.advanceTimersByTimeAsync(0);
        await charging();
        await vi.advanceTimersByTimeAsync(0);

        expect(updateAppliance.mock.calls.map(([, patch]) => patch.charger.status)).toEqual([Occupied, Occupied, Charging]);
    });
});
