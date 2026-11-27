/**
 * German and English display texts for every value a compatibility
 * declaration can contain — features, requirements, limitations, connection
 * types, §14a interfaces and the derived summaries.
 *
 * Sales material, the enyo Store, onboarding and lead qualification all show
 * these values. Keeping the texts next to the enums — each map exhaustive over
 * its enum, enforced by the type — means a new enum member cannot ship without
 * its text, and no consumer keeps a copy that silently misses one.
 */

import type {EnergyAppPackageLanguage} from '../../energy-app-package-definition.js';
import {EnergyAppPackageConnectionTypeEnum} from '../../energy-app-package-definition.js';
import {
    EnergyAppModelFeatureEnum as F,
    EnergyAppModelFeatureSupportEnum,
    EnergyAppModelGridOperatorControlInterfaceEnum,
    EnergyAppModelLimitationEnum as L,
    EnergyAppModelRequirementEnum as R,
    EnergyAppModelVerificationEnum,
} from '../../energy-app-model-feature.enum.js';
import {EnergyAppGridOperatorControlSummaryEnum} from './grid-operator-control.js';
import {EnergyAppModelOptimizationLevelEnum} from './optimization-level.js';

/** A text in every supported language. */
export type EnergyAppCompatibilityText = Readonly<Record<EnergyAppPackageLanguage, string>>;

/** The display texts of one enum value. */
export interface EnergyAppCompatibilityLabel {
    /** Short name for lists, badges and table columns. */
    name: EnergyAppCompatibilityText;
    /** One sentence explaining the value to a customer or sales person. */
    description: EnergyAppCompatibilityText;
}

/**
 * Builds a label.
 *
 * @param deName - German name.
 * @param enName - English name.
 * @param deDescription - German description.
 * @param enDescription - English description.
 * @returns The label.
 */
function label(deName: string, enName: string, deDescription: string, enDescription: string): EnergyAppCompatibilityLabel {
    return {name: {de: deName, en: enName}, description: {de: deDescription, en: enDescription}};
}

