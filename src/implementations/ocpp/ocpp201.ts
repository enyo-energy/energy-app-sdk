export enum OCPP201Action {
  Authorize = 'Authorize',
  BootNotification = 'BootNotification',
  CancelReservation = 'CancelReservation',
  CertificateSigned = 'CertificateSigned',
  ChangeAvailability = 'ChangeAvailability',
  ClearCache = 'ClearCache',
  ClearChargingProfile = 'ClearChargingProfile',
  ClearDisplayMessage = 'ClearDisplayMessage',
  ClearVariableMonitoring = 'ClearVariableMonitoring',
  ClearedChargingLimit = 'ClearedChargingLimit',
  CostUpdated = 'CostUpdated',
  CustomerInformation = 'CustomerInformation',
  DataTransfer = 'DataTransfer',
  DeleteCertificate = 'DeleteCertificate',
  FirmwareStatusNotification = 'FirmwareStatusNotification',
  Get15118EVCertificate = 'Get15118EVCertificate',
  GetBaseReport = 'GetBaseReport',
  GetCertificateStatus = 'GetCertificateStatus',
  GetChargingProfiles = 'GetChargingProfiles',
  GetCompositeSchedule = 'GetCompositeSchedule',
  GetDisplayMessages = 'GetDisplayMessages',
  GetInstalledCertificateIds = 'GetInstalledCertificateIds',
  GetLocalListVersion = 'GetLocalListVersion',
  GetLog = 'GetLog',
  GetMonitoringReport = 'GetMonitoringReport',
  GetReport = 'GetReport',
  GetTransactionStatus = 'GetTransactionStatus',
  GetVariables = 'GetVariables',
  Heartbeat = 'Heartbeat',
  InstallCertificate = 'InstallCertificate',
  LogStatusNotification = 'LogStatusNotification',
  MeterValues = 'MeterValues',
  NotifyChargingLimit = 'NotifyChargingLimit',
  NotifyCustomerInformation = 'NotifyCustomerInformation',
  NotifyDisplayMessages = 'NotifyDisplayMessages',
  NotifyEVChargingNeeds = 'NotifyEVChargingNeeds',
  NotifyEVChargingSchedule = 'NotifyEVChargingSchedule',
  NotifyEvent = 'NotifyEvent',
  NotifyMonitoringReport = 'NotifyMonitoringReport',
  NotifyReport = 'NotifyReport',
  PublishFirmware = 'PublishFirmware',
  PublishFirmwareStatusNotification = 'PublishFirmwareStatusNotification',
  ReportChargingProfiles = 'ReportChargingProfiles',
  RequestStartTransaction = 'RequestStartTransaction',
  RequestStopTransaction = 'RequestStopTransaction',
  ReservationStatusUpdate = 'ReservationStatusUpdate',
  ReserveNow = 'ReserveNow',
  Reset = 'Reset',
  SecurityEventNotification = 'SecurityEventNotification',
  SendLocalList = 'SendLocalList',
  SetChargingProfile = 'SetChargingProfile',
  SetDisplayMessage = 'SetDisplayMessage',
  SetMonitoringBase = 'SetMonitoringBase',
  SetMonitoringLevel = 'SetMonitoringLevel',
  SetNetworkProfile = 'SetNetworkProfile',
  SetVariableMonitoring = 'SetVariableMonitoring',
  SetVariables = 'SetVariables',
  SignCertificate = 'SignCertificate',
  StatusNotification = 'StatusNotification',
  TransactionEvent = 'TransactionEvent',
  TriggerMessage = 'TriggerMessage',
  UnlockConnector = 'UnlockConnector',
  UnpublishFirmware = 'UnpublishFirmware',
  UpdateFirmware = 'UpdateFirmware',
}

export enum RegistrationStatusEnumType {
  Accepted = 'Accepted',
  Pending = 'Pending',
  Rejected = 'Rejected',
}

export enum ConnectorStatusEnumType {
  Available = 'Available',
  Occupied = 'Occupied',
  Reserved = 'Reserved',
  Charging = 'Charging',
  Unavailable = 'Unavailable',
  Faulted = 'Faulted',
}

export interface OCPP201BootNotificationRequest {
  chargingStation: {
    model: string;
    vendorName: string;
    firmwareVersion?: string;
    serialNumber?: string;
    modem?: {
      iccid?: string;
      imsi?: string;
    };
  };
  reason: 'ApplicationReset' | 'FirmwareUpdate' | 'LocalReset' | 'PowerUp' | 'RemoteReset' | 'ScheduledReset' | 'Triggered' | 'Unknown' | 'Watchdog';
}

export interface OCPP201BootNotificationResponse {
  currentTime: string;
  interval: number;
  status: RegistrationStatusEnumType;
  statusInfo?: {
    reasonCode: string;
    additionalInfo?: string;
  };
}

export interface OCPP201HeartbeatRequest {}

export interface OCPP201HeartbeatResponse {
  currentTime: string;
}

