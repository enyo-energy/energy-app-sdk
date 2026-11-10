import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {
    EnyoCommandAcknowledgeAnswerEnum,
    EnyoDataBusCommandAcknowledgeV1,
    EnyoDataBusCommandReasonTypeEnum,
    EnyoDataBusGridOperatorPowerLimitationV1,
    EnyoDataBusHeatpumpControlV3,
    EnyoDataBusMessage,
    EnyoDataBusMessageEnum,
    EnyoDataBusPauseChargingV1,
    EnyoDataBusVacationStartedV1,
    EnyoDataBusVacationStoppedV1,
    EnyoHeatpumpControlTargetEnum,
    EnyoPowerSourceEnum,
    EnyoVacationHeatingEnum,
} from '../../types/enyo-data-bus-value.js';
import {
    EnyoHeatpumpApplianceAvailableFeaturesEnum as Feature,
    EnyoHeatpumpApplianceMetadata,
} from '../../types/enyo-heatpump-appliance.js';
import {EnyoApplianceTypeEnum} from '../../types/enyo-appliance.js';
import {EnyoSourceEnum} from '../../types/enyo-source.enum.js';
import {VACATION_FROST_PROTECTION_C} from '../../types/enyo-vacation.js';
import {installSdk, TestHeatpump} from '../../implementations/heatpump/__tests__/heatpump-test-harness.js';
import {IntegrationCommandHandler, IntegrationEnergyApp} from '../integration-energy-app.js';
import {IntegrationCommandResponse} from '../integration-types.js';

// ENY-1503: a command addressed to an appliance the app does not own (it reaches
// the app through `AllAppliances` or the hub's fallback routing) must neither run
// a handler nor its pre-dispatch validation / metadata reads, nor be acknowledged.

const {Accepted, NotSupported} = EnyoCommandAcknowledgeAnswerEnum;
const OWN = 'hp-1';
const FOREIGN = 'hp-of-another-package';

const METADATA: EnyoHeatpumpApplianceMetadata = {
    availableFeatures: [Feature.VacationFrostProtection, Feature.VacationHotWaterPause, Feature.DomesticHotWaterOverheating],
    heatingCircuits: [{index: 0}],
    domesticHotWater: [{index: 0, targetTemperatureC: 50, maxTemperatureC: 60}],
};

type Sdk = ReturnType<typeof installSdk>;

/** Hands `message` to every listener subscribed to its type, as the data bus would. */
function deliver(sdk: Sdk, message: EnyoDataBusMessage): void {
    for (const listener of sdk.listeners) {
        if (listener.types.includes(message.message)) listener.cb(message);
    }
}

/** Lets the fire-and-forget dispatch of a delivered message run to completion. */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** The acknowledgments the app sent. */
const acks = (sdk: Sdk) => sdk.sent.filter(
    (m): m is EnyoDataBusCommandAcknowledgeV1 => m.message === EnyoDataBusMessageEnum.CommandAcknowledgeV1,
);

const envelope = (message: EnyoDataBusMessageEnum, applianceId: string | undefined) => ({
    id: `${message}-${applianceId ?? 'none'}`,
    type: 'message' as const,
    source: EnyoSourceEnum.Device,
    ...(applianceId !== undefined ? {applianceId} : {}),
    timestampIso: new Date().toISOString(),
});

const vacationStarted = (applianceId: string | undefined): EnyoDataBusVacationStartedV1 => ({
    ...envelope(EnyoDataBusMessageEnum.VacationStartedV1, applianceId),
    message: EnyoDataBusMessageEnum.VacationStartedV1,
    applianceId: applianceId as string,
    data: {
        vacationId: 'vacation-1',
        returnIso: new Date(Date.now() + 7 * 86_400_000).toISOString(),
        heatpump: {
            heating: {mode: EnyoVacationHeatingEnum.FrostProtection, targetTemperatureC: VACATION_FROST_PROTECTION_C},
            domesticHotWater: {pause: true},
        },
        reason: {type: EnyoDataBusCommandReasonTypeEnum.UserRequest},
    },
});

const vacationStopped = (applianceId: string): EnyoDataBusVacationStoppedV1 => ({
    ...envelope(EnyoDataBusMessageEnum.VacationStoppedV1, applianceId),
    message: EnyoDataBusMessageEnum.VacationStoppedV1,
    applianceId,
    data: {vacationId: 'vacation-1'},
});

