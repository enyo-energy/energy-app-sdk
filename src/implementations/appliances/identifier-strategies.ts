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

/**
 * Strategy that uses the appliance's hostname as the identifier.
 *
 * Not recommended: a hostname changes (IP address ↔ DNS name, router renames),
 * and every change creates a second appliance. Use
 * {@link NetworkDeviceIdStrategy} for devices without a serial number.
 */
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

/**
 * Extracts an optional sub-key that tells apart several appliances of the same
 * type behind one network device, e.g. the Modbus unit id or a battery index.
 * Must return the same value for the {@link ApplianceConfig} the app saves and
 * for the stored {@link EnyoAppliance}, so read it from a field that is saved
 * with the appliance (such as `metadata.modbus.unitId`).
 */
export type NetworkDeviceSubKeyExtractor =
    (appliance: EnyoAppliance | ApplianceConfig) => string | number | undefined;

/**
 * Strategy that identifies an appliance by its type plus its first network
 * device id (`<type>:<networkDeviceId>`), optionally followed by a sub-key
 * (`<type>:<networkDeviceId>:<subKey>`).
 *
 * Recommended for apps whose devices report no serial number, in place of
 * {@link HostnameStrategy}: the network device id stays the same when the
 * device's IP address or hostname changes, because the box matches network
 * devices by their MAC address. Typical use is as a fallback after the serial
 * number:
 *
 * ```ts
 * IdentifierStrategyFactory.fallback([
 *     IdentifierStrategyFactory.serialNumber(),
 *     IdentifierStrategyFactory.networkDeviceId(a => a.metadata?.modbus?.unitId),
 * ]);
 * ```
 *
 * The app must pass `networkDevices` on every `createOrUpdateAppliance` call;
 * without them no identifier can be extracted.
 */
export class NetworkDeviceIdStrategy implements IdentifierStrategy {
    name: string;

    /**
     * Creates a strategy that uses the appliance type and network device id.
     * @param subKey Optional extractor for a sub-key that tells apart several
     *               appliances of the same type behind one network device. When
     *               given, it must return a value, otherwise no identifier is
     *               extracted.
     */
    constructor(private subKey?: NetworkDeviceSubKeyExtractor) {
        this.name = subKey ? 'networkDeviceId+subKey' : 'networkDeviceId';
    }

    /**
     * Extracts `<type>:<networkDeviceId>[:<subKey>]` from the appliance. The
     * network device id is the first of `networkDevices` (config) or
     * `networkDeviceIds` (stored appliance).
     * @param appliance The appliance to extract the identifier from
     * @returns The identifier, or undefined if the network device id or a
     *          requested sub-key is missing
     */
    extract(appliance: EnyoAppliance | ApplianceConfig): string | undefined {
        const networkDeviceId = 'networkDeviceIds' in appliance
            ? appliance.networkDeviceIds?.[0]
            : appliance.networkDevices?.[0]?.id;
        if (!networkDeviceId) {
            return undefined;
        }
        const key = `${appliance.type}:${networkDeviceId}`;
        if (!this.subKey) {
            return key;
        }
        const subKey = this.subKey(appliance);
        if (subKey === undefined || subKey === '') {
            return undefined;
        }
        return `${key}:${subKey}`;
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
 * Strategy that tries multiple strategies and returns the first available identifier.
 * This is an OR operation - any strategy succeeding is sufficient.
 */
export class OrIdentifierStrategy implements IdentifierStrategy {
    name: string;

    /**
     * Creates a strategy that tries multiple strategies in order.
     * @param strategies The strategies to try (OR logic)
     */
    constructor(private strategies: IdentifierStrategy[]) {
        this.name = `or(${strategies.map(s => s.name).join('|')})`;
    }

    /**
     * Tries strategies in order and returns the first available identifier.
     * @param appliance The appliance to extract identifiers from
     * @returns The first available identifier or undefined if none match
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
 * Strategy that combines multiple strategies into a single composite identifier.
 * This is an AND operation - all strategies must return a value.
 */
export class AndIdentifierStrategy implements IdentifierStrategy {
    name: string;

    /**
     * Creates a strategy that requires all sub-strategies to match.
     * @param strategies The strategies to combine (AND logic)
     * @param separator The separator to use between identifier parts
     */
    constructor(
        private strategies: IdentifierStrategy[],
        private separator: string = ':'
    ) {
        this.name = `and(${strategies.map(s => s.name).join('&')})`;
    }

    /**
     * Extracts and combines identifiers from all strategies.
     * @param appliance The appliance to extract identifiers from
     * @returns The combined identifier or undefined if any part is missing
     */
    extract(appliance: EnyoAppliance | ApplianceConfig): string | undefined {
        const parts: string[] = [];

        for (const strategy of this.strategies) {
            const value = strategy.extract(appliance);
            if (!value) {
                return undefined; // All parts must be present (AND logic)
            }
            parts.push(value);
        }

        return parts.join(this.separator);
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

    /**
     * Creates a strategy that identifies an appliance by type and network
     * device id. Recommended fallback for devices without a serial number,
     * instead of {@link hostname}. See {@link NetworkDeviceIdStrategy}.
     * @param subKey Optional extractor for a sub-key (e.g. Modbus unit id) that
     *               tells apart several appliances of the same type behind one
     *               network device
     */
    static networkDeviceId(subKey?: NetworkDeviceSubKeyExtractor): NetworkDeviceIdStrategy {
        return new NetworkDeviceIdStrategy(subKey);
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

    /**
     * Creates an OR strategy that returns the first available identifier.
     * @param strategies The strategies to try
     */
    static or(strategies: IdentifierStrategy[]): OrIdentifierStrategy {
        return new OrIdentifierStrategy(strategies);
    }

    /**
     * Creates an AND strategy that combines all identifiers.
     * @param strategies The strategies to combine
     * @param separator The separator between parts
     */
    static and(strategies: IdentifierStrategy[], separator?: string): AndIdentifierStrategy {
        return new AndIdentifierStrategy(strategies, separator);
    }
}