export interface OCPP201StatusNotificationRequest {
  timestamp: string;
  connectorStatus: ConnectorStatusEnumType;
  evseId: number;
  connectorId: number;
}

export interface OCPP201StatusNotificationResponse {}

export interface OCPP201AuthorizeRequest {
  idToken: {
    idToken: string;
    type: 'Central' | 'eMAID' | 'ISO14443' | 'ISO15693' | 'KeyCode' | 'Local' | 'MacAddress' | 'NoAuthorization';
    additionalInfo?: Array<{
      additionalIdToken: string;
      type: string;
    }>;
  };
  certificate?: string;
  iso15118CertificateHashData?: Array<{
    hashAlgorithm: 'SHA256' | 'SHA384' | 'SHA512';
    issuerNameHash: string;
    issuerKeyHash: string;
    serialNumber: string;
  }>;
}

export interface OCPP201AuthorizeResponse {
  idTokenInfo: {
    status: 'Accepted' | 'Blocked' | 'ConcurrentTx' | 'Expired' | 'Invalid' | 'NoCredit' | 'NotAllowedTypeEVSE' | 'NotAtThisLocation' | 'NotAtThisTime' | 'Unknown';
    cacheExpiryDateTime?: string;
    chargingPriority?: number;
    language1?: string;
    language2?: string;
    groupIdToken?: {
      idToken: string;
      type: string;
    };
    personalMessage?: {
      format: 'ASCII' | 'HTML' | 'URI' | 'UTF8';
      language?: string;
      content: string;
    };
  };
  certificateStatus?: 'Accepted' | 'SignatureError' | 'CertificateExpired' | 'CertificateRevoked' | 'NoCertificateAvailable' | 'CertChainError' | 'ContractCancelled';
}

export interface OCPP201TransactionEventRequest {
  eventType: 'Ended' | 'Started' | 'Updated';
  timestamp: string;
  triggerReason: 'Authorized' | 'CablePluggedIn' | 'ChargingRateChanged' | 'ChargingStateChanged' | 'Deauthorized' | 'EnergyLimitReached' | 'EVCommunicationLost' | 'EVConnectTimeout' | 'MeterValueClock' | 'MeterValuePeriodic' | 'TimeLimitReached' | 'Trigger' | 'UnlockCommand' | 'StopAuthorized' | 'EVDeparted' | 'EVDetected' | 'RemoteStop' | 'RemoteStart' | 'AbnormalCondition' | 'SignedDataReceived' | 'ResetCommand';
  seqNo: number;
  transactionInfo: {
    transactionId: string;
    chargingState?: 'Charging' | 'EVConnected' | 'SuspendedEV' | 'SuspendedEVSE' | 'Idle';
    timeSpentCharging?: number;
    stoppedReason?: 'DeAuthorized' | 'EmergencyStop' | 'EnergyLimitReached' | 'EVDisconnected' | 'GroundFault' | 'ImmediateReset' | 'Local' | 'LocalOutOfCredit' | 'MasterPass' | 'Other' | 'OvercurrentFault' | 'PowerLoss' | 'PowerQuality' | 'Reboot' | 'Remote' | 'SOCLimitReached' | 'StoppedByEV' | 'TimeLimitReached' | 'Timeout';
    remoteStartId?: number;
  };
  evse?: {
    id: number;
    connectorId?: number;
  };
  idToken?: {
    idToken: string;
    type: string;
  };
  meterValue?: Array<{
    timestamp: string;
    sampledValue: Array<{
      value: number;
      context?: 'Transaction.Begin' | 'Transaction.End' | 'Sample.Clock' | 'Sample.Periodic' | 'Trigger' | 'Interruption.Begin' | 'Interruption.End';
      measurand?: 'Energy.Active.Import' | 'Energy.Active.Export.Register' | 'Power.Active.Import' | 'Power.Active.Export' | 'Current.Import' | 'Voltage' | 'Temperature' | 'Frequency' | 'Current.Export' | 'Current.Offered' | 'SoC';
      phase?: 'L1' | 'L2' | 'L3';
      location?: 'Body' | 'Cable' | 'EV' | 'Inlet' | 'Outlet';
      signedMeterValue?: {
        signedMeterData: string;
        signingMethod: string;
        encodingMethod: string;
        publicKey: string;
      };
      unitOfMeasure?: {
        unit?: 'Wh' | 'W' | 'A' | 'Hz' | 'kW' | 'kWh';
        multiplier?: number;
      };
    }>;
  }>;
}

export interface OCPP201TransactionEventResponse {
  totalCost?: number;
  chargingPriority?: number;
  idTokenInfo?: {
    status: string;
    cacheExpiryDateTime?: string;
    chargingPriority?: number;
    language1?: string;
    language2?: string;
    groupIdToken?: {
      idToken: string;
      type: string;
    };
    personalMessage?: {
      format: string;
      language?: string;
      content: string;
    };
  };
  updatedPersonalMessage?: {
    format: string;
    language?: string;
    content: string;
  };
}