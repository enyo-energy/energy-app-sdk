import {
    ElectricityTariffRegistration,
    ElectricityTariffWithDefault
} from "../types/enyo-electricity-tariff.js";

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
    registerTariff(tariff: ElectricityTariffRegistration): Promise<void>;

    /**
     * Retrieves all registered electricity tariffs.
     * Each tariff includes a defaultTariff boolean indicating whether
     * it is the system default tariff.
     *
     * @returns Promise that resolves to an array of all registered tariffs with default indicators
     */
    getAllTariffs(): Promise<ElectricityTariffWithDefault[]>;

    /**
     * Removes an electricity tariff by its ID.
     * If the tariff does not exist, this operation is a no-op.
     *
     * @param tariffId - The unique identifier of the tariff to remove
     * @returns Promise that resolves when the tariff has been removed
     */
    removeTariff(tariffId: string): Promise<void>;
}
