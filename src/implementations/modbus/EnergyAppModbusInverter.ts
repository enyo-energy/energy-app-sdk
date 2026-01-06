import {randomUUID} from "node:crypto";
import type {EnergyAppModbusInstance} from "../../packages/energy-app-modbus.js";
import type {HemsOneAppliance} from "../../types/hems-one-appliance.js";
import {HemsOneApplianceStateEnum, HemsOneApplianceTypeEnum} from "../../types/hems-one-appliance.js";
import type {HemsOneNetworkDevice} from "../../types/hems-one-network-device.js";
import {
    HemsOneDataBusInverterValuesV1,
    HemsOneDataBusMessage,
    HemsOneDataBusMessageEnum
} from "../../types/hems-one-data-bus-value.js";
import {HemsOneSourceEnum} from "../../types/hems-one-source.enum.js";

import {
    EnergyAppModbusConfigurationError,
    EnergyAppModbusConnectionError,
    type EnergyAppModbusDevice,
    type EnergyAppModbusInverterConfig,
    type IConnectionHealth,
    type IRegisterMapper
} from './interfaces.js';
import {EnergyAppModbusRegisterMapper} from './EnergyAppModbusRegisterMapper.js';
import {EnergyAppModbusConnectionHealth} from './EnergyAppModbusConnectionHealth.js';
import {EnergyAppModbusFaultTolerantReader} from './EnergyAppModbusFaultTolerantReader.js';
import {EnergyApp} from "../../index.js";

export class EnergyAppModbusInverter implements EnergyAppModbusDevice {
    private readonly _registerMapper: IRegisterMapper;
    private readonly _connectionHealth: IConnectionHealth;

    private _modbusInstance?: EnergyAppModbusInstance;
    private _appliance?: HemsOneAppliance;

    constructor(readonly client: EnergyApp, readonly config: EnergyAppModbusInverterConfig, readonly networkDevice: HemsOneNetworkDevice) {
        this._registerMapper = new EnergyAppModbusRegisterMapper();
        this._connectionHealth = new EnergyAppModbusConnectionHealth();

        // Validate configuration
        const validation = this._registerMapper.validateRegisterMap(config.registers);
        if (!validation.valid) {
            throw new EnergyAppModbusConfigurationError(`Invalid inverter configuration: ${validation.errors.join(', ')}`);
        }
        this.client = client;
        this.config = config;
        this.networkDevice = networkDevice;
    }

    get appliance(): HemsOneAppliance {
        if (!this._appliance) {
            throw new Error('Appliance not initialized. Call connect() first.');
        }
        return this._appliance;
    }

    async connect(): Promise<void> {
        try {
            console.log(`Connecting to inverter at ${this.networkDevice.hostname}...`);

            // Create modbus connection
            this._modbusInstance = await this.client.useModbus().connect({
                host: this.networkDevice.hostname,
                unitId: this.config.options?.unitId || 1,
                port: this.config.options?.port || 502,
                timeout: this.config.options?.timeout || 5000
            });

            // Initialize appliance
            await this._initializeAppliance();

            console.log(`Successfully connected to inverter ${this.config.name[0]?.name} at ${this.networkDevice.hostname}`);
        } catch (error) {
            throw new EnergyAppModbusConnectionError(
                `Failed to connect to inverter at ${this.networkDevice.hostname}: ${(error as Error).message}`,
                error as Error
            );
        }
    }

    async disconnect(): Promise<void> {
        if (this._modbusInstance) {
            try {
                await this._modbusInstance.disconnect();
                console.log(`Disconnected from inverter at ${this.networkDevice.hostname}`);
            } catch (error) {
                console.warn(`Error disconnecting from inverter: ${(error as Error).message}`);
            } finally {
                this._modbusInstance = undefined;
            }
        }
    }

    isConnected(): boolean {
        return this._modbusInstance !== undefined && this._connectionHealth.isHealthy();
    }

