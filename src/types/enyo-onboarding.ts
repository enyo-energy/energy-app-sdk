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
 * Enum representing the type of content an onboarding section displays.
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
 * Represents a content section within an onboarding step.
 * Each section has a heading and content body, both with translations.
 * The `type` field determines which optional nested object is used.
 */
export interface EnyoOnboardingSection {
    /** The type of content this section displays */
    type: EnyoOnboardingSectionType;
    /** Translated heading for this section */
    heading: EnyoOnboardingTranslatedContent[];
    /** Translated content body for this section */
    content: EnyoOnboardingTranslatedContent[];
    /** Optional translated text content, used when type is 'text' */
    text?: EnyoOnboardingTranslatedContent[];
    /** Optional password input configuration, used when type is 'password-input' */
    password?: EnyoOnboardingSectionPassword;
    /** Optional credentials to display, used when type is 'credentials' */
    credentials?: EnyoOnboardingSectionCredential[];
}

/**
 * Represents a single step in the onboarding guide.
 * Each step can have an image, multiple content sections, and a next button.
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
}

/**
 * Represents a complete onboarding guide configuration.
 * Can be used for either package-level or appliance-specific onboarding.
 */
export interface EnyoOnboardingGuide {
    /** Unique identifier for this guide */
    id: string;
    /** Optional appliance ID if this is an appliance-specific guide */
    applianceId?: string;
    /** Ordered array of steps in the onboarding flow */
    steps: EnyoOnboardingStep[];
}

/**
 * Represents a step submission event when a user completes a step.
 * Includes context about which step and optionally which appliance.
 */
export interface EnyoOnboardingStepSubmission {
    /** Name of the step being submitted */
    stepName: string;
    /** Optional appliance ID if this is from appliance-specific onboarding */
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
}

/**
 * Callback function type for handling step submissions.
 * Receives submission details and must return a promise with the response.
 */
export type EnyoOnboardingStepListener = (
    submission: EnyoOnboardingStepSubmission
) => Promise<EnyoOnboardingStepResponse>;