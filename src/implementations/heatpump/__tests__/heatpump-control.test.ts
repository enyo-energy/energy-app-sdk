import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {
    EnyoCommandAcknowledgeAnswerEnum,
    EnyoDataBusCommandAcknowledgeV1,
    EnyoDataBusHeatpumpControlStatusV3,
    EnyoHeatpumpControlActionStateEnum,
    EnyoDataBusHeatpumpControlV3,
    EnyoDataBusMessageEnum,
    EnyoHeatpumpControlAction,
    EnyoHeatpumpControlTargetEnum,
    EnyoHeatpumpHeatSourceEnum,
    EnyoPowerSourceEnum,
    EnyoPowerSourceShare,
} from '../../../types/enyo-data-bus-value.js';
import {
    EnyoHeatpumpApplianceAvailableFeaturesEnum as Feature,
    EnyoHeatpumpApplianceMetadata,
    EnyoHeatpumpHeatingControlReferenceEnum,
} from '../../../types/enyo-heatpump-appliance.js';
import {EnyoSourceEnum} from '../../../types/enyo-source.enum.js';
import {isPvOnlyPowerSources, validateHeatpumpControlAction} from '../heatpump-control-validators.js';
import {
    HeatpumpControlEndCauseEnum,
    heatpumpControlActionsKey,
    HeatpumpControlSessionTracker,
} from '../heatpump-control-session.js';
import {validateHeatpumpAdvancedMetadata} from '../heatpump-metadata-validators.js';
import {computeHeatpumpSetpointRaise} from '../heatpump-control-validators.js';
import {IntegrationCommandResponse} from '../../../integrations/integration-types.js';
import {combineHeatpumpControlAnswers} from '../../../integrations/heatpump-integration-energy-app.js';
import {installSdk, TestHeatpump} from './heatpump-test-harness.js';

const {Accepted, Rejected, NotSupported} = EnyoCommandAcknowledgeAnswerEnum;

const PV: EnyoPowerSourceShare[] = [{source: EnyoPowerSourceEnum.Pv, powerW: 2400}];
const PV_AND_GRID: EnyoPowerSourceShare[] = [...PV, {source: EnyoPowerSourceEnum.Grid, powerW: 600}];

const METADATA: EnyoHeatpumpApplianceMetadata = {
    availableFeatures: [
        Feature.DomesticHotWaterOverheating,
        Feature.BufferTankOverheating,
        Feature.HeatingRodControllable,
        Feature.PvSurplusSignal,
    ],
    domesticHotWater: [{index: 0, targetTemperatureC: 50, maxTemperatureC: 60}],
    bufferTanks: [{index: 0}],
    heatingCircuits: [{index: 0}],
};

const dhw = (overrides: Partial<EnyoHeatpumpControlAction> = {}): EnyoHeatpumpControlAction => ({
    target: EnyoHeatpumpControlTargetEnum.Dhw, index: 0, deltaK: 8, ...overrides,
});