/** Display texts of every {@link EnergyAppModelFeatureEnum} member. */
export const ENERGY_APP_MODEL_FEATURE_LABELS: Readonly<Record<F, EnergyAppCompatibilityLabel>> = {
    [F.BatteryChargingFromGrid]: label('Laden aus dem Netz', 'Grid charging',
        'Die Batterie kann mit wählbarer Leistung aus dem Netz geladen werden, z. B. in günstigen Stunden.',
        'The battery can be charged from the grid at a chosen power, e.g. in cheap hours.'),
    [F.BatteryChargeLimitation]: label('Ladebegrenzung', 'Charge limitation',
        'Ladeleistung oder Ziel-Ladestand der Batterie können begrenzt werden.',
        'The battery\'s charge power or target state of charge can be limited.'),
    [F.BatteryDischargeLimitation]: label('Entladebegrenzung', 'Discharge limitation',
        'Entladeleistung oder minimaler Ladestand der Batterie können begrenzt werden.',
        'The battery\'s discharge power or minimum state of charge can be limited.'),
    [F.BatteryGridChargeFullPowerOnly]: label('Netzladen nur mit voller Leistung', 'Grid charging at full power only',
        'Die Batterie kann nur mit voller Leistung aus dem Netz geladen werden, ohne weitere Steuerung.',
        'The battery can only be charged from the grid at full power, with no other control.'),
    [F.BatteryGridChargeFullPowerStoppable]: label('Volllast-Netzladen abbrechbar', 'Full-power grid charge stoppable',
        'Ein Netzladen mit voller Leistung kann vorzeitig beendet werden.',
        'A full-power grid charge can be ended early.'),
    [F.BatteryGridDischarging]: label('Entladen ins Netz', 'Grid discharging',
        'Die Batterie kann auf Befehl ins Netz entladen, z. B. bei hohen Preisen.',
        'The battery can discharge into the grid on command, e.g. at high prices.'),
    [F.BatteryHold]: label('Ladestand halten', 'Hold state of charge',
        'Laden und/oder Entladen kann gesperrt werden, um Energie für teure Stunden aufzusparen.',
        'Charging and / or discharging can be blocked to save energy for expensive hours.'),
    [F.BatteryManualCharge]: label('Manuelles Laden', 'Manual charge',
        'Der Kunde kann in der enyo App ein einmaliges „Jetzt laden“ starten.',
        'The customer can start a one-time "charge now" in the enyo app.'),
    [F.BatteryBackupPower]: label('Notstrom', 'Backup power',
        'Bei einem Netzausfall versorgt die Batterie das Haus oder ausgewählte Stromkreise weiter.',
        'During a grid outage the battery keeps supplying the house or selected circuits.'),

    [F.PvFeedInLimitation]: label('Einspeisebegrenzung', 'Feed-in limitation',
        'Die PV-Einspeisung ins Netz kann begrenzt werden.',
        'The PV feed-in into the grid can be limited.'),
    [F.InverterPowerLimitation]: label('Leistungsbegrenzung Wechselrichter', 'Inverter power limitation',
        'Die Ausgangsleistung des Wechselrichters kann begrenzt werden.',
        'The inverter\'s output power can be limited.'),
    [F.InverterGridOutageDetection]: label('Netzausfallerkennung', 'Grid outage detection',
        'Der Wechselrichter erkennt Netzausfälle und meldet Netz- oder Inselbetrieb.',
        'The inverter detects grid outages and reports on-grid or off-grid operation.'),

    [F.ChargingStartStop]: label('Laden starten/stoppen', 'Start / stop charging',
        'Der Ladevorgang kann aus der Ferne gestartet und gestoppt werden.',
        'Charging can be started and stopped remotely.'),
    [F.ChargingPowerLimitation]: label('Ladeleistung begrenzen', 'Charging power limitation',
        'Die Ladeleistung (Ampere oder Watt) kann begrenzt werden.',
        'The charging power (amperes or watts) can be limited.'),
    [F.ChargingPhaseSwitching]: label('Phasenumschaltung', 'Phase switching',
        'Die Wallbox kann zwischen ein- und dreiphasigem Laden umschalten.',
        'The wallbox can switch between single-phase and three-phase charging.'),
    [F.PvSurplusCharging]: label('PV-Überschussladen', 'PV surplus charging',
        'Das Auto kann mit PV-Überschuss geladen werden.',
        'The car can be charged with PV surplus.'),
    [F.ChargingSchedule]: label('Ladeplanung', 'Charging schedule',
        'Die Wallbox folgt einem Ladeplan des Energiemanagers, z. B. in die günstigsten Stunden.',
        'The wallbox follows a charging schedule from the energy manager, e.g. into the cheapest hours.'),
    [F.ChargingVehicleSocReadout]: label('Ladestand über Wallbox', 'Car state of charge via wallbox',
        'Die Wallbox liest den Ladestand des Autos selbst aus, ohne Hersteller-Cloud.',
        'The wallbox reads the car\'s state of charge itself, without the car maker\'s cloud.'),
    [F.ChargingMidMeter]: label('MID-Zähler', 'MID meter',
        'Die Wallbox hat einen MID-zertifizierten Zähler für die geladene Energie.',
        'The wallbox has a MID-certified meter for the charged energy.'),
    [F.ChargingEichrechtMeter]: label('Eichrechtskonformer Zähler', 'Calibration-law meter',
        'Die geladene Energie kann eichrechtskonform abgerechnet werden, z. B. für Dienstwagen.',
        'The charged energy can be billed in line with calibration law, e.g. for company cars.'),
    [F.ChargingRfidAuthorization]: label('RFID-Freigabe', 'RFID authorisation',
        'Laden kann mit einer RFID-Karte freigegeben werden.',
        'Charging can be authorised with an RFID card.'),
    [F.BidirectionalCharging]: label('Bidirektionales Laden', 'Bidirectional charging',
        'Die Autobatterie kann ins Haus (V2H) oder ins Netz (V2G) entladen werden.',
        'The car battery can be discharged into the house (V2H) or the grid (V2G).'),

    [F.HeatpumpDhwBoost]: label('Warmwasser-Boost', 'Hot water boost',
        'Die Warmwasserbereitung kann bei Bedarf erzwungen werden.',
        'Hot water heating can be forced on demand.'),
    [F.HeatpumpTemperatureSetpoint]: label('Solltemperatur', 'Temperature setpoint',
        'Die Solltemperatur kann vorgegeben werden.',
        'The target temperature can be set.'),
    [F.HeatpumpPowerModulation]: label('Leistungsmodulation', 'Power modulation',
        'Die Leistung der Wärmepumpe kann stufenlos gesteuert werden.',
        'The heat pump\'s power can be modulated.'),
    [F.HeatpumpSgReady]: label('SG Ready', 'SG Ready',
        'Die Wärmepumpe hat die SG-Ready-Schnittstelle.',
        'The heat pump has the SG Ready interface.'),
    [F.HeatpumpRoomTemperatureInput]: label('Externe Raumtemperatur', 'External room temperature',
        'Die Wärmepumpe übernimmt Raumtemperaturen externer Sensoren.',
        'The heat pump takes room temperatures from external sensors.'),
    [F.HeatpumpPvSurplusSignal]: label('PV-Überschusssignal', 'PV surplus signal',
        'Die Wärmepumpe passt ihren Verbrauch an den gemeldeten PV-Überschuss an.',
        'The heat pump adapts its consumption to the reported PV surplus.'),
    [F.HeatpumpBufferTankOverheating]: label('Pufferspeicher überheizen', 'Buffer tank overheating',
        'Der Pufferspeicher kann über den Sollwert geheizt werden, um günstige oder PV-Energie zu speichern.',
        'The buffer tank can be heated above its setpoint to store cheap or PV energy.'),
    [F.HeatpumpRoomOverheating]: label('Räume überheizen', 'Room overheating',
        'Die Räume können leicht über den Sollwert geheizt werden, um günstige oder PV-Energie zu speichern.',
        'The rooms can be heated slightly above their setpoint to store cheap or PV energy.'),
    [F.HeatpumpHeatingRodControl]: label('Heizstab der Wärmepumpe', 'Heat pump heating rod',
        'Der eingebaute Heizstab kann vom Energiemanager geschaltet werden.',
        'The built-in heating rod can be switched by the energy manager.'),
    [F.HeatpumpProgramSwitch]: label('Programmumschaltung', 'Program switch',
        'Heizkreise und Warmwasser können zwischen Komfort und Eco umgeschaltet werden.',
        'Heating circuits and hot water can be switched between comfort and eco.'),
    [F.HeatpumpHeatingCurveOffset]: label('Heizkurvenoptimierung', 'Heating curve optimisation',
        'Die Heizkurve kann verschoben und exakt wiederhergestellt werden.',
        'The heating curve can be shifted and restored exactly.'),
    [F.HeatpumpVacationMode]: label('Urlaubsmodus', 'Vacation mode',
        'Die Wärmepumpe kann in einen Urlaubsmodus versetzt werden.',
        'The heat pump can be set to a vacation mode.'),
    [F.HeatpumpLegionellaSchedule]: label('Legionellenprogramm verschieben', 'Legionella schedule',
        'Der Start des wöchentlichen Legionellenprogramms kann verschoben werden.',
        'The start of the weekly legionella program can be moved.'),
    [F.HeatpumpCooling]: label('Kühlen', 'Cooling',
        'Die Wärmepumpe kann kühlen.',
        'The heat pump can cool.'),
    [F.HeatpumpPowerReadout]: label('Stromverbrauch auslesen', 'Power readout',
        'Der elektrische Verbrauch der Wärmepumpe kann ausgelesen werden.',
        'The heat pump\'s electrical consumption can be read.'),

    [F.HeatingRodSwitching]: label('Heizstab schalten', 'Heating rod switching',
        'Der Heizstab kann ein- und ausgeschaltet werden.',
        'The heating rod can be switched on and off.'),
    [F.HeatingRodPowerModulation]: label('Heizstab modulieren', 'Heating rod modulation',
        'Die Leistung des Heizstabs folgt dem PV-Überschuss.',
        'The heating rod\'s power follows the PV surplus.'),
    [F.HeatingRodDhwSensor]: label('Warmwassersensor', 'Hot water sensor',
        'Der Heizstab misst die Temperatur des Warmwasserspeichers selbst.',
        'The heating rod measures the hot water tank temperature itself.'),
    [F.HeatingRodLegionellaSchedule]: label('Legionellenprogramm verschieben', 'Legionella schedule',
        'Der Start des wöchentlichen Legionellenprogramms des Heizstabs kann verschoben werden.',
        'The start of the heating rod\'s weekly legionella program can be moved.'),

    [F.ClimateTemperatureSetpoint]: label('Solltemperatur', 'Temperature setpoint',
        'Die Solltemperatur kann vorgegeben werden.',
        'The target temperature can be set.'),
    [F.ClimateModeControl]: label('Betriebsart', 'Operating mode',
        'Die Betriebsart (Heizen, Kühlen, Lüften, Aus) kann gesteuert werden.',
        'The operating mode (heat, cool, fan, off) can be controlled.'),
    [F.ClimateCooling]: label('Kühlen', 'Cooling',
        'Das Gerät kann kühlen.',
        'The unit can cool.'),
    [F.ClimateHeating]: label('Heizen', 'Heating',
        'Das Gerät kann heizen.',
        'The unit can heat.'),
    [F.ClimatePowerControl]: label('Leistungssteuerung', 'Power control',
        'Die Leistungsaufnahme kann gesteuert, z. B. auf einen Wert in Watt begrenzt werden.',
        'The power draw can be steered, e.g. limited to a value in watts.'),

    [F.GridPowerReadout]: label('Netzleistung auslesen', 'Grid power readout',
        'Bezug und Einspeisung am Netzanschluss können ausgelesen werden.',
        'Import and export at the grid connection can be read.'),
    [F.EnergyConsumptionReadout]: label('Energieverbrauch auslesen', 'Energy readout',
        'Der kumulierte Energieverbrauch kann ausgelesen werden.',
        'The accumulated energy consumption can be read.'),

    [F.VehicleSocReadout]: label('Ladestand auslesen', 'State of charge readout',
        'Der Ladestand des Autos kann aus der Ferne ausgelesen werden.',
        'The car\'s state of charge can be read remotely.'),
    [F.VehicleChargeStartStop]: label('Laden über das Auto', 'Charge control via car',
        'Laden kann über das Auto statt über die Wallbox gestartet und gestoppt werden.',
        'Charging can be started and stopped through the car instead of the wallbox.'),
    [F.VehicleChargeLimit]: label('Ladelimit am Auto', 'Car charge limit',
        'Ziel-Ladestand oder Ladestrom des Autos können vorgegeben werden.',
        'The car\'s target state of charge or charging current can be set.'),
    [F.VehicleLocationReadout]: label('Standort', 'Location',
        'Der Standort des Autos kann ausgelesen werden, z. B. „ist es zu Hause?“.',
        'The car\'s location can be read, e.g. "is it at home?".'),
    [F.VehicleOdometerReadout]: label('Kilometerstand', 'Odometer',
        'Der Kilometerstand kann ausgelesen werden.',
        'The odometer reading can be read.'),
    [F.VehiclePreconditioning]: label('Vorklimatisierung', 'Preconditioning',
        'Innenraum oder Batterie können aus der Ferne vorklimatisiert werden.',
        'The cabin or battery can be preconditioned remotely.'),

    [F.SwitchOnOff]: label('Schalten', 'Switching',
        'Die Steckdose kann ein- und ausgeschaltet werden.',
        'The plug can be switched on and off.'),
    [F.PowerMeasurement]: label('Leistungsmessung', 'Power measurement',
        'Die Steckdose misst die Leistung des angeschlossenen Geräts.',
        'The plug measures the power of the connected load.'),

    [F.GridOperatorConsumptionLimitation]: label('§14a-Verbrauchsbegrenzung', '§14a consumption limit',
        'Das Gerät folgt einer Verbrauchsbegrenzung des Netzbetreibers (§14a EnWG), die enyo weiterreicht.',
        'The device follows a grid operator consumption limit (§14a EnWG) passed on by enyo.'),
    [F.GridOperatorProductionLimitation]: label('Erzeugungsbegrenzung Netzbetreiber', 'Grid operator production limit',
        'Das Gerät folgt einer Erzeugungsbegrenzung des Netzbetreibers, die enyo weiterreicht.',
        'The device follows a grid operator production limit passed on by enyo.'),
};

