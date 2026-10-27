import {
    EnyoCommandAcknowledgeActionResult,
    EnyoCommandAcknowledgeAnswerEnum,
    EnyoDataBusHeatpumpControlCancelV3,
    EnyoDataBusHeatpumpControlV3,
    EnyoDataBusHeatpumpProgramSwitchV3,
    EnyoDataBusMessage,
    EnyoDataBusMessageEnum,
    EnyoDataBusSetHeatpumpHeatingCurveOffsetV1,
} from '../../../types/enyo-data-bus-value.js';
import {EnyoHeatpumpApplianceMetadata} from '../../../types/enyo-heatpump-appliance.js';
import {EnyoSourceEnum} from '../../../types/enyo-source.enum.js';
import {HeatpumpControlEndCauseEnum} from '../heatpump-control-session.js';
import {
    HeatpumpIntegrationEnergyApp,
    HeatpumpProgramSwitchRequest,
} from '../../../integrations/heatpump-integration-energy-app.js';
import {IntegrationCommandResponse} from '../../../integrations/integration-types.js';

// Shared test harness for the heatpump integration tests — not a test file itself.

const {Accepted} = EnyoCommandAcknowledgeAnswerEnum;
/** Minimal stand-in for the runtime SDK, enough for an integration to run. */
export function installSdk(appliances: Record<string, {heatpump?: EnyoHeatpumpApplianceMetadata}>) {
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
        useAppliances: () => ({getById: async (id: string) => appliances[id] ?? null}),
    };
    return {sent, listeners};
}

/** The base class's private dispatchers, reached from the tests. */
interface Dispatchers {
    dispatchHeatpumpControl(message: EnyoDataBusHeatpumpControlV3): Promise<IntegrationCommandResponse>;
    dispatchHeatpumpControlCancel(message: EnyoDataBusHeatpumpControlCancelV3): Promise<IntegrationCommandResponse>;
    dispatchHeatpumpProgramSwitch(message: EnyoDataBusHeatpumpProgramSwitchV3): Promise<IntegrationCommandResponse>;
    dispatchHeatpumpHeatingCurveOffset(message: EnyoDataBusSetHeatpumpHeatingCurveOffsetV1): Promise<IntegrationCommandResponse>;
}

/**
 * A heatpump integration for the tests. Without {@link controlResponse} it
 * keeps the base class's defaults (no V3 support); with it, it supports V3 and
 * answers every control with it.
 */
export class TestHeatpump extends HeatpumpIntegrationEnergyApp {
    readonly controls: EnyoDataBusHeatpumpControlV3[] = [];
    readonly changed: boolean[] = [];
    readonly ended: Array<[string, HeatpumpControlEndCauseEnum]> = [];
    controlResponse?: (message: EnyoDataBusHeatpumpControlV3) => Promise<IntegrationCommandResponse>;
    readonly switches: HeatpumpProgramSwitchRequest[] = [];
    /** Without it the base class's default (`NotSupported`) answers program switches. */
    programSwitchResponse?: (request: HeatpumpProgramSwitchRequest) => Promise<IntegrationCommandResponse>;
    readonly curveOffsets: EnyoDataBusSetHeatpumpHeatingCurveOffsetV1[] = [];
    /** Without it the base class's default (`NotSupported`) answers heating curve offsets. */
    curveOffsetResponse?: (message: EnyoDataBusSetHeatpumpHeatingCurveOffsetV1) => Promise<IntegrationCommandResponse>;

    constructor() {
        super({source: EnyoSourceEnum.Device, applianceIds: ['hp-1'], autoStart: false, autoStopOnShutdown: false});
    }

    /** Sends a control message through the base class, as the data bus would. */
    control(message: EnyoDataBusHeatpumpControlV3): Promise<IntegrationCommandResponse> {
        return (this as unknown as Dispatchers).dispatchHeatpumpControl(message);
    }

    /** Sends a cancel for `sessionId` through the base class, as the data bus would. */
    cancel(sessionId: string): Promise<IntegrationCommandResponse> {
        return (this as unknown as Dispatchers).dispatchHeatpumpControlCancel({
            id: `cancel-${sessionId}`,
            type: 'message',
            message: EnyoDataBusMessageEnum.HeatpumpControlCancelV3,
            source: EnyoSourceEnum.Device,
            applianceId: 'hp-1',
            timestampIso: new Date().toISOString(),
            data: {sessionId},
        });
    }

    /** Sends a program switch through the base class, as the data bus would. */
    programSwitch(data: EnyoDataBusHeatpumpProgramSwitchV3['data']): Promise<IntegrationCommandResponse> {
        return (this as unknown as Dispatchers).dispatchHeatpumpProgramSwitch({
            id: `switch-${data.mode}`,
            type: 'message',
            message: EnyoDataBusMessageEnum.HeatpumpProgramSwitchV3,
            source: EnyoSourceEnum.Device,
            applianceId: 'hp-1',
            timestampIso: new Date().toISOString(),
            data,
        });
    }

    /** Sends a heating curve offset through the base class, as the data bus would. */
    heatingCurveOffset(data: EnyoDataBusSetHeatpumpHeatingCurveOffsetV1['data']): Promise<IntegrationCommandResponse> {
        return (this as unknown as Dispatchers).dispatchHeatpumpHeatingCurveOffset({
            id: `offset-${data.offsetK}`,
            type: 'message',
            message: EnyoDataBusMessageEnum.SetHeatpumpHeatingCurveOffsetV1,
            source: EnyoSourceEnum.Device,
            applianceId: 'hp-1',
            timestampIso: new Date().toISOString(),
            data,
        });
    }

    /** Exposes the protected action check. */
    check(message: EnyoDataBusHeatpumpControlV3): Promise<EnyoCommandAcknowledgeActionResult[]> {
        return this.checkHeatpumpControlActions(message);
    }

    protected async handleHeatpumpControl(message: EnyoDataBusHeatpumpControlV3) {
        if (!this.controlResponse) return super.handleHeatpumpControl(message);
        this.controls.push(message);
        this.changed.push(this.isHeatpumpControlChanged(message));
        return this.controlResponse(message);
    }

    protected async handleHeatpumpProgramSwitch(request: HeatpumpProgramSwitchRequest) {
        if (!this.programSwitchResponse) return super.handleHeatpumpProgramSwitch(request);
        this.switches.push(request);
        return this.programSwitchResponse(request);
    }

    protected async handleHeatpumpHeatingCurveOffset(message: EnyoDataBusSetHeatpumpHeatingCurveOffsetV1) {
        if (!this.curveOffsetResponse) return super.handleHeatpumpHeatingCurveOffset(message);
        this.curveOffsets.push(message);
        return this.curveOffsetResponse(message);
    }

    protected async handleHeatpumpOverheating() {
        return {answer: Accepted};
    }

    protected async handleHeatpumpAvailablePowerAnnouncement() {
        return {answer: Accepted};
    }

    protected async handleSetHeatpumpAvailablePower() {
        return {answer: Accepted};
    }

    protected async handleGridOperatorPowerLimitation() {
        return {answer: Accepted};
    }

    protected async onHeatpumpControlEnded(applianceId: string, cause: HeatpumpControlEndCauseEnum) {
        this.ended.push([applianceId, cause]);
    }
}
