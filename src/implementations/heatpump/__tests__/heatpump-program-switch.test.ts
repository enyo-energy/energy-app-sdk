import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {
    EnyoCommandAcknowledgeAnswerEnum,
    EnyoDataBusCommandReasonTypeEnum,
    EnyoDataBusHeatpumpProgramSwitchV3,
    EnyoHeatpumpControlTargetEnum,
} from '../../../types/enyo-data-bus-value.js';
import {
    EnyoHeatpumpApplianceAvailableFeaturesEnum as Feature,
    EnyoHeatpumpApplianceMetadata,
    EnyoHeatpumpProgramModeEnum as Mode,
} from '../../../types/enyo-heatpump-appliance.js';
import {validateHeatpumpProgramSwitch} from '../heatpump-control-validators.js';
import {validateHeatpumpAdvancedMetadata} from '../heatpump-metadata-validators.js';
import {HeatpumpProgramSwitchCauseEnum} from '../../../integrations/heatpump-integration-energy-app.js';
import {installSdk, TestHeatpump} from './heatpump-test-harness.js';

const {Accepted, Rejected, NotSupported} = EnyoCommandAcknowledgeAnswerEnum;
const NOW = Date.parse('2026-10-18T17:00:00.000Z');
const inMinutes = (minutes: number) => new Date(NOW + minutes * 60_000).toISOString();

const METADATA: EnyoHeatpumpApplianceMetadata = {
    availableFeatures: [Feature.ProgramSwitch],
    heatingCircuits: [{
        index: 0,
        supportedProgramModes: [Mode.Comfort, Mode.Eco],
        programModeTemperaturesC: {comfort: 22, eco: 20},
    }],
    domesticHotWater: [{index: 0, targetTemperatureC: 50, supportedProgramModes: [Mode.Eco]}],
};

type SwitchData = EnyoDataBusHeatpumpProgramSwitchV3['data'];
const eco = (overrides: Partial<SwitchData> = {}): SwitchData => ({
    target: EnyoHeatpumpControlTargetEnum.Room,
    index: 0,
    mode: Mode.Eco,
    untilIso: inMinutes(30),
    reason: {type: EnyoDataBusCommandReasonTypeEnum.ElectricityPriceAboveThreshold},
    ...overrides,
});

describe('validateHeatpumpProgramSwitch', () => {
    it('accepts a supported switch and a switch back to the program', () => {
        expect(validateHeatpumpProgramSwitch(eco(), METADATA, NOW).answer).toBe(Accepted);
        expect(validateHeatpumpProgramSwitch(eco({mode: Mode.Program, untilIso: undefined}), METADATA, NOW).answer)
            .toBe(Accepted);
    });

    it('rejects a missing, past or too far untilIso for comfort / eco', () => {
        for (const untilIso of [undefined, 'soon', inMinutes(-1), inMinutes(32)]) {
            expect(validateHeatpumpProgramSwitch(eco({untilIso}), METADATA, NOW).answer, String(untilIso)).toBe(Rejected);
        }
        expect(validateHeatpumpProgramSwitch(eco({untilIso: inMinutes(30.5)}), METADATA, NOW).answer).toBe(Accepted);
    });

    it('rejects a buffer tank target and an unknown mode', () => {
        expect(validateHeatpumpProgramSwitch(
            eco({target: EnyoHeatpumpControlTargetEnum.BufferTank as SwitchData['target']}), METADATA, NOW,
        ).answer).toBe(Rejected);
        expect(validateHeatpumpProgramSwitch(eco({mode: 'boost' as Mode}), METADATA, NOW).answer).toBe(Rejected);
    });

    it('answers NotSupported without ProgramSwitch or when the zone does not list the mode', () => {
        expect(validateHeatpumpProgramSwitch(eco(), {...METADATA, availableFeatures: []}, NOW).answer).toBe(NotSupported);
        const comfortDhw = eco({target: EnyoHeatpumpControlTargetEnum.Dhw, mode: Mode.Comfort});
        expect(validateHeatpumpProgramSwitch(comfortDhw, METADATA, NOW).answer).toBe(NotSupported);
    });

    it('rejects an unknown zone index', () => {
        expect(validateHeatpumpProgramSwitch(eco({index: 2}), METADATA, NOW).answer).toBe(Rejected);
    });

    it('without metadata checks only the message itself', () => {
        expect(validateHeatpumpProgramSwitch(eco({index: 7}), undefined, NOW).answer).toBe(Accepted);
        expect(validateHeatpumpProgramSwitch(eco({untilIso: undefined}), undefined, NOW).answer).toBe(Rejected);
    });
});

describe('validateHeatpumpAdvancedMetadata — program switch', () => {
    it('accepts valid program-switch metadata', () => {
        const result = validateHeatpumpAdvancedMetadata(METADATA);
        expect(result.errors).toEqual([]);
        expect(result.warnings).toEqual([]);
    });

    it('flags invalid modes and temperatures', () => {
        const result = validateHeatpumpAdvancedMetadata({
            availableFeatures: [Feature.ProgramSwitch],
            heatingCircuits: [{
                index: 0,
                supportedProgramModes: [Mode.Program as Mode.Eco],
                programModeTemperaturesC: {comfort: Number.NaN},
                activeProgramMode: 'manual' as Mode,
            }],
        });
        expect(result.errors).toHaveLength(3);
    });

    it('warns about eco above comfort and a missing feature or missing modes', () => {
        expect(validateHeatpumpAdvancedMetadata({
            availableFeatures: [],
            heatingCircuits: [{index: 0, supportedProgramModes: [Mode.Eco], programModeTemperaturesC: {comfort: 20, eco: 22}}],
        }).warnings).toHaveLength(2);
        expect(validateHeatpumpAdvancedMetadata({availableFeatures: [Feature.ProgramSwitch], heatingCircuits: [{index: 0}]}).warnings)
            .toEqual([expect.stringMatching(/no zone lists supportedProgramModes/)]);
    });
});

