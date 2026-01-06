import {randomUUID} from "node:crypto";
import type {EnergyAppModbusInstance} from "../../packages/energy-app-modbus.js";
import type {HemsOneAppliance} from "../../types/hems-one-appliance.js";
import {HemsOneApplianceStateEnum, HemsOneApplianceTypeEnum} from "../../types/hems-one-appliance.js";
import type {HemsOneNetworkDevice} from "../../types/hems-one-network-device.js";
import {
    type HemsOneDataBusMessage,
    HemsOneDataBusMessageEnum,
    type HemsOneDataBusMeterValuesUpdateV1
} from "../../types/hems-one-data-bus-value.js";
import {HemsOneSourceEnum} from "../../types/hems-one-source.enum.js";

import {
    EnergyAppModbusConfigurationError,
    EnergyAppModbusConnectionError,
    type EnergyAppModbusDevice,
    type EnergyAppModbusMeterConfig,
    type IConnectionHealth,
    type IRegisterMapper
} from './interfaces.js';
import {EnergyAppModbusRegisterMapper} from './EnergyAppModbusRegisterMapper.js';
import {EnergyAppModbusConnectionHealth} from './EnergyAppModbusConnectionHealth.js';
import {EnergyAppModbusFaultTolerantReader} from './EnergyAppModbusFaultTolerantReader.js';
import {EnergyApp} from "../../index.js";

export class EnergyAppModbusMeter implements EnergyAppModbusDevice {
    private readonly _registerMapper: IRegisterMapper;
    private readonly _connectionHealth: IConnectionHealth;

    private _modbusInstance?: EnergyAppModbusInstance;
    private _appliance?: HemsOneAppliance;

    constructor(readonly client: EnergyApp, readonly config: EnergyAppModbusMeterConfig, readonly networkDevice: HemsOneNetworkDevice) {
        this.config = config;
        this.client = client;
        this.networkDevice = networkDevice;
        this._registerMapper = new EnergyAppModbusRegisterMapper();
        this._connectionHealth = new EnergyAppModbusConnectionHealth();

        // Validate configuration
        const validation = this._registerMapper.validateRegisterMap(config.registers);
        if (!validation.valid) {
            throw new EnergyAppModbusConfigurationError(`Invalid meter configuration: ${validation.errors.join(', ')}`);
        }

    }

    get appliance(): HemsOneAppliance {
        if (!this._appliance) {
            throw new Error('Meter appliance not initialized. Call connect() first.');
        }
        return this._appliance;
    }

    async connect(): Promise<void> {
        try {
            console.log(`Connecting to meter at ${this.networkDevice.hostname}...`);

            // Create modbus connection
            this._modbusInstance = await this.client.useModbus().connect({
                host: this.networkDevice.hostname,
                unitId: this.config.options?.unitId || 1,
                port: this.config.options?.port || 502,
                timeout: this.config.options?.timeout || 5000
            });

            // Initialize appliance
            await this._initializeAppliance();

            console.log(`Successfully connected to meter ${this.config.name[0]?.name} at ${this.networkDevice.hostname}`);
        } catch (error) {
            throw new EnergyAppModbusConnectionError(
                `Failed to connect to meter at ${this.networkDevice.hostname}: ${(error as Error).message}`,
                error as Error
            );
        }
    }

