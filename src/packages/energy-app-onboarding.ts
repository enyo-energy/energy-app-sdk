import {
    EnyoOnboardingGuide,
    EnyoOnboardingStep,
    EnyoOnboardingStepListener,
    EnyoOnboardingStepResponse
} from "../types/enyo-onboarding.js";

/**
 * Interface for managing onboarding guides within Energy App packages.
 * Provides methods to create, manage, and navigate through onboarding flows
 * for both package-level and appliance-specific configuration.
 */
export interface EnergyAppOnboarding {
    /**
     * Saves an onboarding guide for the package or a specific appliance.
     * This guide will be displayed when the corresponding state is ConfigurationRequired.
     *
     * @param guide - The complete onboarding guide configuration with steps and translations
     * @param applianceId - Optional appliance ID for appliance-specific onboarding
     * @returns Promise that resolves when the guide is successfully saved
     *
     * @example
     * ```typescript
     * await saveOnboardingGuide({
     *   id: 'inverter-setup',
     *   steps: [...],
     *   currentStepIndex: 0
     * }, 'appliance-123');
     * ```
     */
    saveOnboardingGuide(guide: EnyoOnboardingGuide, applianceId?: string): Promise<void>;

    /**
     * Removes an onboarding guide from the system.
     * This will prevent the guide from being displayed even if ConfigurationRequired is set.
     *
     * @param applianceId - Optional appliance ID to remove specific appliance guide.
     *                      If omitted, removes the package-level guide.
     * @returns Promise that resolves when the guide is successfully removed
     */
    removeOnboardingGuide(applianceId?: string): Promise<void>;

    /**
     * Gets the current step being displayed in the onboarding flow.
     * Returns null if no onboarding is active or if the guide is complete.
     *
     * @param applianceId - Optional appliance ID for appliance-specific guide.
     *                      If omitted, returns the current step of the package guide.
     * @returns The current step or null if no active onboarding
     */
    getCurrentStep(applianceId?: string): EnyoOnboardingStep | null;

    /**
     * Registers a listener that will be called when a user submits an onboarding step.
     * The listener receives the step submission details including step name and optional appliance ID.
     * Must return a promise with either success or an error response with translated message.
     *
     * @param listener - The callback function to handle step submissions
     *
     * @example
     * ```typescript
     * listenForStepSubmission(async (submission) => {
     *   if (submission.stepName === 'wifi-setup') {
     *     const success = await validateWifiCredentials(submission.data);
     *     if (!success) {
     *       return {
     *         state: 'error',
     *         errorMessage: [
     *           { language: 'en', value: 'Invalid WiFi credentials' },
     *           { language: 'de', value: 'Ungültige WLAN-Anmeldedaten' }
     *         ]
     *       };
     *     }
     *   }
     *   return { state: 'success' };
     * });
     * ```
     */
    listenForStepSubmission(listener: EnyoOnboardingStepListener): void;

    /**
     * Responds to a step submission with a success or error state.
     * This method is used to programmatically complete or fail a step.
     *
     * @param stepName - The name of the step to respond to
     * @param response - The response indicating success or error with optional message
     * @param applianceId - Optional appliance ID if responding to appliance onboarding
     * @returns Promise that resolves when the response is processed
     */
    respondToStepSubmission(
        stepName: string,
        response: EnyoOnboardingStepResponse,
        applianceId?: string
    ): Promise<void>;

    /**
     * Moves to the next step in the onboarding guide.
     * This will increment the currentStepIndex and display the next step.
     * If already at the last step, this method has no effect.
     *
     * @param applianceId - Optional appliance ID for appliance-specific guide
     * @returns Promise that resolves when navigation is complete
     */
    moveToNextStep(applianceId?: string): Promise<void>;

    /**
     * Moves to the previous step in the onboarding guide.
     * This will decrement the currentStepIndex and display the previous step.
     * If already at the first step, this method has no effect.
     *
     * @param applianceId - Optional appliance ID for appliance-specific guide
     * @returns Promise that resolves when navigation is complete
     */
    moveToPreviousStep(applianceId?: string): Promise<void>;

    /**
     * Marks the onboarding as complete and clears the ConfigurationRequired state.
     * For package onboarding, this updates the EnergyAppState.
     * For appliance onboarding, this updates the specific appliance state.
     *
     * @param applianceId - Optional appliance ID for appliance-specific onboarding
     * @returns Promise that resolves when onboarding is marked complete
     */
    completeOnboarding(applianceId?: string): Promise<void>;
}