import {EnyoElectricityTariff, EnyoElectricityTariffWithDefault} from "../types/enyo-electricity-tariff.js";

/**
 * Interface for managing electricity tariffs.
 * Provides methods to register, retrieve, and remove electricity tariffs
 * used for energy pricing and consumption calculations.
 */
export interface EnergyAppElectricityTariff {
    /**
     * Registers a new electricity tariff or updates an existing one.
     * Uses upsert logic based on tariffId - if a tariff with the same ID exists,
     * it will be updated; otherwise, a new tariff will be created.
     *
     * @param tariff - The tariff registration data including ID, type, name, and vendor
     * @returns Promise that resolves when the tariff has been registered
     */
    registerTariff(tariff: Omit<EnyoElectricityTariff, 'id'>): Promise<EnyoElectricityTariffWithDefault>;

    /**
     * Retrieves all registered electricity tariffs.
     * Each tariff includes a defaultTariff boolean indicating whether
     * it is the system default tariff.
     *
     * @returns Promise that resolves to an array of all registered tariffs with default indicators
     */
    getAllTariffs(filter?: { myTariffs?: boolean }): Promise<EnyoElectricityTariffWithDefault[]>;

    /**
     * Removes an electricity tariff by its ID.
     * If the tariff does not exist, this operation is a no-op.
     *
     * @param id - The unique identifier of the tariff to remove
     * @returns Promise that resolves when the tariff has been removed
     */
    removeTariff(id: string): Promise<void>;

    /**
     * Retrieves the system default tariff information.
     * Returns the full tariff including pricing data.
     *
     * @returns Promise that resolves to the default tariff info, or null if none is configured
     */
    getDefaultTariff(): Promise<EnyoElectricityTariff | null>;

    findTariff(filter: { applianceId?: string; tariffId?: string; externalTariffId?: string; }): Promise<EnyoElectricityTariffWithDefault | null>;

    /**
     * Partially updates an existing electricity tariff.
     * Only the provided attributes will be modified; all other fields remain unchanged.
     *
     * @param id - The unique identifier of the tariff to update
     * @param attributes - A partial set of tariff fields to update (excluding `id`)
     * @returns Promise that resolves to the full updated tariff with its default indicator
     */
    updateTariff(id: string, attributes: Partial<Omit<EnyoElectricityTariff, 'id'>>): Promise<EnyoElectricityTariffWithDefault>;
}
