import type {EnyoAppliance} from "../../types/enyo-appliance.js";
import {ApplianceConfig} from "./appliance-manager.js";

/**
 * Strategy interface for extracting unique identifiers from appliances.
 * Allows flexible identification of appliances based on different criteria.
 */
export interface IdentifierStrategy {
    /**
     * Extract the unique identifier from an appliance or its associated data.
     * @param appliance The appliance to extract the identifier from
     * @returns The extracted identifier string, or undefined if not available
     */
    extract(appliance: EnyoAppliance | ApplianceConfig): string | undefined;

    /**
     * Name of the strategy for logging and debugging purposes.
     */
    name: string;
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
    extract(appliance: EnyoAppliance | ApplianceConfig): string | undefined {
        return appliance.metadata?.serialNumber;
    }
}

/**
 * Strategy that uses the appliance's serial number as the identifier.
 * Useful when appliances can move between network devices.
 */
export class TypeStrategy implements IdentifierStrategy {
    name = 'type';

    /**
     * Extracts the serial number from the appliance metadata.
     * @param appliance The appliance to extract the serial number from
     * @returns The serial number or undefined
     */
    extract(appliance: EnyoAppliance | ApplianceConfig): string | undefined {
        return appliance.type;
    }
}

export class HostnameStrategy implements IdentifierStrategy {
    name = 'hostname';

    /**
     * Extracts the serial number from the appliance metadata.
     * @param appliance The appliance to extract the serial number from
     * @returns The serial number or undefined
     */
    extract(appliance: EnyoAppliance | ApplianceConfig): string | undefined {
        return appliance.metadata?.hostname;
    }
}

export class ChargePointIdStrategy implements IdentifierStrategy {
    name = 'chargePointId';

    /**
     * Extracts the serial number from the appliance metadata.
     * @param appliance The appliance to extract the serial number from
     * @returns The serial number or undefined
     */
    extract(appliance: EnyoAppliance | ApplianceConfig): string | undefined {
        return appliance.charger?.ocpp?.chargePointId;
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
    extract(appliance: EnyoAppliance | ApplianceConfig): string | undefined {
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
     * @returns The combined identifier or undefined if any part is missing
     */
    extract(appliance: EnyoAppliance | ApplianceConfig): string | undefined {
        const parts: string[] = [];

        for (const strategy of this.strategies) {
            const value = strategy.extract(appliance);
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
     * @returns The first available identifier or undefined
     */
    extract(appliance: EnyoAppliance | ApplianceConfig): string | undefined {
        for (const strategy of this.strategies) {
            const value = strategy.extract(appliance);
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
     * Creates a serial number strategy.
     */
    static serialNumber(): SerialNumberStrategy {
        return new SerialNumberStrategy();
    }

    /**
     * Creates a serial number strategy.
     */
    static type(): SerialNumberStrategy {
        return new TypeStrategy();
    }

    static hostname(): HostnameStrategy {
        return new HostnameStrategy();
    }

    static chargePointId(): ChargePointIdStrategy {
        return new ChargePointIdStrategy();
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
}