/** Display texts of every {@link EnergyAppModelRequirementEnum} member. */
export const ENERGY_APP_MODEL_REQUIREMENT_LABELS: Readonly<Record<R, EnergyAppCompatibilityLabel>> = {
    [R.InstallerEnablement]: label('Freischaltung durch Installateur', 'Installer enablement',
        'Ein Installateur muss die externe Steuerung im Gerät oder im Herstellerportal einschalten.',
        'An installer has to switch on external control in the device or the vendor portal.'),
    [R.UserEnablement]: label('Freischaltung durch Kunden', 'Owner enablement',
        'Der Kunde muss die externe Steuerung selbst einschalten, z. B. in der Hersteller-App.',
        'The owner has to switch on external control, e.g. in the vendor app.'),
    [R.Gateway]: label('Gateway', 'Gateway',
        'Ein zusätzliches Kommunikationsgerät wird benötigt, z. B. Datenlogger, WLAN-Stick oder RS485-Gateway.',
        'An extra communication device is needed, e.g. a data logger, Wi-Fi stick or RS485 gateway.'),
    [R.VendorMeter]: label('Herstellerzähler', 'Vendor meter',
        'Der Energiezähler des Herstellers muss installiert sein.',
        'The vendor\'s energy meter has to be installed.'),
    [R.VendorCloudAccount]: label('Hersteller-Konto', 'Vendor account',
        'Die Anbindung läuft über die Hersteller-Cloud: Kundenkonto und Internet sind nötig.',
        'The integration runs through the vendor cloud: an account and internet access are needed.'),
    [R.VendorSubscription]: label('Hersteller-Abo', 'Vendor subscription',
        'Eine kostenpflichtige Lizenz oder ein Abo des Herstellers wird benötigt.',
        'A paid licence or subscription from the vendor is needed.'),
    [R.ElectricianWiring]: label('Verkabelung durch Elektriker', 'Electrician wiring',
        'Ein Elektriker muss ein Kabel verlegen, z. B. zu einem Schaltkontakt, einem RS485-Bus oder einem Zähler.',
        'An electrician has to lay a cable, e.g. to a switching contact, an RS485 bus or a meter.'),
};