    async disconnect(): Promise<void> {
        if (this._modbusInstance) {
            try {
                await this._modbusInstance.disconnect();
                console.log(`Disconnected from meter at ${this.networkDevice.hostname}`);
            } catch (error) {
                console.warn(`Error disconnecting from meter: ${(error as Error).message}`);
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
            throw new Error('Meter not connected. Call connect() first.');
        }

        const reader = new EnergyAppModbusFaultTolerantReader(this._modbusInstance, this._connectionHealth);
        const registerData = await this._registerMapper.readMultipleRegisters(reader, this.config.registers);

        // Extract meter data with fallbacks
        const gridFeedInPowerW = registerData.gridFeedInPower || 0;
        const gridConsumptionPowerW = registerData.gridConsumptionPower || 0;
        const gridFeedInWh = registerData.gridFeedInEnergy || 0;
        const gridConsumptionWh = registerData.gridConsumptionEnergy || 0;

        // Calculate net grid power (positive = consumption, negative = feed-in)
        const gridPowerW = registerData.gridPower || (gridConsumptionPowerW - gridFeedInPowerW);

        const message: HemsOneDataBusMeterValuesUpdateV1 = {
            type: 'message',
            source: HemsOneSourceEnum.Device,
            id: randomUUID(),
            timestampIso: new Date().toISOString(),
            message: HemsOneDataBusMessageEnum.MeterValuesUpdateV1,
            applianceId: this._appliance.id,
            data: {
                gridPowerW,
                gridFeedInWh,
                gridConsumptionWh
            },
            resolution: '10s'
        };

        console.log(`Meter Data (${this.config.name[0]?.name}): Grid Power=${gridPowerW}W (Feed-in=${gridFeedInPowerW}W, Consumption=${gridConsumptionPowerW}W), Feed-in Energy=${gridFeedInWh}Wh, Consumption Energy=${gridConsumptionWh}Wh`);

        return [message];
    }

    // Convenience methods for accessing specific register values
    async getGridPower(): Promise<number | null> {
        if (!this._modbusInstance) {
            return null;
        }

        const reader = new EnergyAppModbusFaultTolerantReader(this._modbusInstance, this._connectionHealth);

        // Try direct grid power register first
        if (this.config.registers.gridPower) {
            const result = await this._registerMapper.readRegister<number>(reader, this.config.registers.gridPower);
            if (result.success) {
                return result.value!;
            }
        }

        // Calculate from feed-in and consumption
        if (this.config.registers.gridFeedInPower && this.config.registers.gridConsumptionPower) {
            const feedInResult = await this._registerMapper.readRegister<number>(reader, this.config.registers.gridFeedInPower);
            const consumptionResult = await this._registerMapper.readRegister<number>(reader, this.config.registers.gridConsumptionPower);

            if (feedInResult.success && consumptionResult.success) {
                return consumptionResult.value! - feedInResult.value!;
            }
        }

        return null;
    }

    async getGridFeedInEnergy(): Promise<number | null> {
        if (!this._modbusInstance || !this.config.registers.gridFeedInEnergy) {
            return null;
        }

        const reader = new EnergyAppModbusFaultTolerantReader(this._modbusInstance, this._connectionHealth);
        const result = await this._registerMapper.readRegister<number>(reader, this.config.registers.gridFeedInEnergy);

        return result.success ? result.value! : null;
    }

    async getGridConsumptionEnergy(): Promise<number | null> {
        if (!this._modbusInstance || !this.config.registers.gridConsumptionEnergy) {
            return null;
        }

        const reader = new EnergyAppModbusFaultTolerantReader(this._modbusInstance, this._connectionHealth);
        const result = await this._registerMapper.readRegister<number>(reader, this.config.registers.gridConsumptionEnergy);

        return result.success ? result.value! : null;
    }

    private async _initializeAppliance(): Promise<void> {
        const appliances = await this.client.useAppliances().list();
        let existingAppliance = appliances.find(a =>
            a.networkDeviceIds.includes(this.networkDevice.id) &&
            a.type === HemsOneApplianceTypeEnum.Meter
        );

        if (!existingAppliance) {
            // Create new appliance
            existingAppliance = {
                id: randomUUID(),
                type: HemsOneApplianceTypeEnum.Meter,
                networkDeviceIds: [this.networkDevice.id],
                name: this.config.name,
                metadata: {
                    state: HemsOneApplianceStateEnum.Connected,
                    ...this.config.options?.topology && {topology: this.config.options.topology}
                }
            };
            await this.client.useAppliances().save(existingAppliance, undefined);
            console.log(`Created new meter appliance: ${this.config.name[0]?.name}`);
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
            console.log(`Updated existing meter appliance: ${this.config.name[0]?.name}`);
        }

        this._appliance = existingAppliance;
    }
}