    async updateData(): Promise<HemsOneDataBusMessage[]> {
        if (!this._modbusInstance || !this._appliance) {
            throw new Error('Inverter not connected. Call connect() first.');
        }

        const reader = new EnergyAppModbusFaultTolerantReader(this._modbusInstance, this._connectionHealth);
        const registerData = await this._registerMapper.readMultipleRegisters(reader, this.config.registers);

        // Extract known values with fallbacks
        const pvPowerW = registerData.power || undefined;
        const currentA = registerData.current || undefined;
        const voltageL1 = registerData.voltageL1 || undefined;
        const voltageL2 = registerData.voltageL2 || undefined;
        const voltageL3 = registerData.voltageL3 || undefined;
        const totalEnergyWh = registerData.totalEnergy || undefined;
        const dailyEnergyWh = registerData.dailyEnergy || undefined;

        const message: HemsOneDataBusInverterValuesV1 = {
            type: 'message',
            source: HemsOneSourceEnum.Device,
            id: randomUUID(),
            timestampIso: new Date().toISOString(),
            message: HemsOneDataBusMessageEnum.InverterValuesUpdateV1,
            applianceId: this._appliance.id,
            data: {
                pvPowerW,
                currentA,
                voltageL1,
                voltageL2,
                voltageL3,
                pvProductionWh: totalEnergyWh
            },
            resolution: '10s'
        };

        console.log(`Inverter Data (${this.config.name[0]?.name}): Power=${pvPowerW}W, Current=${currentA}A, Voltage=${voltageL1}V, Energy=${totalEnergyWh}Wh`);

        return [message];
    }

    // Convenience methods for accessing specific register values
    async getSerialNumber(): Promise<string | null> {
        if (!this._modbusInstance || !this.config.registers.serialNumber) {
            return null;
        }

        const reader = new EnergyAppModbusFaultTolerantReader(this._modbusInstance, this._connectionHealth);
        const result = await this._registerMapper.readRegister<number>(reader, this.config.registers.serialNumber);

        return result.success ? result.value!.toString() : null;
    }

    async getCurrentPower(): Promise<number | null> {
        if (!this._modbusInstance || !this.config.registers.power) {
            return null;
        }

        const reader = new EnergyAppModbusFaultTolerantReader(this._modbusInstance, this._connectionHealth);
        const result = await this._registerMapper.readRegister<number>(reader, this.config.registers.power);

        return result.success ? result.value! : null;
    }

    async getTotalEnergy(): Promise<number | null> {
        if (!this._modbusInstance || !this.config.registers.totalEnergy) {
            return null;
        }

        const reader = new EnergyAppModbusFaultTolerantReader(this._modbusInstance, this._connectionHealth);
        const result = await this._registerMapper.readRegister<number>(reader, this.config.registers.totalEnergy);

        return result.success ? result.value! : null;
    }

    private async _initializeAppliance(): Promise<void> {
        const appliances = await this.client.useAppliances().list();
        let existingAppliance = appliances.find(a =>
            a.networkDeviceIds.includes(this.networkDevice.id) &&
            a.type === HemsOneApplianceTypeEnum.Inverter
        );

        if (!existingAppliance) {
            // Create new appliance
            existingAppliance = {
                id: randomUUID(),
                type: HemsOneApplianceTypeEnum.Inverter,
                networkDeviceIds: [this.networkDevice.id],
                name: this.config.name,
                metadata: {
                    state: HemsOneApplianceStateEnum.Connected,
                    ...this.config.options?.topology && {topology: this.config.options.topology}
                }
            };
            await this.client.useAppliances().save(existingAppliance, undefined);
            console.log(`Created new inverter appliance: ${this.config.name[0]?.name}`);
        } else {
            // Update existing appliance
            existingAppliance = {
                ...existingAppliance,
                name: this.config.name,
                metadata: {
                    ...existingAppliance.metadata,
                    state: HemsOneApplianceStateEnum.Connected,
                    ...this.config.options?.topology && {topology: this.config.options.topology}
                }
            };
            await this.client.useAppliances().save(existingAppliance, existingAppliance.id);
            console.log(`Updated existing inverter appliance: ${this.config.name[0]?.name}`);
        }

        this._appliance = existingAppliance;
    }
}