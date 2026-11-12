import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {
    EnyoChargeInitiatorEnum,
    EnyoChargeModeEnum,
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
        useCharge: () => ({findActiveCharge: () => Promise.resolve(openCharge ?? null)}),
        useStorage: () => ({
            load: async (key: string) => stored.get(key) ?? null,
            save: async (key: string, value: unknown) => { stored.set(key, value); },
        }),
    };
    return {sent, listeners, stored};
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

const start = (chargeMode = EnyoChargeModeEnum.CostOptimized, vehicleId?: string, targetSocPercent?: number) =>
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
        await plugged();
        await schedule([{seconds: 0, chargingPowerLimitW: 0}, {seconds: 3600, chargingPowerLimitW: 11_000}]);
        expect(wallbox.switches).toEqual([false]);

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

    it('opens the session of a start with the command\'s mode once the car charges', async () => {
        await plugged();
        await start(EnyoChargeModeEnum.CostOptimized, 'v-9');
        expect(started()).toHaveLength(0);

        await charging({chargingPowerW: 7_000});
        expect(started()[0].data).toMatchObject({
            initiator: EnyoChargeInitiatorEnum.App,
            chargeMode: EnyoChargeModeEnum.CostOptimized,
            vehicleId: 'v-9',
        });
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

    it('takes a start for a running session as a change of mode, within the switching limits', async () => {
        await plugged();
        await charging();
        await power(0);
        expect(await start(EnyoChargeModeEnum.Immediate)).toMatchObject({answer: Accepted});
        expect(wallbox.switches).toEqual([false]);
        await vi.advanceTimersByTimeAsync(15 * MINUTE);
        expect(wallbox.switches).toEqual([false, true]);
    });

    it('hands the target of the start command to the switch, and keeps it for the session', async () => {
        setUp({maxSwitchesPerDay: 10});
        await plugged();
        await start(EnyoChargeModeEnum.CostOptimized, undefined, 90);
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

    it('sends no start for a car that is already charging', async () => {
        await charging();
        expect(await power(11_000)).toMatchObject({answer: Accepted});
        expect(wallbox.switches).toEqual([]);
    });

    it('takes a charge the owner starts after enyo switched off as on', async () => {
        await plugged();
        await power(0);
        await charging();
        await vi.advanceTimersByTimeAsync(15 * MINUTE);
        await power(0);
        expect(wallbox.switches).toEqual([false, false]);
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