/** Display texts of every {@link EnergyAppModelLimitationEnum} member. */
export const ENERGY_APP_MODEL_LIMITATION_LABELS: Readonly<Record<L, EnergyAppCompatibilityLabel>> = {
    [L.BatteryChargeCannotBeBlocked]: label('Laden nicht sperrbar', 'Charging cannot be blocked',
        'Die Batterie lädt immer mit PV-Überschuss; Platz für später kann nicht freigehalten werden.',
        'The battery always charges from PV surplus; room cannot be kept free for later.'),
    [L.BatteryDischargeCannotBeBlocked]: label('Entladen nicht sperrbar', 'Discharging cannot be blocked',
        'Die Batterie deckt immer den Hausverbrauch; Energie kann nicht für teure Stunden aufgespart werden.',
        'The battery always covers the house load; energy cannot be saved for expensive hours.'),
    [L.BatteryChargeSetpointForced]: label('Ladeleistung wird erzwungen', 'Charge power is forced',
        'Eine vorgegebene Ladeleistung wird exakt gefahren und fehlender PV-Strom aus dem Netz bezogen.',
        'A set charge power is executed exactly, drawing what PV does not cover from the grid.'),
    [L.ChargingCannotBePaused]: label('Laden nicht pausierbar', 'Charging cannot be paused',
        'Ein Ladevorgang kann nur beendet, nicht pausiert und auf günstige Stunden verteilt werden.',
        'A charge can only be stopped, not paused and spread across cheap hours.'),
    [L.ChargingRequiresReplug]: label('Neu einstecken nötig', 'Replug required',
        'Nach einem beendeten Ladevorgang startet ein neuer erst nach erneutem Einstecken.',
        'After a finished charge, a new one only starts once the car is plugged in again.'),
    [L.PhaseSwitchingBetweenSessionsOnly]: label('Phasenumschaltung nur zwischen Ladevorgängen', 'Phase switching between sessions only',
        'Ein Wechsel zwischen ein- und dreiphasig wirkt erst beim nächsten Ladevorgang.',
        'Switching between one and three phases only takes effect at the next session.'),
    [L.ControlRateLimited]: label('Steuerbefehle begrenzt', 'Control rate limited',
        'Befehle dürfen nur selten gesendet werden, z. B. wenige Schaltungen pro Tag.',
        'Commands may only be sent rarely, e.g. a few switches per day.'),
    [L.DelayedReadings]: label('Verzögerte Messwerte', 'Delayed readings',
        'Messwerte kommen mit Minuten Verzögerung an, z. B. über eine Hersteller-Cloud.',
        'Readings arrive with a delay of minutes, e.g. through a vendor cloud.'),
    [L.CoarseEnergyCounters]: label('Grobe Energiezähler', 'Coarse energy counters',
        'Energiezähler sind grob (z. B. 1-kWh-Schritte) oder aktualisieren selten.',
        'Energy counters are coarse (e.g. 1 kWh steps) or update rarely.'),
    [L.HeatpumpDhwBoostInterruptsHeating]: label('Boost unterbricht Heizung', 'Boost interrupts heating',
        'Während eines Warmwasser-Boosts pausiert die Raumheizung.',
        'Space heating pauses while a hot water boost runs.'),
    [L.HeatpumpBoostUsesElectricHeater]: label('Boost mit Heizstab', 'Boost uses electric heater',
        'Ein Boost heizt mit dem Heizstab statt dem Verdichter, deutlich weniger effizient.',
        'A boost heats with the electric heater instead of the compressor, much less efficiently.'),
    [L.SingleDeviceOnly]: label('Nur ein Gerät', 'Single device only',
        'Pro Standort wird nur ein Gerät dieses Modells unterstützt, keine Kaskade.',
        'Only one device of this model per site is supported, no cascade.'),
    [L.ChargingSinglePhaseOnly]: label('Nur einphasig', 'Single phase only',
        'Die Wallbox lädt nur einphasig, also mit höchstens etwa 7,4 kW.',
        'The wallbox charges on one phase only, so at most about 7.4 kW.'),
    [L.VendorInterfaceDeprecated]: label('Schnittstelle abgekündigt', 'Interface deprecated',
        'Der Hersteller hat das Ende der Schnittstelle angekündigt; die Steuerung kann nach einem Update wegfallen.',
        'The vendor has announced the end of the interface; control may stop working after an update.'),
};