describe('validateHeatpumpControlAction', () => {
    it('accepts a supported DHW action within the maximum', () => {
        expect(validateHeatpumpControlAction(dhw(), METADATA, PV))
            .toEqual({target: EnyoHeatpumpControlTargetEnum.Dhw, index: 0, answer: Accepted});
    });

    it('accepts raising DHW exactly to maxTemperatureC, rejects one Kelvin more', () => {
        expect(validateHeatpumpControlAction(dhw({deltaK: 10}), METADATA, PV).answer).toBe(Accepted);
        const result = validateHeatpumpControlAction(dhw({deltaK: 11}), METADATA, PV);
        expect(result.answer).toBe(Rejected);
        expect(result.rejectionReason).toMatch(/maxTemperatureC of 60/);
    });

    it('rejects a heating rod unless the power sources are PV alone', () => {
        for (const sources of [undefined, [], PV_AND_GRID]) {
            const result = validateHeatpumpControlAction(
                dhw({heatSource: EnyoHeatpumpHeatSourceEnum.HeatingRod}), METADATA, sources,
            );
            expect(result.answer).toBe(Rejected);
            expect(result.rejectionReason).toMatch(/PV surplus/);
        }
        expect(validateHeatpumpControlAction(dhw({heatSource: EnyoHeatpumpHeatSourceEnum.Both}), METADATA, PV).answer)
            .toBe(Accepted);
        expect(validateHeatpumpControlAction(dhw({heatSource: EnyoHeatpumpHeatSourceEnum.Compressor}), METADATA, PV_AND_GRID).answer)
            .toBe(Accepted);
    });

    it('answers NotSupported for a heating rod without HeatingRodControllable', () => {
        const metadata = {...METADATA, availableFeatures: [Feature.DomesticHotWaterOverheating]};
        expect(validateHeatpumpControlAction(dhw({heatSource: EnyoHeatpumpHeatSourceEnum.HeatingRod}), metadata, PV).answer)
            .toBe(NotSupported);
    });

    it('answers NotSupported when the target overheating feature is missing', () => {
        const result = validateHeatpumpControlAction({target: EnyoHeatpumpControlTargetEnum.Room, deltaK: 1}, METADATA, PV);
        expect(result.answer).toBe(NotSupported);
        expect(result.rejectionReason).toMatch(/RoomOverheating/);
    });

    it('rejects an index the metadata does not list', () => {
        expect(validateHeatpumpControlAction(dhw({index: 3}), METADATA, PV).answer).toBe(Rejected);
    });

    it('rejects a non-positive or non-finite deltaK', () => {
        for (const deltaK of [0, -2, Number.NaN]) {
            expect(validateHeatpumpControlAction(dhw({deltaK}), METADATA, PV).answer, String(deltaK)).toBe(Rejected);
        }
    });

    it('without metadata checks only what the message itself says', () => {
        expect(validateHeatpumpControlAction(dhw({deltaK: 40}), undefined, PV).answer).toBe(Accepted);
        expect(validateHeatpumpControlAction(dhw({heatSource: EnyoHeatpumpHeatSourceEnum.HeatingRod}), undefined, PV_AND_GRID).answer)
            .toBe(Rejected);
    });

    it('isPvOnlyPowerSources needs at least one share, all PV', () => {
        expect(isPvOnlyPowerSources(PV)).toBe(true);
        expect(isPvOnlyPowerSources([])).toBe(false);
        expect(isPvOnlyPowerSources(undefined)).toBe(false);
        expect(isPvOnlyPowerSources(PV_AND_GRID)).toBe(false);
    });
});

describe('validateHeatpumpAdvancedMetadata — heatingControlReference', () => {
    it('accepts the enum values and rejects anything else', () => {
        const check = (heatingControlReference: unknown) => validateHeatpumpAdvancedMetadata({
            availableFeatures: [],
            heatingCircuits: [{index: 0, heatingControlReference: heatingControlReference as EnyoHeatpumpHeatingControlReferenceEnum}],
        });
        expect(check(EnyoHeatpumpHeatingControlReferenceEnum.Outdoor).ok).toBe(true);
        expect(check(EnyoHeatpumpHeatingControlReferenceEnum.Room).ok).toBe(true);
        expect(check('weather').errors[0]).toMatch(/heatingControlReference "weather"/);
    });
});

describe('combineHeatpumpControlAnswers', () => {
    it('is Accepted as soon as one part is accepted', () => {
        expect(combineHeatpumpControlAnswers([NotSupported, Rejected, Accepted])).toBe(Accepted);
    });
    it('is NotSupported only when nothing is supported', () => {
        expect(combineHeatpumpControlAnswers([NotSupported, NotSupported])).toBe(NotSupported);
        expect(combineHeatpumpControlAnswers([NotSupported, Rejected])).toBe(Rejected);
    });
});

const T0 = Date.parse('2026-10-14T11:00:00.000Z');
const iso = (offsetMs: number) => new Date(T0 + offsetMs).toISOString();

