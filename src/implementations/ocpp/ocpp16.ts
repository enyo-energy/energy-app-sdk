export enum OCPP16Action {
  /** The authorization is handled by the core and you will get an info if authorized */
  AuthorizationInfo = 'AuthorizationInfo',
  BootNotification = 'BootNotification',
  CancelReservation = 'CancelReservation',
  ChangeAvailability = 'ChangeAvailability',
  ChangeConfiguration = 'ChangeConfiguration',
  ClearCache = 'ClearCache',
  ClearChargingProfile = 'ClearChargingProfile',
  DataTransfer = 'DataTransfer',
  DiagnosticsStatusNotification = 'DiagnosticsStatusNotification',
  FirmwareStatusNotification = 'FirmwareStatusNotification',
  GetConfiguration = 'GetConfiguration',
  GetDiagnostics = 'GetDiagnostics',
  GetLocalListVersion = 'GetLocalListVersion',
  Heartbeat = 'Heartbeat',
  MeterValues = 'MeterValues',
  RemoteStartTransaction = 'RemoteStartTransaction',
  RemoteStopTransaction = 'RemoteStopTransaction',
  ReserveNow = 'ReserveNow',
  Reset = 'Reset',
  SendLocalList = 'SendLocalList',
  SetChargingProfile = 'SetChargingProfile',
  StartTransaction = 'StartTransaction',
  StatusNotification = 'StatusNotification',
  StopTransaction = 'StopTransaction',
  TriggerMessage = 'TriggerMessage',
  UnlockConnector = 'UnlockConnector',
  UpdateFirmware = 'UpdateFirmware',
}

export enum RegistrationStatus {
  Accepted = 'Accepted',
  Pending = 'Pending',
  Rejected = 'Rejected',
}

export enum ChargePointStatus {
  Available = 'Available',
  Preparing = 'Preparing',
  Charging = 'Charging',
  SuspendedEVSE = 'SuspendedEVSE',
  SuspendedEV = 'SuspendedEV',
  Finishing = 'Finishing',
  Reserved = 'Reserved',
  Unavailable = 'Unavailable',
  Faulted = 'Faulted',
}

export interface OCPP16BootNotificationRequest {
  chargePointVendor: string;
  chargePointModel: string;
  chargePointSerialNumber?: string;
  chargeBoxSerialNumber?: string;
  firmwareVersion?: string;
  iccid?: string;
  imsi?: string;
  meterSerialNumber?: string;
  meterType?: string;
}

export interface OCPP16BootNotificationResponse {
  status: RegistrationStatus;
  currentTime: string;
  interval: number;
}

export interface OCPP16HeartbeatRequest {}

export interface OCPP16HeartbeatResponse {
  currentTime: string;
}

export interface OCPP16StatusNotificationRequest {
  connectorId: number;
  status: ChargePointStatus;
  errorCode: string;
  info?: string;
  timestamp?: string;
  vendorId?: string;
  vendorErrorCode?: string;
}

export interface OCPP16StatusNotificationResponse {}

export interface OCPP16AuthorizeRequest {
  idTag: string;
}

export interface OCPP16AuthorizationInfoResponse {
  idTag: string;
  chargingCardId?: string;
  vehicleId?: string;
}

export interface OCPP16StartTransactionRequest {
  connectorId: number;
  idTag: string;
  meterStart: number;
  timestamp: string;
  reservationId?: number;
}

export interface OCPP16StartTransactionResponse {
  transactionId: number;
  idTagInfo: {
    status: 'Accepted' | 'Blocked' | 'Expired' | 'Invalid' | 'ConcurrentTx';
    expiryDate?: string;
    parentIdTag?: string;
  };
}

export interface OCPP16StopTransactionRequest {
  transactionId: number;
  timestamp: string;
  meterStop: number;
  idTag?: string;
  reason?: string;
  transactionData?: any[];
}

export interface OCPP16StopTransactionResponse {
  idTagInfo?: {
    status: 'Accepted' | 'Blocked' | 'Expired' | 'Invalid' | 'ConcurrentTx';
    expiryDate?: string;
    parentIdTag?: string;
  };
}

export type OCPP16MeterValueContext =
  | 'Interruption.Begin'
  | 'Interruption.End'
  | 'Sample.Clock'
  | 'Sample.Periodic'
  | 'Transaction.Begin'
  | 'Transaction.End'
  | 'Trigger';

export type OCPP16MeterValueMeasurand =
  | 'Voltage'
  | 'Current.Import'
  | 'Power.Active.Import'
  | 'SoC'
  | 'Power.Offered'
  | 'Energy.Active.Import.Register';

export interface OCPP16MeterValueSampledValue {
  value: string;
  format?: 'SignedData' | 'Raw';
  measurand: OCPP16MeterValueMeasurand;
  context?: OCPP16MeterValueContext;
  location?: 'Outlet' | 'EV';
  unit: 'V' | 'A' | 'W' | 'Percent' | 'Wh';
  phase?: 'L1' | 'L2' | 'L3';
}

export interface OCPP16MeterValue {
  timestamp: string;
  sampledValue: OCPP16MeterValueSampledValue[];
}

export interface OCPP16MeterValuesMessage {
  connectorId: number;
  transactionId: number;
  meterValue: OCPP16MeterValue[];
}