/** Display texts of every {@link EnergyAppPackageConnectionTypeEnum} member. */
export const ENERGY_APP_CONNECTION_TYPE_LABELS: Readonly<Record<EnergyAppPackageConnectionTypeEnum, EnergyAppCompatibilityLabel>> = {
    [EnergyAppPackageConnectionTypeEnum.Cloud]: label('Hersteller-Cloud', 'Vendor cloud',
        'Über die Cloud des Herstellers; braucht Internet und meist ein Kundenkonto.',
        'Through the vendor\'s cloud; needs internet and usually an account.'),
    [EnergyAppPackageConnectionTypeEnum.ModbusTcp]: label('Modbus TCP', 'Modbus TCP',
        'Lokal über Modbus im Heimnetz.',
        'Locally over Modbus on the home network.'),
    [EnergyAppPackageConnectionTypeEnum.ModbusRtu]: label('Modbus RTU', 'Modbus RTU',
        'Lokal über ein RS485-Kabel zur enyo Box.',
        'Locally over an RS485 cable to the enyo Box.'),
    [EnergyAppPackageConnectionTypeEnum.Http]: label('Lokale API', 'Local API',
        'Lokal über die HTTP-Schnittstelle des Geräts.',
        'Locally over the device\'s HTTP interface.'),
    [EnergyAppPackageConnectionTypeEnum.Mqtt]: label('MQTT', 'MQTT',
        'Lokal über MQTT im Heimnetz.',
        'Locally over MQTT on the home network.'),
    [EnergyAppPackageConnectionTypeEnum.Eebus]: label('EEBUS', 'EEBUS',
        'Lokal über EEBUS im Heimnetz.',
        'Locally over EEBUS on the home network.'),
    [EnergyAppPackageConnectionTypeEnum.Ocpp]: label('OCPP', 'OCPP',
        'Die Wallbox verbindet sich per OCPP mit der enyo Box.',
        'The wallbox connects to the enyo Box over OCPP.'),
    [EnergyAppPackageConnectionTypeEnum.DryContact]: label('Schaltkontakt', 'Dry contact',
        'Über ein Relais, das an die Eingänge des Geräts verdrahtet ist (z. B. SG Ready).',
        'Through a relay wired to the device\'s inputs (e.g. SG Ready).'),
};