describe('HeatpumpControlSessionTracker', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(T0);
    });
    afterEach(() => vi.useRealTimers());

    const data = (overrides: Partial<EnyoDataBusHeatpumpControlV3['data']> = {}): EnyoDataBusHeatpumpControlV3['data'] => ({
        sessionId: 's1', validUntilIso: iso(60_000), actions: [dhw()], ...overrides,
    });

    it('continues a session with the same id and actions, restarts on a change', () => {
        const tracker = new HeatpumpControlSessionTracker(() => undefined);
        expect(tracker.track('hp', data()).isNew).toBe(true);
        expect(tracker.track('hp', data({validUntilIso: iso(70_000)})).isNew).toBe(false);
        expect(tracker.track('hp', data({actions: [dhw({deltaK: 5})]})).isNew).toBe(true);
        expect(tracker.track('hp', data({sessionId: 's2', actions: [dhw({deltaK: 5})]})).isNew).toBe(true);
    });

    it('keys actions independently of their order', () => {
        const buffer: EnyoHeatpumpControlAction = {target: EnyoHeatpumpControlTargetEnum.BufferTank, deltaK: 3};
        expect(heatpumpControlActionsKey([dhw(), buffer])).toBe(heatpumpControlActionsKey([buffer, dhw()]));
    });

    it('expires at validUntilIso unless a repeat moved it, and end() does not report expiry', () => {
        const expired: string[] = [];
        const tracker = new HeatpumpControlSessionTracker((id) => expired.push(id));
        tracker.track('hp', data());
        vi.advanceTimersByTime(30_000);
        tracker.track('hp', data({validUntilIso: iso(90_000)}));
        vi.advanceTimersByTime(40_000);
        expect(expired).toEqual([]);
        vi.advanceTimersByTime(20_000);
        expect(expired).toEqual(['hp']);
        expect(tracker.get('hp')).toBeUndefined();

        tracker.track('hp', data({validUntilIso: iso(200_000)}));
        expect(tracker.end('hp')).toBe(true);
        vi.advanceTimersByTime(200_000);
        expect(expired).toEqual(['hp']);
    });
});

const controlMessage = (
    data: Partial<EnyoDataBusHeatpumpControlV3['data']> = {},
    nowMs: number = T0,
): EnyoDataBusHeatpumpControlV3 => ({
    id: `msg-${nowMs}`,
    type: 'message',
    message: EnyoDataBusMessageEnum.HeatpumpControlV3,
    source: EnyoSourceEnum.Device,
    applianceId: 'hp-1',
    timestampIso: new Date(nowMs).toISOString(),
    data: {
        sessionId: 's1',
        validUntilIso: new Date(nowMs + 60_000).toISOString(),
        availablePowerW: 2400,
        powerSources: PV,
        actions: [dhw()],
        ...data,
    },
});

const V3_METADATA: EnyoHeatpumpApplianceMetadata = {
    ...METADATA,
    availableFeatures: [...METADATA.availableFeatures, Feature.ControlV3],
};

describe('HeatpumpIntegrationEnergyApp — HeatpumpControlV3 defaults', () => {
    let app: TestHeatpump;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(T0);
        installSdk({'hp-1': {heatpump: METADATA}});
        app = new TestHeatpump();
    });
    afterEach(() => {
        app.stop();
        vi.useRealTimers();
    });

    it('answers NotSupported and tracks nothing when the integration does not implement V3', async () => {
        const response = await app.control(controlMessage());
        expect(response.answer).toBe(NotSupported);
        await vi.advanceTimersByTimeAsync(120_000);
        expect(app.ended).toEqual([]);
    });

    it('answers a cancel NotSupported for a heatpump without ControlV3', async () => {
        expect((await app.cancel('s1')).answer).toBe(NotSupported);
    });
});

