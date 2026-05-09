import {
    EnyoOnboardingGuide,
    EnyoOnboardingGuideCategory,
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
     * Gets all currently active onboarding guides that belong to the given category.
     * Guides without an explicit category are excluded — use {@link getAllOnboardingGuides}
     * if you need uncategorized guides as well.
     *
     * @param category - The lifecycle category to filter guides by
     * @returns Promise resolving to all guides whose `category` matches
     *
     * @example
     * ```typescript
     * const reconnectGuides = await onboarding.getGuidesByCategory(
     *   EnyoOnboardingGuideCategory.ReconnectDevice
     * );
     * ```
     */
    getGuidesByCategory(category: EnyoOnboardingGuideCategory): Promise<EnyoOnboardingGuide[]>;

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
     * Jumps to a specific step within the onboarding guide by its `name`.
     *
     * Useful when implementing dynamic onboarding routes — for example, after
     * receiving a step submission the package can decide programmatically
     * which step to show next based on the submitted data, rather than
     * relying on the declarative `branches` configuration on the step.
     *
     * If the target step does not exist within the guide the call is a no-op.
     *
     * @param guideName - The unique name of the guide to navigate
     * @param stepName - The `name` of the target step to display
     * @returns Promise that resolves when navigation is complete
     *
     * @example
     * ```typescript
     * onboarding.listenForStepSubmission(async (submission) => {
     *   if (submission.stepName === 'choose-route') {
     *     const route = submission.data?.route;
     *     await onboarding.moveToStep(submission.guideName,
     *       route === 'cloud' ? 'cloud-credentials' : 'local-network');
     *     return { state: 'success' };
     *   }
     *   return { state: 'success' };
     * });
     * ```
     */
    moveToStep(guideName: string, stepName: string): Promise<void>;

    /**
     * Adds a new step to an existing onboarding guide at runtime.
     *
     * Intended for flows where the next step cannot be known up front — for
     * example when a step submission produces data that determines which (or
     * how many) follow-up steps are needed. Combine with {@link moveToStep}
     * to route the user into the freshly added step.
     *
     * The new step's `name` must be unique within the guide; calls that would
     * introduce a duplicate `name` are rejected. When `options.after` is
     * provided, the step is inserted immediately after the step with that
     * name; if no step matches, or `options` is omitted, the step is appended
     * at the end of the guide.
     *
     * @param guideName - The unique name of the guide to extend
     * @param step - The new step to add to the guide
     * @param options - Optional positioning; `after` inserts the new step
     *   immediately after the step with the given `name`. Omit to append.
     * @returns Promise that resolves once the step has been added
     *
     * @example
     * ```typescript
     * onboarding.listenForStepSubmission(async (submission) => {
     *   if (submission.stepName === 'discover-devices') {
     *     const devices = await scanForDevices();
     *     for (const device of devices) {
     *       await onboarding.addStep(submission.guideName, {
     *         name: `configure-${device.id}`,
     *         sections: buildSectionsFor(device),
     *         nextButtonLabel: [{ language: 'en', value: 'Continue' }],
     *       }, { after: 'discover-devices' });
     *     }
     *     await onboarding.moveToStep(submission.guideName, `configure-${devices[0].id}`);
     *     return { state: 'success' };
     *   }
     *   return { state: 'success' };
     * });
     * ```
     */
    addStep(
        guideName: string,
        step: EnyoOnboardingStep,
        options?: { after?: string }
    ): Promise<void>;

    /**
     * Marks the onboarding as complete and clears the ConfigurationRequired state.
     * This updates the state for the specified guide.
     *
     * @param guideName - The unique name of the guide to mark as complete
     * @returns Promise that resolves when onboarding is marked complete
     */
    completeOnboarding(guideName: string): Promise<void>;
}
