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
 * Supports multiple parallel guides identified by their unique guideName.
 */
export interface EnergyAppOnboarding {
    /**
     * Saves an onboarding guide.
     * This guide will be displayed when the corresponding state is ConfigurationRequired.
     * The guide is identified by its guideName property.
     *
     * @param guide - The complete onboarding guide configuration with steps and translations
     * @returns Promise that resolves when the guide is successfully saved
     *
     * @example
     * ```typescript
     * await saveOnboardingGuide({
     *   guideName: 'inverter-setup',
     *   name: [{ language: 'en', value: 'Inverter Setup' }],
     *   cta: [{ language: 'en', value: 'Set up your inverter' }],
     *   steps: [...]
     * });
     * ```
     */
    saveOnboardingGuide(guide: EnyoOnboardingGuide): Promise<void>;

    /**
     * Removes an onboarding guide from the system.
     * This will prevent the guide from being displayed even if ConfigurationRequired is set.
     *
     * @param guideName - The unique name of the guide to remove
     * @returns Promise that resolves when the guide is successfully removed
     */
    removeOnboardingGuide(guideName: string): Promise<void>;

    /**
     * Gets all currently active onboarding guides.
     * Returns an array of all guides that have been saved and not yet removed.
     *
     * @returns Promise that resolves to an array of all active onboarding guides
     */
    getAllOnboardingGuides(): Promise<EnyoOnboardingGuide[]>;

    /**
     * Gets the current step being displayed in the onboarding flow for a specific guide.
     * Returns null if no onboarding is active or if the guide is complete.
     *
     * @param guideName - The unique name of the guide to get the current step for
     * @returns The current step or null if no active onboarding
     */
    getCurrentStep(guideName: string): Promise<EnyoOnboardingStep | null>;

    /**
     * Registers a listener that will be called when a user submits an onboarding step.
     * The listener receives the step submission details including step name and guide name.
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
     * @param guideName - The unique name of the guide this step belongs to
     * @returns Promise that resolves when the response is processed
     */
    respondToStepSubmission(
        stepName: string,
        response: EnyoOnboardingStepResponse,
        guideName: string
    ): Promise<void>;

    /**
     * Moves to the next step in the onboarding guide.
     * This will increment the currentStepIndex and display the next step.
     * If already at the last step, this method has no effect.
     *
     * @param guideName - The unique name of the guide to navigate
     * @returns Promise that resolves when navigation is complete
     */
    moveToNextStep(guideName: string): Promise<void>;

    /**
     * Moves to the previous step in the onboarding guide.
     * This will decrement the currentStepIndex and display the previous step.
     * If already at the first step, this method has no effect.
     *
     * @param guideName - The unique name of the guide to navigate
     * @returns Promise that resolves when navigation is complete
     */
    moveToPreviousStep(guideName: string): Promise<void>;

    /**
     * Marks the onboarding as complete and clears the ConfigurationRequired state.
     * This updates the state for the specified guide.
     *
     * @param guideName - The unique name of the guide to mark as complete
     * @returns Promise that resolves when onboarding is marked complete
     */
    completeOnboarding(guideName: string): Promise<void>;
}