describe('HeatpumpIntegrationEnergyApp — HeatpumpControlV3 session layer', () => {
    let app: TestHeatpump;
    const accepted = async (): Promise<IntegrationCommandResponse> => ({answer: Accepted});

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(T0);
        installSdk({'hp-1': {heatpump: V3_METADATA}});
        app = new TestHeatpump();
        app.controlResponse = accepted;
    });
    afterEach(() => {
        app.stop();
        vi.useRealTimers();
    });

    /** Moves the clock and sends the next repeat of the session. */
    const repeatAt = (offsetMs: number, data: Partial<EnyoDataBusHeatpumpControlV3['data']> = {}) => {
        vi.setSystemTime(T0 + offsetMs);
        return app.control(controlMessage(data, T0 + offsetMs));
    };

    it('passes every message to the integration and tells it when the session or actions changed', async () => {
        await app.control(controlMessage());
        await repeatAt(10_000);
        await repeatAt(20_000, {actions: [dhw({deltaK: 5})]});
        await repeatAt(30_000, {sessionId: 's2', actions: [dhw({deltaK: 5})]});
        expect(app.controls).toHaveLength(4);
        expect(app.changed).toEqual([true, false, true, true]);
    });

    it('returns the integration\'s answer unchanged, applied values included', async () => {
        const response: IntegrationCommandResponse = {
            answer: Accepted,
            actionResults: [{
                target: EnyoHeatpumpControlTargetEnum.Dhw, index: 0, answer: Accepted,
                appliedTargetTemperatureC: 58, appliedDeltaK: 8,
            }],
        };
        app.controlResponse = async () => response;
        expect(await app.control(controlMessage())).toBe(response);
    });

    it('reports Expired when no repeat arrives by validUntilIso', async () => {
        await app.control(controlMessage());
        await vi.advanceTimersByTimeAsync(30_000);
        await repeatAt(30_000);
        await vi.advanceTimersByTimeAsync(59_000);
        expect(app.ended).toEqual([]);
        await vi.advanceTimersByTimeAsync(2_000);
        expect(app.ended).toEqual([['hp-1', HeatpumpControlEndCauseEnum.Expired]]);
    });

    it('passes an empty message to the integration first, then reports Ended', async () => {
        await app.control(controlMessage());
        await repeatAt(10_000, {actions: [], availablePowerW: undefined});
        expect(app.controls).toHaveLength(2);
        expect(app.ended).toEqual([['hp-1', HeatpumpControlEndCauseEnum.Ended]]);
    });

    it('rejects a message whose validUntilIso has passed or is not ISO 8601, without calling the integration', async () => {
        for (const validUntilIso of [iso(-1), 'soon']) {
            const response = await app.control(controlMessage({validUntilIso}));
            expect(response.answer).toBe(Rejected);
            expect(response.actionResults![0]!.answer).toBe(Rejected);
        }
        expect(app.controls).toHaveLength(0);
    });

    it('cancels the named session and reports Cancelled', async () => {
        await app.control(controlMessage());
        expect(await app.cancel('s1')).toEqual({answer: Accepted});
        expect(app.ended).toEqual([['hp-1', HeatpumpControlEndCauseEnum.Cancelled]]);
        await vi.advanceTimersByTimeAsync(120_000);
        expect(app.ended).toHaveLength(1);
    });

    it('leaves a newer session untouched on a cancel, and is idempotent', async () => {
        await app.control(controlMessage({sessionId: 's2'}));
        expect(await app.cancel('s1')).toEqual({answer: Accepted});
        expect(app.ended).toEqual([]);
        app.stop();
        expect(await app.cancel('s2')).toEqual({answer: Accepted});
        expect(app.ended).toEqual([]);
    });

    it('checks actions against the metadata for the integration', async () => {
        const results = await app.check(controlMessage({
            actions: [dhw(), {target: EnyoHeatpumpControlTargetEnum.Room, deltaK: 1}],
        }));
        expect(results.map((r) => r.answer)).toEqual([Accepted, NotSupported]);
    });

    it('publishes control status', () => {
        const {sent} = installSdk({'hp-1': {heatpump: V3_METADATA}});
        const statusApp = new TestHeatpump();
        statusApp.publishHeatpumpControlStatus('hp-1', {
            sessionId: 's1',
            actions: [{
                target: EnyoHeatpumpControlTargetEnum.Dhw, index: 0,
                state: EnyoHeatpumpControlActionStateEnum.Waiting, reason: 'defrost',
            }],
        });
        expect(sent).toHaveLength(1);
        const status = sent[0] as EnyoDataBusHeatpumpControlStatusV3;
        expect(status.message).toBe(EnyoDataBusMessageEnum.HeatpumpControlStatusV3);
        expect(status.applianceId).toBe('hp-1');
        expect(status.data.actions[0]!.state).toBe(EnyoHeatpumpControlActionStateEnum.Waiting);
    });
});

