import {EnyoCountryEnum, EnyoLocation, EnyoZipCodeLocation} from "../types/enyo-location.js";

/**
 * Interface for managing location information in energy apps.
 * Provides methods to retrieve the device's location with varying levels of detail
 * based on granted permissions.
 */
export interface EnergyAppLocation {
    /**
     * Gets the location with only the zip code.
     * Requires the 'LocationZipCode' permission to be granted.
     *
     * @returns Promise that resolves to the location with zip code only, or null if not set
     * @throws {PermissionNotGranted} If the LocationZipCode permission is not granted
     *
     * @example
     * ```typescript
     * const location = energyApp.useLocation();
     * const zipLocation = await location.getLocationByZipCode();
     * if (zipLocation) {
     *     console.log(`Zip Code: ${zipLocation.zipCode}`);
     * }
     * ```
     */
    getLocationByZipCode(): Promise<EnyoZipCodeLocation | null>;

    /**
     * Gets the location with both zip code and geographic coordinates.
     * Requires both 'LocationZipCode' and 'LocationCoordinates' permissions to be granted.
     *
     * @returns Promise that resolves to the location with zip code and coordinates, or null if not set
     * @throws {PermissionNotGranted} If either LocationZipCode or LocationCoordinates permission is not granted
     *
     * @example
     * ```typescript
     * const location = energyApp.useLocation();
     * const fullLocation = await location.getLocationWithCoordinates();
     * if (fullLocation && fullLocation.coordinates) {
     *     console.log(`Location: ${fullLocation.zipCode}`);
     *     console.log(`Coordinates: ${fullLocation.coordinates.latitude}, ${fullLocation.coordinates.longitude}`);
     * }
     * ```
     */
    getLocationWithCoordinates(): Promise<EnyoLocation | null>;

    /**
     * Gets the country the site is located in.
     * Always set, and requires no permission.
     *
     * @returns Promise that resolves to the country of the site
     *
     * @example
     * ```typescript
     * const location = energyApp.useLocation();
     * const country = await location.getCountry();
     * if (country === EnyoCountryEnum.DE) {
     *     console.log('Site is in Germany');
     * }
     * ```
     */
    getCountry(): Promise<EnyoCountryEnum>;
}