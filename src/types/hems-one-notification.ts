import {EnergyAppPackageLanguage} from "../energy-app-package-definition.js";

/**
 * Types of notifications that can be displayed to users
 */
export type HemsOneNotificationType = 'info' | 'warning' | 'error' | 'success';

/**
 * Priority levels for notifications affecting display order and importance
 */
export type HemsOneNotificationPriority = 'low' | 'normal' | 'high';

/**
 * Configuration options for notification display and behavior
 */
export interface HemsOneNotificationOptions {
    /** Whether the notification persists until manually dismissed by the user */
    permanent?: boolean;
    /** Optional expiration time in ISO format for auto-dismissal */
    expiresAtIso?: string;
    /** Priority level affecting display order and visual emphasis */
    priority?: HemsOneNotificationPriority;
    /** Optional appliance ID if notification is specific to an appliance */
    applianceId?: string;
}

/**
 * Translated notification content for multi-language support
 */
export interface HemsOneNotificationTranslation {
    /** Language code for this translation */
    language: EnergyAppPackageLanguage;
    /** Notification message content in the specified language */
    notification: string;
}

/**
 * Complete notification object containing all notification data
 */
export interface HemsOneNotification {
    /** Unique identifier for this notification */
    id: string;
    /** Type of notification determining visual style and urgency */
    type: HemsOneNotificationType;
    /** Configuration options for display and behavior */
    options: HemsOneNotificationOptions;
    /** Array of translated notification messages for different languages */
    translations: HemsOneNotificationTranslation[];
    /** ISO timestamp when the notification was created */
    createdAtIso: string;
    /** Optional ISO timestamp when the notification was last updated */
    updatedAtIso?: string;
}