describe('HeatpumpIntegrationEnergyApp — HeatpumpProgramSwitchV3', () => {
    let app: TestHeatpump;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
        installSdk({'hp-1': {heatpump: METADATA}});
        app = new TestHeatpump();
    });

    afterEach(() => {
        app.stop();
        vi.useRealTimers();
    });

    it('answers NotSupported by default', async () => {
        expect((await app.programSwitch(eco())).answer).toBe(NotSupported);
    });

    describe('with a handler', () => {
        beforeEach(() => {
            app.programSwitchResponse = async () => ({answer: Accepted});
        });

        it('passes the validated request to the handler', async () => {
            expect((await app.programSwitch(eco())).answer).toBe(Accepted);
            expect(app.switches).toEqual([{
                applianceId: 'hp-1',
                target: EnyoHeatpumpControlTargetEnum.Room,
                index: 0,
                mode: Mode.Eco,
                untilIso: inMinutes(30),
                reason: {type: EnyoDataBusCommandReasonTypeEnum.ElectricityPriceAboveThreshold},
                cause: HeatpumpProgramSwitchCauseEnum.Command,
            }]);
        });

        it('does not call the handler for an invalid switch', async () => {
            const response = await app.programSwitch(eco({index: 2}));
            expect(response.answer).toBe(Rejected);
            expect(response.rejectionReason).toMatch(/index 2/);
            expect(app.switches).toEqual([]);
        });

        it('switches the zone back to the program when untilIso passes', async () => {
            await app.programSwitch(eco({untilIso: inMinutes(10)}));
            await vi.advanceTimersByTimeAsync(10 * 60_000);
            expect(app.switches).toHaveLength(2);
            expect(app.switches[1]).toEqual({
                applianceId: 'hp-1',
                target: EnyoHeatpumpControlTargetEnum.Room,
                index: 0,
                mode: Mode.Program,
                cause: HeatpumpProgramSwitchCauseEnum.Expired,
            });
        });

        it('a renewal moves the expiry', async () => {
            await app.programSwitch(eco({untilIso: inMinutes(10)}));
            await vi.advanceTimersByTimeAsync(5 * 60_000);
            await app.programSwitch(eco({untilIso: inMinutes(25)}));
            await vi.advanceTimersByTimeAsync(10 * 60_000);
            expect(app.switches.map((s) => s.cause)).toEqual([
                HeatpumpProgramSwitchCauseEnum.Command,
                HeatpumpProgramSwitchCauseEnum.Command,
            ]);
            await vi.advanceTimersByTimeAsync(10 * 60_000);
            expect(app.switches.at(-1)?.cause).toBe(HeatpumpProgramSwitchCauseEnum.Expired);
        });

        it('switching back to the program clears the expiry', async () => {
            await app.programSwitch(eco({untilIso: inMinutes(10)}));
            await app.programSwitch(eco({mode: Mode.Program, untilIso: undefined}));
            await vi.advanceTimersByTimeAsync(30 * 60_000);
            expect(app.switches.map((s) => s.mode)).toEqual([Mode.Eco, Mode.Program]);
            expect(app.switches[1].untilIso).toBeUndefined();
        });

        it('keeps zones apart', async () => {
            await app.programSwitch(eco({untilIso: inMinutes(10)}));
            await app.programSwitch(eco({target: EnyoHeatpumpControlTargetEnum.Dhw, untilIso: inMinutes(20)}));
            await vi.advanceTimersByTimeAsync(10 * 60_000);
            expect(app.switches.at(-1)).toMatchObject({target: EnyoHeatpumpControlTargetEnum.Room, mode: Mode.Program});
            await vi.advanceTimersByTimeAsync(10 * 60_000);
            expect(app.switches.at(-1)).toMatchObject({target: EnyoHeatpumpControlTargetEnum.Dhw, mode: Mode.Program});
        });

        it('a rejected renewal keeps the running expiry', async () => {
            await app.programSwitch(eco({untilIso: inMinutes(10)}));
            app.programSwitchResponse = async (request) => request.cause === HeatpumpProgramSwitchCauseEnum.Command
                ? {answer: Rejected, rejectionReason: 'manual mode'}
                : {answer: Accepted};
            expect((await app.programSwitch(eco({untilIso: inMinutes(30)}))).answer).toBe(Rejected);
            await vi.advanceTimersByTimeAsync(10 * 60_000);
            expect(app.switches.at(-1)?.cause).toBe(HeatpumpProgramSwitchCauseEnum.Expired);
        });

        it('stop drops the expiry without switching back', async () => {
            await app.programSwitch(eco({untilIso: inMinutes(10)}));
            app.stop();
            await vi.advanceTimersByTimeAsync(30 * 60_000);
            expect(app.switches).toHaveLength(1);
        });
    });
});
