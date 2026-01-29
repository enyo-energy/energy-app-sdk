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
 * Represents a location with zip code and optional coordinates.
 */
export interface EnyoZipCodeLocation {
    /** The zip/postal code of the location */
    zipCode: string;
}

export interface EnyoLocation {
    zipCode: string;
    coordinates: Coordinates;
}