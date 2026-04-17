import {EnyoPackageConfigurationTranslatedValue} from "./enyo-settings.js";

/**
 * Represents a learning phase tracked by an Energy App.
 * A learning phase is a period during which an app or appliance is calibrating,
 * gathering data, or optimizing its behavior (e.g., a heatpump learning optimal heating curves).
 */
export interface EnyoLearningPhase {
    /** Unique identifier of the learning phase */
    id: string;
    /** Name identifying the learning phase (e.g., 'heating-curve-optimization') */
    name: string;
    /** Optional appliance ID — if omitted, the learning phase applies to the entire package */
    applianceId?: string;
    /** Optional translated reason explaining why this learning phase is needed */
    reason?: EnyoPackageConfigurationTranslatedValue[];
    /** Optional translated description providing details about what is being learned */
    description?: EnyoPackageConfigurationTranslatedValue[];
    /** ISO 8601 date string of when the learning phase started */
    startDate: string;
    /** ISO 8601 date string of when the learning phase ended — undefined if still active */
    endDate?: string;
    /** Duration of the learning phase in hours (elapsed if active, total if completed) */
    durationInHours: number;
}

/**
 * Registration parameters for creating a new learning phase.
 */
export interface EnyoLearningPhaseRegistration {
    /** Name identifying the learning phase (e.g., 'heating-curve-optimization') */
    name: string;
    /** Optional appliance ID — if omitted, the learning phase applies to the entire package */
    applianceId?: string;
    /** Optional translated reason explaining why this learning phase is needed */
    reason?: EnyoPackageConfigurationTranslatedValue[];
    /** Optional translated description providing details about what is being learned */
    description?: EnyoPackageConfigurationTranslatedValue[];
}
