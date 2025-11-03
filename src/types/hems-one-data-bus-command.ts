export enum HemsOneDataBusCommandTypeEnum {
    PauseChargingV1 = 'PauseChargingV1',
    ResumeChargingV1 = 'ResumeChargingV1',
    ChangeChargingPowerV1 = 'ChangeChargingPowerV1',
}

export interface HemsOneDataBusCommand {
    id: string;
    type: HemsOneDataBusCommandTypeEnum;
    command: object;
}

export interface HemsOneDataBusCommandAnswer {
    id: string;
    status: 'accepted' | 'rejected' | 'not-applicable';
}


export interface HemsOneDataBusPauseChargingV1Command extends HemsOneDataBusCommand {
    type: HemsOneDataBusCommandTypeEnum.PauseChargingV1;
    command: {
        applianceId: string;
    };
}

export interface HemsOneDataBusResumeChargingV1Command extends HemsOneDataBusCommand {
    type: HemsOneDataBusCommandTypeEnum.ResumeChargingV1;
    command: {
        applianceId: string;
        maxChargingPowerKw: number;
    };
}

export interface HemsOneDataBusChangeChargingPowerV1Command extends HemsOneDataBusCommand {
    type: HemsOneDataBusCommandTypeEnum.ChangeChargingPowerV1;
    command: {
        applianceId: string;
        maxChargingPowerKw: number;
    };
}