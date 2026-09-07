import {EnergyAppPackageLanguage} from "../energy-app-package-definition.js";

/**
 * Represents translated content for onboarding elements.
 * Used for all text that needs to be displayed in multiple languages.
 */
export interface EnyoOnboardingTranslatedContent {
    /** Language code for this translation */
    language: EnergyAppPackageLanguage;
    /** The translated text value */
    value: string;
}

/**
 * Enum representing the lifecycle category of an onboarding guide.
 * Used to distinguish guides that perform different roles, e.g. initial
 * configuration of a package vs. adding or reconnecting a single device.
 *
 * @deprecated Superseded by the v2 graph model. Author guides with
 * {@link EnyoOnboardingV2Guide} via `defineOnboardingGuideV2()`. v1 is retained
 * for backward compatibility and will be removed in a future major.
 */
export enum EnyoOnboardingGuideCategory {
    /** Initial package configuration — shown when EnergyAppStateEnum is 'configuration-required' */
    InitialSetup = "initial-setup",
    /** Guide for adding a new device to an already-configured package */
    AddNewDevice = "add-new-device",
    /** Guide for reconnecting an existing device that has lost its connection */
    ReconnectDevice = "reconnect-device",
}

/**
 * Enum representing the type of content an onboarding section displays.
 *
 * @deprecated Part of the v1 onboarding model. Use the v2 graph model's typed
 * blocks ({@link EnyoOnboardingV2Block}) via `defineOnboardingGuideV2()` instead.
 */
export enum EnyoOnboardingSectionType {
    /** A heading section */
    Heading = "heading",
    /** A plain text section */
    Text = "text",
    /** A password input section */
    PasswordInput = "password-input",
    /** A credentials display section */
    Credentials = "credentials",
    /** A clickable URL section */
    Url = "url",
    /** A dropdown/select section */
    Select = "select",
    /**
     * A branching decision section.
     * Renders as a switch/segmented control or radio group; the user's
     * selection determines which step is shown next, enabling dynamic routes
     * within a single onboarding guide.
     */
    Branch = "branch",
}

/**
 * Represents a password input configuration within an onboarding section.
 */
export interface EnyoOnboardingSectionPassword {
    /** Translated title for the password input */
    title: EnyoOnboardingTranslatedContent[];
    /** The field name used when submitting the password value */
    fieldName: string;
}

/**
 * Represents a single credential entry within an onboarding section.
 */
export interface EnyoOnboardingSectionCredential {
    /** Translated title/label for the credential */
    title: EnyoOnboardingTranslatedContent[];
    /** The credential value to display */
    value: string;
}

/**
 * Represents a URL configuration within an onboarding section.
 */
export interface EnyoOnboardingSectionUrl {
    /** Translated label/title for the URL */
    label: EnyoOnboardingTranslatedContent[];
    /** The URL value to display and link to */
    url: string;
}

/**
 * Represents a single option in a select/dropdown onboarding section.
 */
export interface EnyoOnboardingSectionSelectOption {
    /** The internal value of this option */
    value: string;
    /** The displayed name of the option, translated for different languages */
    optionName: EnyoOnboardingTranslatedContent[];
}

/**
 * Represents a select/dropdown configuration within an onboarding section.
 */
export interface EnyoOnboardingSectionSelect {
    /** Translated title/label for the select field */
    title: EnyoOnboardingTranslatedContent[];
    /** The field name used when submitting the selected value */
    fieldName: string;
    /** Available options for the dropdown */
    options: EnyoOnboardingSectionSelectOption[];
}

/**
 * Represents a single option of a branching decision.
 * Each option visually appears as a switch/segmented choice and, when selected,
 * routes the user to a specific step on submission.
 */
export interface EnyoOnboardingSectionBranchOption {
    /** The internal value submitted when this branch is chosen */
    value: string;
    /** Translated label displayed for this branch */
    label: EnyoOnboardingTranslatedContent[];
    /** Optional translated description shown below the label */
    description?: EnyoOnboardingTranslatedContent[];
    /**
     * The `name` of the step to navigate to when this option is chosen.
     * Must reference an existing step within the same guide.
     */
    targetStepName: string;
}

/**
 * Represents a branching decision within an onboarding step.
 *
 * Renders as a switch / segmented control / radio group that lets the user pick
 * one of several routes. When the step is submitted, the host uses the chosen
 * option's `targetStepName` to determine which step to display next, allowing
 * a single guide to expose multiple parallel onboarding routes.
 */
export interface EnyoOnboardingSectionBranch {
    /** Translated title/label shown above the switch */
    title: EnyoOnboardingTranslatedContent[];
    /**
     * Field name under which the selected option's `value` is submitted.
     * Listeners can read `submission.data[fieldName]` to know which route was taken.
     */
    fieldName: string;
    /** The available branches the user can choose from */
    options: EnyoOnboardingSectionBranchOption[];
    /**
     * Optional value of the option that should be pre-selected when the step
     * is first rendered. Must match one of `options[].value`.
     */
    defaultValue?: string;
}

/**
 * Represents a content section within an onboarding step.
 * Each section has a heading and content body, both with translations.
 * The `type` field determines which optional nested object is used.
 *
 * @deprecated Part of the v1 onboarding model. Use the v2 graph model's typed
 * blocks ({@link EnyoOnboardingV2Block}) instead.
 */