const heatpumpControl = (applianceId: string): EnyoDataBusHeatpumpControlV3 => ({
    ...envelope(EnyoDataBusMessageEnum.HeatpumpControlV3, applianceId),
    message: EnyoDataBusMessageEnum.HeatpumpControlV3,
    applianceId,
    data: {
        sessionId: 's1',
        validUntilIso: new Date(Date.now() + 60_000).toISOString(),
        availablePowerW: 2400,
        powerSources: [{source: EnyoPowerSourceEnum.Pv, powerW: 2400}],
        actions: [{target: EnyoHeatpumpControlTargetEnum.Dhw, index: 0, deltaK: 5}],
    },
});

const gridLimitation = (applianceId?: string): EnyoDataBusGridOperatorPowerLimitationV1 => ({
    ...envelope(EnyoDataBusMessageEnum.GridOperatorPowerLimitationV1, applianceId),
    message: EnyoDataBusMessageEnum.GridOperatorPowerLimitationV1,
    data: {active: true, powerLimitationW: 4200, endTimestampIso: new Date(Date.now() + 3_600_000).toISOString()},
});

/**
 * A heat pump app that owns only {@link OWN} and says so through
 * `extractApplianceId` — the pattern every multi-package app follows. Records
 * every metadata read.
 */
class OwnHeatpump extends TestHeatpump {
    readonly metadataReads: Array<string | undefined> = [];

    protected override extractApplianceId(message: EnyoDataBusMessage): string | undefined {
        const applianceId = super.extractApplianceId(message);
        return applianceId === OWN ? applianceId : undefined;
    }

    protected override async resolveHeatpumpMetadata(applianceId: string) {
        this.metadataReads.push(applianceId);
        return super.resolveHeatpumpMetadata(applianceId);
    }
}

describe('HeatpumpIntegrationEnergyApp — commands for a foreign heat pump', () => {
    let sdk: Sdk;
    let app: OwnHeatpump;

    beforeEach(() => {
        // The foreign pump declares no vacation features: validating its vacation would answer
        // NotSupported — the answer the energy manager takes as final and cancels the vacation on.
        sdk = installSdk({[OWN]: {heatpump: METADATA}, [FOREIGN]: {heatpump: {availableFeatures: []}}});
        app = new OwnHeatpump();
        app.vacationStartedResponse = async () => ({answer: Accepted});
        app.vacationStoppedResponse = async () => ({answer: Accepted});
        app.controlResponse = async () => ({answer: Accepted});
        app.start();
    });

    afterEach(() => app.stop());

    it('drops a foreign VacationStartedV1: no metadata read, no handler, no ack', async () => {
        deliver(sdk, vacationStarted(FOREIGN));
        await settle();
        expect(app.metadataReads).toEqual([]);
        expect(app.vacationStarts).toEqual([]);
        expect(acks(sdk)).toEqual([]);
    });

    it('drops a foreign VacationStoppedV1: no handler, no ack', async () => {
        deliver(sdk, vacationStopped(FOREIGN));
        await settle();
        expect(app.vacationStops).toEqual([]);
        expect(acks(sdk)).toEqual([]);
    });

    it('drops a foreign HeatpumpControlV3: no handler, no session, no ack', async () => {
        deliver(sdk, heatpumpControl(FOREIGN));
        await settle();
        expect(app.controls).toEqual([]);
        expect(app.metadataReads).toEqual([]);
        expect(acks(sdk)).toEqual([]);
        // No session was tracked for it: an empty V3 for the foreign pump ends nothing either.
        deliver(sdk, {...heatpumpControl(FOREIGN), data: {...heatpumpControl(FOREIGN).data, actions: [], availablePowerW: undefined}});
        await settle();
        expect(app.ended).toEqual([]);
    });

    it('handles and acknowledges the own heat pump as before', async () => {
        deliver(sdk, vacationStarted(OWN));
        deliver(sdk, vacationStopped(OWN));
        deliver(sdk, heatpumpControl(OWN));
        await settle();
        expect(app.metadataReads).toEqual([OWN]);
        expect(app.vacationStarts.map((m) => m.applianceId)).toEqual([OWN]);
        expect(app.vacationStops.map((m) => m.applianceId)).toEqual([OWN]);
        expect(app.controls.map((m) => m.applianceId)).toEqual([OWN]);
        const answered = acks(sdk).map((a) => `${a.applianceId} ${a.data.acknowledgeMessage} ${a.data.answer}`).sort();
        expect(answered).toEqual([
            `${OWN} ${EnyoDataBusMessageEnum.HeatpumpControlV3} ${Accepted}`,
            `${OWN} ${EnyoDataBusMessageEnum.VacationStartedV1} ${Accepted}`,
            `${OWN} ${EnyoDataBusMessageEnum.VacationStoppedV1} ${Accepted}`,
        ]);
    });

    it('still runs the handler for a command without an applianceId, without an ack', async () => {
        deliver(sdk, vacationStarted(undefined));
        await settle();
        expect(app.vacationStarts).toHaveLength(1);
        expect(app.metadataReads).toEqual([undefined]);
        expect(acks(sdk)).toEqual([]);
    });

    it('keeps fanning GridOperatorPowerLimitationV1 (§14a) out over the managed appliances', async () => {
        deliver(sdk, gridLimitation());
        deliver(sdk, gridLimitation(FOREIGN));
        await settle();
        expect(acks(sdk).map((a) => [a.applianceId, a.data.answer])).toEqual([[OWN, Accepted], [OWN, Accepted]]);
    });
});

