import {
    EnyoNotification,
    EnyoNotificationOptions,
    EnyoNotificationTranslation,
    EnyoNotificationType
} from "../types/enyo-notification.js";

/**
 * Interface for managing user notifications within Energy App packages.
 * Provides methods to show, retrieve, and manage notifications with multi-language support.
 */
export interface EnergyAppNotification {
    /**
     * Shows a notification to the user with multi-language support.
     * The notification will be displayed according to the specified type and options.
     *
     * @param type - The type of notification (info, warning, error, success) determining visual style
     * @param options - Configuration options including permanence, expiration, priority, and appliance association
     * @param translations - Array of translated notification messages for different supported languages
     * @returns Unique notification ID that can be used for tracking and removal
     *
     * @example
     * ```typescript
     * const notificationId = showNotification('warning',
     *   { permanent: true, priority: 'high' },
     *   [
     *     { language: 'en', notification: 'Battery level is low' },
     *     { language: 'de', notification: 'Batteriestand ist niedrig' }
     *   ]
     * );
     * ```
     */
    showNotification(
        type: EnyoNotificationType,
        options: EnyoNotificationOptions,
        translations: EnyoNotificationTranslation[]
    ): string;

    /**
     * Retrieves all currently active notifications.
     * Returns notifications in chronological order (newest first) unless sorted by priority.
     *
     * @param applianceId - Optional appliance ID to filter notifications for a specific appliance
     * @returns Array of all current notifications with complete metadata
     */
    getNotifications(applianceId?: string): EnyoNotification[];

    /**
     * Removes a specific notification from the active notification list.
     * If the notification doesn't exist, this method completes silently.
     *
     * @param notificationId - The unique ID of the notification to remove
     */
    removeNotification(notificationId: string): void;

    /**
     * Removes all active notifications.
     * This is a convenience method for clearing the entire notification queue.
     *
     * @param applianceId - Optional appliance ID to clear only notifications for a specific appliance
     */
    clearAllNotifications(applianceId?: string): void;
}