/** Display texts of every {@link EnergyAppModelGridOperatorControlInterfaceEnum} member. */
export const ENERGY_APP_GRID_OPERATOR_CONTROL_INTERFACE_LABELS: Readonly<Record<EnergyAppModelGridOperatorControlInterfaceEnum, EnergyAppCompatibilityLabel>> = {
    [EnergyAppModelGridOperatorControlInterfaceEnum.Eebus]: label('EEBUS', 'EEBUS',
        'Dimmbar nach §14a über EEBUS.',
        'Can be dimmed under §14a over EEBUS.'),
    [EnergyAppModelGridOperatorControlInterfaceEnum.Modbus]: label('Modbus', 'Modbus',
        'Dimmbar nach §14a über Modbus.',
        'Can be dimmed under §14a over Modbus.'),
    [EnergyAppModelGridOperatorControlInterfaceEnum.OtherDigital]: label('Andere digitale Schnittstelle', 'Other digital interface',
        'Dimmbar nach §14a über eine andere digitale Schnittstelle, z. B. eine Hersteller-API.',
        'Can be dimmed under §14a over another digital interface, e.g. a vendor API.'),
    [EnergyAppModelGridOperatorControlInterfaceEnum.SwitchingContact]: label('Schaltkontakt', 'Switching contact',
        'Dimmbar nach §14a über einen Schaltkontakt, z. B. die EVU-Sperre.',
        'Can be dimmed under §14a through a switching contact, e.g. the utility lock.'),
};

