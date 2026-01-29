export interface EnyoInverterDcString {
    index: number;
    name?: string;
}

export interface EnyoInverterApplianceMetadata {
    maxPvProductionW?: number;
    dcStrings?: EnyoInverterDcString[];
}