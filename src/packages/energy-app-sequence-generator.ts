/**
 * Interface for generating unique sequential numbers per named sequence.
 * Each sequence is identified by a string name and maintains its own independent counter.
 */
export interface EnergyAppSequenceGenerator {
    /**
     * Returns the next unique number for the given sequence.
     * Each sequence maintains its own independent counter.
     *
     * @param sequenceName - The name identifying the sequence
     * @returns Promise resolving to the next unique number in the sequence
     *
     * @example
     * const sequenceGenerator = energyApp.useSequenceGenerator();
     * const id1 = await sequenceGenerator.next("invoice");  // e.g. 1
     * const id2 = await sequenceGenerator.next("invoice");  // e.g. 2
     * const id3 = await sequenceGenerator.next("order");    // e.g. 1 (different sequence)
     */
    next: (sequenceName: string) => Promise<number>;
}
