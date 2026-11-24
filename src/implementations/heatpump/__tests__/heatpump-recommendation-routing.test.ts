import {describe, expect, it} from 'vitest';
import {EnyoDataBusMessage, EnyoDataBusMessageEnum} from '../../../types/enyo-data-bus-value.js';
import {EnyoSourceEnum} from '../../../types/enyo-source.enum.js';
import {installSdk, TestHeatpump} from './heatpump-test-harness.js';

/** The recommendation messages: addressed to the heat pump, but for the energy manager and the host. */
const RECOMMENDATION_MESSAGES = [
    EnyoDataBusMessageEnum.HeatpumpRecommendationsV1,
    EnyoDataBusMessageEnum.AcceptHeatpumpRecommendationV1,
    EnyoDataBusMessageEnum.ResetHeatpumpRecommendationV1,
    EnyoDataBusMessageEnum.HeatpumpRecommendationStatusV1,
];

describe('HeatpumpIntegrationEnergyApp — recommendation messages', () => {
    it('neither subscribes to nor answers the recommendation messages addressed to its heat pump', async () => {
        const {sent, listeners} = installSdk({'hp-1': {heatpump: {availableFeatures: []}}});
        const app = new TestHeatpump();
        app.start();

        for (const type of RECOMMENDATION_MESSAGES) {
            expect(listeners.some((l) => l.types.includes(type))).toBe(false);
        }

        // Even when a fallback route hands them to every listener, nothing answers them.
        for (const type of RECOMMENDATION_MESSAGES) {
            const message: EnyoDataBusMessage = {
                id: `msg-${type}`,
                type: 'message',
                message: type,
                source: EnyoSourceEnum.Cloud,
                applianceId: 'hp-1',
                timestampIso: new Date().toISOString(),
                data: {recommendationId: 'rec-1'},
            };
            for (const listener of listeners) listener.cb(message);
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
        app.stop();

        expect(sent).toEqual([]);
    });
});