describe('HeatpumpIntegrationEnergyApp — acknowledgment', () => {
    it('subscribes to the V3 commands and passes actionResults into CommandAcknowledgeV1', async () => {
        const {sent, listeners} = installSdk({'hp-1': {heatpump: V3_METADATA}});
        const app = new TestHeatpump();
        app.controlResponse = async () => ({
            answer: Accepted,
            actionResults: [{target: EnyoHeatpumpControlTargetEnum.Dhw, index: 0, answer: Accepted, appliedTargetTemperatureC: 58}],
        });
        app.start();
        expect(listeners.some((l) => l.types.includes(EnyoDataBusMessageEnum.HeatpumpControlCancelV3))).toBe(true);
        const listener = listeners.find((l) => l.types.includes(EnyoDataBusMessageEnum.HeatpumpControlV3));

        const message = controlMessage({}, Date.now());
        listener!.cb(message);
        await vi.waitFor(() => expect(sent).toHaveLength(1));
        app.stop();

        const ack = sent[0] as EnyoDataBusCommandAcknowledgeV1;
        expect(ack.message).toBe(EnyoDataBusMessageEnum.CommandAcknowledgeV1);
        expect(ack.data.messageId).toBe(message.id);
        expect(ack.data.answer).toBe(Accepted);
        expect(ack.data.actionResults).toEqual([
            {target: EnyoHeatpumpControlTargetEnum.Dhw, index: 0, answer: Accepted, appliedTargetTemperatureC: 58},
        ]);
    });
});

describe('computeHeatpumpSetpointRaise', () => {
    const base = {setpointC: 50, deltaK: 2, hysteresisK: 5, maxTemperatureC: 60};

    it('keeps the requested raise when it already starts the device', () => {
        expect(computeHeatpumpSetpointRaise({...base, currentTemperatureC: 44}))
            .toEqual({ok: true, targetTemperatureC: 52, appliedDeltaK: 2});
    });

    it('raises further to clear the hysteresis', () => {
        expect(computeHeatpumpSetpointRaise({...base, currentTemperatureC: 49}))
            .toEqual({ok: true, targetTemperatureC: 54, appliedDeltaK: 4});
    });

    it('uses the requested raise when the current temperature or hysteresis is unknown', () => {
        expect(computeHeatpumpSetpointRaise({setpointC: 50, deltaK: 3}))
            .toEqual({ok: true, targetTemperatureC: 53, appliedDeltaK: 3});
    });

    it('rejects when the maximum leaves no setpoint that starts the device', () => {
        const result = computeHeatpumpSetpointRaise({...base, currentTemperatureC: 57});
        expect(result.ok).toBe(false);
        expect(!result.ok && result.rejectionReason).toMatch(/needs a setpoint of 62 °C/);
    });

    it('rejects a requested raise above the maximum, and a non-positive deltaK', () => {
        expect(computeHeatpumpSetpointRaise({...base, deltaK: 11}).ok).toBe(false);
        expect(computeHeatpumpSetpointRaise({...base, deltaK: 0}).ok).toBe(false);
    });
});

describe('validateHeatpumpAdvancedMetadata — heating cut-off and ControlV3', () => {
    const circuit = (heatingCutoffOutdoorTemperatureC: number) => ({index: 0, heatingCutoffOutdoorTemperatureC});
    const building = {uaWPerK: 300, heatingLimitC: 15, timeConstantH: 30, fittedAtMs: 0};

    it('accepts a plausible cut-off close to the learned heating limit', () => {
        const result = validateHeatpumpAdvancedMetadata({availableFeatures: [], heatingCircuits: [circuit(16)], building});
        expect(result).toEqual({ok: true, errors: [], warnings: []});
    });

    it('warns on an implausible cut-off and on a mismatch with the learned limit', () => {
        expect(validateHeatpumpAdvancedMetadata({availableFeatures: [], heatingCircuits: [circuit(40)]}).warnings.join())
            .toMatch(/outside the plausible/);
        expect(validateHeatpumpAdvancedMetadata({availableFeatures: [], heatingCircuits: [circuit(20)], building}).warnings.join())
            .toMatch(/differs from the learned/);
        expect(validateHeatpumpAdvancedMetadata({availableFeatures: [], heatingCircuits: [circuit(Number.NaN)]}).ok).toBe(false);
    });

    it('warns when ControlV3 is declared without any overheating feature', () => {
        expect(validateHeatpumpAdvancedMetadata({availableFeatures: [Feature.ControlV3]}).warnings.join())
            .toMatch(/ControlV3 is declared without any overheating feature/);
    });
});