/** Display texts of every {@link EnergyAppGridOperatorControlSummaryEnum} member. */
export const ENERGY_APP_GRID_OPERATOR_CONTROL_SUMMARY_LABELS: Readonly<Record<EnergyAppGridOperatorControlSummaryEnum, EnergyAppCompatibilityLabel>> = {
    [EnergyAppGridOperatorControlSummaryEnum.Digital]: label('§14a digital', '§14a digital',
        'Nach §14a über eine digitale Schnittstelle dimmbar.',
        'Can be dimmed under §14a over a digital interface.'),
    [EnergyAppGridOperatorControlSummaryEnum.SwitchingContact]: label('§14a per Schaltkontakt', '§14a via switching contact',
        'Nach §14a nur über einen Schaltkontakt dimmbar.',
        'Can be dimmed under §14a through a switching contact only.'),
    [EnergyAppGridOperatorControlSummaryEnum.DigitalAndSwitchingContact]: label('§14a digital und per Schaltkontakt', '§14a digital and via switching contact',
        'Nach §14a digital oder über einen Schaltkontakt dimmbar.',
        'Can be dimmed under §14a digitally or through a switching contact.'),
    [EnergyAppGridOperatorControlSummaryEnum.None]: label('Kein §14a', 'No §14a',
        'Das Gerät kann nach §14a nicht gedimmt werden.',
        'The device cannot be dimmed under §14a.'),
    [EnergyAppGridOperatorControlSummaryEnum.Unknown]: label('§14a unbekannt', '§14a unknown',
        'Wie das Gerät nach §14a gedimmt wird, ist nicht erfasst.',
        'How the device is dimmed under §14a has not been recorded.'),
};