/** A minimal integration with one `PauseChargingV1` handler (applianceId inside `data`). */
class TestCharger extends IntegrationEnergyApp {
    readonly pauses: EnyoDataBusPauseChargingV1[] = [];

    /** @param owned - The appliances this app claims; `undefined` keeps the base class's default. */
    constructor(private readonly owned?: string[]) {
        super({source: EnyoSourceEnum.Device, applianceIds: ['wb-1'], autoStart: false, autoStopOnShutdown: false});
    }

    protected get managedApplianceType(): EnyoApplianceTypeEnum {
        return EnyoApplianceTypeEnum.Charger;
    }

    protected registerHandlers(): void {
        this.registerCommandHandler<EnyoDataBusPauseChargingV1>(EnyoDataBusMessageEnum.PauseChargingV1, async (message) => {
            this.pauses.push(message);
            return {answer: Accepted};
        });
    }

    protected override extractApplianceId(message: EnyoDataBusMessage): string | undefined {
        const applianceId = super.extractApplianceId(message);
        if (this.owned === undefined) return applianceId;
        return applianceId !== undefined && this.owned.includes(applianceId) ? applianceId : undefined;
    }

    protected async handleGridOperatorPowerLimitation(): Promise<IntegrationCommandResponse> {
        return {answer: Accepted};
    }
}

/** An app that already filters foreign commands with its own `registerCommandHandler` wrapper (pre-1.62 workaround). */
class WrappingCharger extends TestCharger {
    readonly wrapperCalls: string[] = [];

    protected override registerCommandHandler<T extends EnyoDataBusMessage>(
        messageType: EnyoDataBusMessageEnum,
        handler: IntegrationCommandHandler<T>,
    ): void {
        super.registerCommandHandler<T>(messageType, async (message: T) => {
            const applianceId = super.extractApplianceId(message);
            this.wrapperCalls.push(applianceId ?? '-');
            if (applianceId !== undefined && applianceId !== 'wb-1') return {answer: NotSupported};
            return handler(message);
        });
    }
}

const pause = (applianceId: string): EnyoDataBusPauseChargingV1 => ({
    ...envelope(EnyoDataBusMessageEnum.PauseChargingV1, undefined),
    message: EnyoDataBusMessageEnum.PauseChargingV1,
    data: {applianceId},
});

describe('IntegrationEnergyApp — foreign-command guard', () => {
    let sdk: Sdk;

    beforeEach(() => {
        sdk = installSdk({});
    });

    it('reads the addressed appliance from data.applianceId too', async () => {
        const app = new TestCharger(['wb-1']);
        app.start();
        deliver(sdk, pause('wb-foreign'));
        await settle();
        expect(app.pauses).toEqual([]);
        expect(acks(sdk)).toEqual([]);

        deliver(sdk, pause('wb-1'));
        await settle();
        expect(app.pauses).toHaveLength(1);
        expect(acks(sdk).map((a) => [a.applianceId, a.data.answer])).toEqual([['wb-1', Accepted]]);
        app.stop();
    });

    it('changes nothing for an app that keeps the default extractApplianceId', async () => {
        const app = new TestCharger();
        app.start();
        deliver(sdk, pause('wb-anything'));
        await settle();
        expect(app.pauses).toHaveLength(1);
        expect(acks(sdk).map((a) => a.applianceId)).toEqual(['wb-anything']);
        app.stop();
    });

    it('stays compatible with an app that wraps registerCommandHandler itself', async () => {
        const app = new WrappingCharger(['wb-1']);
        app.start();
        deliver(sdk, pause('wb-foreign'));
        await settle();
        expect(app.wrapperCalls).toEqual([]);
        expect(app.pauses).toEqual([]);
        expect(acks(sdk)).toEqual([]);

        deliver(sdk, pause('wb-1'));
        await settle();
        expect(app.wrapperCalls).toEqual(['wb-1']);
        expect(app.pauses).toHaveLength(1);
        expect(acks(sdk).map((a) => [a.applianceId, a.data.answer])).toEqual([['wb-1', Accepted]]);
        app.stop();
    });
});
