export interface EnyoInverterDcString {
    index: number;
    name?: string;
}

export interface EnyoInverterApplianceMetadata {
    maxPvProductionW?: number;
    dcStrings?: EnyoInverterDcString[];
    /** Optional custom DC string names, keyed by DC string index */
    customDcStringNames?: Record<number, string>;
}