/** Display texts of every {@link EnergyAppModelVerificationEnum} member. */
export const ENERGY_APP_MODEL_VERIFICATION_LABELS: Readonly<Record<EnergyAppModelVerificationEnum, EnergyAppCompatibilityLabel>> = {
    [EnergyAppModelVerificationEnum.Datasheet]: label('Laut Datenblatt', 'Per datasheet',
        'Aus Datenblatt oder Schnittstellendokumentation, nicht mit dieser App getestet.',
        'From the datasheet or interface documentation, not tested with this app.'),
    [EnergyAppModelVerificationEnum.Lab]: label('Getestet', 'Tested',
        'Mit dieser App an einem echten Gerät getestet.',
        'Tested with this app on a real device.'),
    [EnergyAppModelVerificationEnum.Field]: label('Im Einsatz', 'In use',
        'Läuft mit dieser App bei Kunden.',
        'Running with this app at customer sites.'),
};

/** Display texts of every {@link EnergyAppModelFeatureSupportEnum} member. */
export const ENERGY_APP_MODEL_FEATURE_SUPPORT_LABELS: Readonly<Record<EnergyAppModelFeatureSupportEnum, EnergyAppCompatibilityLabel>> = {
    [EnergyAppModelFeatureSupportEnum.Supported]: label('Möglich', 'Supported',
        'Die Funktion ist mit diesem Modell möglich.',
        'The feature works with this model.'),
    [EnergyAppModelFeatureSupportEnum.Unsupported]: label('Nicht möglich', 'Not supported',
        'Die Funktion wurde geprüft und ist mit diesem Modell nicht möglich.',
        'The feature has been checked and does not work with this model.'),
    [EnergyAppModelFeatureSupportEnum.Unknown]: label('Unbekannt', 'Unknown',
        'Für dieses Modell ist nicht erfasst, ob die Funktion möglich ist.',
        'Whether the feature works with this model has not been recorded.'),
};

/** Display texts of every {@link EnergyAppModelOptimizationLevelEnum} member. */
export const ENERGY_APP_MODEL_OPTIMIZATION_LEVEL_LABELS: Readonly<Record<EnergyAppModelOptimizationLevelEnum, EnergyAppCompatibilityLabel>> = {
    [EnergyAppModelOptimizationLevelEnum.Full]: label('Voll optimierbar', 'Fully optimisable',
        'Der Energiemanager kann das Gerät vollständig nach Preis und Prognose steuern.',
        'The energy manager can fully steer the device by price and forecast.'),
    [EnergyAppModelOptimizationLevelEnum.Partial]: label('Teilweise optimierbar', 'Partly optimisable',
        'Der Energiemanager kann das Gerät steuern, aber nicht vollständig.',
        'The energy manager can steer the device, but not fully.'),
    [EnergyAppModelOptimizationLevelEnum.MonitoringOnly]: label('Nur Monitoring', 'Monitoring only',
        'Das Gerät wird angezeigt, aber nicht gesteuert.',
        'The device is shown, but not steered.'),
    [EnergyAppModelOptimizationLevelEnum.NotCompatible]: label('Nicht kompatibel', 'Not compatible',
        'Das Modell funktioniert nicht mit dieser App.',
        'The model does not work with this app.'),
    [EnergyAppModelOptimizationLevelEnum.NotApplicable]: label('Nicht steuerbar', 'Not steerable',
        'Geräte dieser Art werden nicht gesteuert, z. B. Zähler.',
        'Devices of this kind are not steered, e.g. meters.'),
    [EnergyAppModelOptimizationLevelEnum.Unknown]: label('Unbekannt', 'Unknown',
        'Modell oder Gerätekategorie sind nicht bekannt.',
        'The model or device category is not known.'),
};
