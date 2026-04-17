import {EnyoLearningPhase, EnyoLearningPhaseRegistration} from "../types/enyo-learning-phase.js";

/**
 * Interface for managing learning phases within Energy App packages.
 * Learning phases represent periods where an app or a specific appliance is calibrating,
 * gathering data, or optimizing its behavior (e.g., a heatpump learning optimal heating curves
 * after installation, or an energy manager learning consumption patterns).
 *
 * Learning phases can be package-wide (no applianceId) or tied to a specific appliance.
 *
 * @example
 * ```typescript
 * const learningPhase = energyApp.useLearningPhase();
 *
 * // Register a learning phase for a specific appliance
 * const phaseId = await learningPhase.registerLearningPhase({
 *     name: 'heating-curve-optimization',
 *     applianceId: 'heatpump-001',
 *     reason: [
 *         { language: 'en', value: 'Optimizing heating curve' },
 *         { language: 'de', value: 'Optimierung der Heizkurve' }
 *     ],
 *     description: [
 *         { language: 'en', value: 'The heatpump is learning the optimal heating curve for your home.' },
 *         { language: 'de', value: 'Die Wärmepumpe lernt die optimale Heizkurve für Ihr Zuhause.' }
 *     ]
 * });
 *
 * // Check if still learning
 * const isLearning = await learningPhase.isInLearningPhase(phaseId);
 *
 * // Complete the learning phase
 * await learningPhase.completeLearningPhase(phaseId);
 * ```
 */
export interface EnergyAppLearningPhase {
    /**
     * Registers a new learning phase and starts tracking it.
     * The learning phase starts immediately upon registration.
     *
     * @param registration - The learning phase registration details including name, optional applianceId, reason, and description
     * @returns Promise that resolves to the unique ID of the newly created learning phase
     */
    registerLearningPhase(registration: EnyoLearningPhaseRegistration): Promise<string>;

    /**
     * Marks a learning phase as completed by setting its end date.
     *
     * @param learningPhaseId - The unique ID of the learning phase to complete
     * @returns Promise that resolves when the learning phase is marked as completed
     */
    completeLearningPhase(learningPhaseId: string): Promise<void>;

    /**
     * Checks whether a specific learning phase is still active (not yet completed).
     *
     * @param learningPhaseId - The unique ID of the learning phase to check
     * @returns Promise that resolves to `true` if the learning phase is still active, `false` otherwise
     */
    isInLearningPhase(learningPhaseId: string): Promise<boolean>;

    /**
     * Checks whether a specific learning phase has been completed.
     *
     * @param learningPhaseId - The unique ID of the learning phase to check
     * @returns Promise that resolves to `true` if the learning phase is completed, `false` otherwise
     */
    isLearningPhaseCompleted(learningPhaseId: string): Promise<boolean>;

    /**
     * Retrieves all learning phases registered by this package.
     * Returns both active and completed learning phases with their current duration.
     *
     * @returns Promise that resolves to an array of all learning phases
     */
    getLearningPhases(): Promise<EnyoLearningPhase[]>;

    /**
     * Retrieves all learning phases associated with a specific appliance.
     * Returns both active and completed learning phases for the given appliance.
     *
     * @param applianceId - The appliance ID to filter learning phases by
     * @returns Promise that resolves to an array of learning phases for the specified appliance
     */
    getLearningPhasesByApplianceId(applianceId: string): Promise<EnyoLearningPhase[]>;

    /**
     * Removes a learning phase from the system.
     * This permanently deletes the learning phase record regardless of its active/completed status.
     *
     * @param learningPhaseId - The unique ID of the learning phase to remove
     * @returns Promise that resolves when the learning phase is removed
     */
    removeLearningPhase(learningPhaseId: string): Promise<void>;
}