export interface EnyoOnboardingSection {
    /** The type of content this section displays */
    type: EnyoOnboardingSectionType;
    /** Translated heading for this section */
    heading?: EnyoOnboardingTranslatedContent[];
    /** Translated content body for this section */
    content?: EnyoOnboardingTranslatedContent[];
    /** Optional translated text content, used when type is 'text' */
    text?: EnyoOnboardingTranslatedContent[];
    /** Optional password input configuration, used when type is 'password-input' */
    password?: EnyoOnboardingSectionPassword;
    /** Optional credentials to display, used when type is 'credentials' */
    credentials?: EnyoOnboardingSectionCredential[];
    /** Optional URL configuration, used when type is 'url' */
    url?: EnyoOnboardingSectionUrl;
    /** Optional select/dropdown configuration, used when type is 'select' */
    select?: EnyoOnboardingSectionSelect;
    /** Optional branching decision configuration, used when type is 'branch' */
    branch?: EnyoOnboardingSectionBranch;
}

/**
 * Describes a single value-to-step routing rule used by step-level branching.
 */
export interface EnyoOnboardingStepBranchRoute {
    /** The submitted value that triggers this route */
    value: string;
    /** The `name` of the step to navigate to when the value matches */
    targetStepName: string;
}

/**
 * Step-level dynamic routing configuration.
 *
 * When a step has `branches` defined, the host evaluates the submitted form
 * data after a successful step submission and navigates to the target step
 * whose `value` matches `submission.data[fieldName]`. If no route matches,
 * navigation falls back to `defaultStepName` (when provided) or to the next
 * step in the guide (default sequential behavior).
 *
 * This makes it possible to embed switches, selects, or branch sections in a
 * step and have the guide take a different route based on the user's choice.
 */
export interface EnyoOnboardingStepBranching {
    /** Field name whose submitted value determines the next step */
    fieldName: string;
    /** Routes mapping submitted values to target step names */
    routes: EnyoOnboardingStepBranchRoute[];
    /**
     * Optional fallback step name used when no route matches. When omitted,
     * the host falls back to the next sequential step.
     */
    defaultStepName?: string;
}

/**
 * Represents a single step in the onboarding guide.
 * Each step can have an image, multiple content sections, and a next button.
 *
 * @deprecated Part of the v1 onboarding model. Use {@link EnyoOnboardingV2Step}
 * (the v2 graph node) instead.
 */
export interface EnyoOnboardingStep {
    /** Internal name/identifier for this step */
    name: string;
    /** Optional URL for an image to display at the top of the step */
    imageUrl?: string;
    /** Array of content sections with headings and descriptions */
    sections: EnyoOnboardingSection[];
    /** Translated label for the next/continue button */
    nextButtonLabel: EnyoOnboardingTranslatedContent[];
    /**
     * Optional dynamic routing configuration. When present, on a successful
     * step submission the host follows the route whose `value` matches the
     * submitted data; otherwise the next sequential step is shown. Omit this
     * field for plain linear steps.
     */
    branches?: EnyoOnboardingStepBranching;
}

/**
 * Represents a complete onboarding guide configuration.
 * Can be used for either package-level or appliance-specific onboarding.
 *
 * @deprecated Superseded by the v2 graph model. Author new guides with
 * {@link EnyoOnboardingV2Guide} via `defineOnboardingGuideV2()` and validate them
 * with `validateOnboardingGuideV2()`. Unlike this linear/name-routed model, v2 is
 * a directed graph with typed blocks, explicit transitions, terminal exits
 * (success / support / pause) and start-variant hand-offs. v1 remains supported
 * for backward compatibility and will be removed in a future major.
 */
export interface EnyoOnboardingGuide {
    /** Unique identifier for this guide, used in API methods */
    guideName: string;
    /** Translated display name for the guide */
    name: EnyoOnboardingTranslatedContent[];
    /** Translated call-to-action text */
    cta: EnyoOnboardingTranslatedContent[];
    /** Optional translated description of the guide */
    description?: EnyoOnboardingTranslatedContent[];
    /** Optional appliance ID if this guide is associated with an appliance */
    applianceId?: string;
    /**
     * Optional lifecycle category for this guide.
     * Allows hosts to render category-specific entry points (e.g. "Add new device" buttons).
     * Defaults to InitialSetup semantics when omitted, for backwards compatibility.
     */
    category?: EnyoOnboardingGuideCategory;
    /** Ordered array of steps in the onboarding flow */
    steps: EnyoOnboardingStep[];
}

/**
 * Represents a step submission event when a user completes a step.
 * Includes context about which step and guide.
 */
export interface EnyoOnboardingStepSubmission {
    /** Name of the step being submitted */
    stepName: string;
    /** Name of the guide this submission belongs to */
    guideName: string;
    applianceId?: string;
    /** Optional data submitted with the step */
    data?: any;
}

/**
 * Represents the response to a step submission.
 * Can indicate success or provide an error message.
 */
export interface EnyoOnboardingStepResponse {
    /** State of the step submission - success or error */
    state: 'success' | 'error';
    /** Optional translated error message if state is 'error' */
    errorMessage?: EnyoOnboardingTranslatedContent[];
    /**
     * When true on a successful step response, instructs the host to route the user to the
     * pending authentication request after this step completes. Typically set on the final step
     * of a guide so the user is sent to authenticate (e.g. sign in to a cloud service) once
     * onboarding finishes. The authentication request itself must have been created separately
     * via `EnergyAppAuthentication.requestAuthentication`, and its result is handled through
     * `listenForAuthenticationResponse`. This is fire-and-forget — the guide completes regardless
     * of the authentication outcome. Ignored when `state` is 'error'.
     */
    goToAuthentication?: boolean;
}

/**
 * Callback function type for handling step submissions.
 * Receives submission details and must return a promise with the response.
 */
export type EnyoOnboardingStepListener = (
    submission: EnyoOnboardingStepSubmission
) => Promise<EnyoOnboardingStepResponse>;