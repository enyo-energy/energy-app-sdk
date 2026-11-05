/**
 * Represents geographic coordinates with latitude and longitude.
 */
export interface Coordinates {
    /** Latitude in decimal degrees */
    latitude: number;
    /** Longitude in decimal degrees */
    longitude: number;
}

/**
 * Supported countries of a site, as ISO 3166-1 alpha-2 codes.
 */
export enum EnyoCountryEnum {
    /** Germany */
    DE = 'DE',
    /** Austria */
    AT = 'AT',
    /** Switzerland */
    CH = 'CH',
}

/**
 * Represents a location with only the zip code.
 */
export interface EnyoZipCodeLocation {
    /** The zip/postal code of the location */
    zipCode: string;
}

/**
 * Represents a location with zip code and geographic coordinates.
 */
export interface EnyoLocation {
    /** The zip/postal code of the location */
    zipCode: string;
    /** The geographic coordinates of the location */
    coordinates: Coordinates;
}