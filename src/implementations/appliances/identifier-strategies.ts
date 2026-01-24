import type { EnyoAppliance } from "../../types/enyo-appliance.js";
import type { EnyoNetworkDevice } from "../../types/enyo-network-device.js";

/**
 * Strategy interface for extracting unique identifiers from appliances.
 * Allows flexible identification of appliances based on different criteria.
 */
export interface IdentifierStrategy {
    /**
     * Extract the unique identifier from an appliance or its associated data.
     * @param appliance The appliance to extract the identifier from
     * @param networkDevice Optional network device associated with the appliance
     * @returns The extracted identifier string, or undefined if not available
     */
    extract(appliance: Partial<EnyoAppliance>, networkDevice?: EnyoNetworkDevice): string | undefined;

    /**
     * Name of the strategy for logging and debugging purposes.
     */
    name: string;
}

/**
 * Strategy that uses the network device ID as the identifier.
 * This is the default strategy for most appliances.
 */
export class NetworkDeviceIdStrategy implements IdentifierStrategy {
    name = 'networkDeviceId';

    /**
     * Extracts the network device ID.
     * @param appliance The appliance (not used in this strategy)
     * @param networkDevice The network device to get the ID from
     * @returns The network device ID or undefined
     */
    extract(appliance: Partial<EnyoAppliance>, networkDevice?: EnyoNetworkDevice): string | undefined {
        return networkDevice?.id;
    }
}

/**
 * Strategy that uses the appliance's serial number as the identifier.
 * Useful when appliances can move between network devices.
 */
export class SerialNumberStrategy implements IdentifierStrategy {
    name = 'serialNumber';

    /**
     * Extracts the serial number from the appliance metadata.
     * @param appliance The appliance to extract the serial number from
     * @returns The serial number or undefined
     */
    extract(appliance: Partial<EnyoAppliance>): string | undefined {
        return appliance.metadata?.serialNumber;
    }
}

/**
 * Strategy that uses a custom metadata field as the identifier.
 * Allows using any field from the appliance metadata.
 */
export class CustomMetadataStrategy implements IdentifierStrategy {
    name: string;

    /**
     * Creates a strategy that uses a custom metadata field.
     * @param fieldName The name of the metadata field to use as identifier
     */
    constructor(private fieldName: keyof NonNullable<EnyoAppliance['metadata']>) {
        this.name = `metadata.${String(fieldName)}`;
    }

    /**
     * Extracts the custom field value from the appliance metadata.
     * @param appliance The appliance to extract the field from
     * @returns The field value or undefined
     */
    extract(appliance: Partial<EnyoAppliance>): string | undefined {
        const value = appliance.metadata?.[this.fieldName];
        return value !== undefined ? String(value) : undefined;
    }
}

/**
 * Strategy that combines multiple identifiers to create a composite key.
 * Useful when a single identifier is not unique enough.
 */
export class CompositeIdentifierStrategy implements IdentifierStrategy {
    name: string;

    /**
     * Creates a strategy that combines multiple strategies.
     * @param strategies The strategies to combine
     * @param separator The separator to use between identifier parts
     */
    constructor(
        private strategies: IdentifierStrategy[],
        private separator: string = ':'
    ) {
        this.name = `composite(${strategies.map(s => s.name).join('+')})`;
    }

    /**
     * Extracts and combines identifiers from multiple strategies.
     * @param appliance The appliance to extract identifiers from
     * @param networkDevice The network device if available
     * @returns The combined identifier or undefined if any part is missing
     */
    extract(appliance: Partial<EnyoAppliance>, networkDevice?: EnyoNetworkDevice): string | undefined {
        const parts: string[] = [];

        for (const strategy of this.strategies) {
            const value = strategy.extract(appliance, networkDevice);
            if (!value) {
                return undefined; // All parts must be present
            }
            parts.push(value);
        }

        return parts.join(this.separator);
    }
}

/**
 * Strategy that tries multiple strategies in order and uses the first available identifier.
 * Useful for fallback scenarios.
 */
export class FallbackIdentifierStrategy implements IdentifierStrategy {
    name: string;

    /**
     * Creates a strategy that tries multiple strategies in order.
     * @param strategies The strategies to try in order
     */
    constructor(private strategies: IdentifierStrategy[]) {
        this.name = `fallback(${strategies.map(s => s.name).join('|')})`;
    }

    /**
     * Tries strategies in order and returns the first available identifier.
     * @param appliance The appliance to extract identifiers from
     * @param networkDevice The network device if available
     * @returns The first available identifier or undefined
     */
    extract(appliance: Partial<EnyoAppliance>, networkDevice?: EnyoNetworkDevice): string | undefined {
        for (const strategy of this.strategies) {
            const value = strategy.extract(appliance, networkDevice);
            if (value) {
                return value;
            }
        }
        return undefined;
    }
}

/**
 * Factory class for creating common identifier strategies.
 */
export class IdentifierStrategyFactory {
    /**
     * Creates the default network device ID strategy.
     */
    static networkDeviceId(): NetworkDeviceIdStrategy {
        return new NetworkDeviceIdStrategy();
    }

    /**
     * Creates a serial number strategy.
     */
    static serialNumber(): SerialNumberStrategy {
        return new SerialNumberStrategy();
    }

    /**
     * Creates a custom metadata field strategy.
     * @param fieldName The metadata field to use
     */
    static customMetadata(fieldName: keyof NonNullable<EnyoAppliance['metadata']>): CustomMetadataStrategy {
        return new CustomMetadataStrategy(fieldName);
    }

    /**
     * Creates a composite strategy that combines multiple identifiers.
     * @param strategies The strategies to combine
     * @param separator The separator between parts
     */
    static composite(strategies: IdentifierStrategy[], separator?: string): CompositeIdentifierStrategy {
        return new CompositeIdentifierStrategy(strategies, separator);
    }

    /**
     * Creates a fallback strategy that tries multiple strategies in order.
     * @param strategies The strategies to try
     */
    static fallback(strategies: IdentifierStrategy[]): FallbackIdentifierStrategy {
        return new FallbackIdentifierStrategy(strategies);
    }

    /**
     * Creates a strategy that prefers serial number but falls back to network device ID.
     */
    static serialNumberOrDeviceId(): FallbackIdentifierStrategy {
        return new FallbackIdentifierStrategy([
            new SerialNumberStrategy(),
            new NetworkDeviceIdStrategy()
        ]);
    }
}