import {randomUUID} from "node:crypto";
import type {HemsOneAppliance} from "../../types/hems-one-appliance.js";
import {
    HemsOneApplianceStateEnum,
    HemsOneApplianceTypeEnum
} from "../../types/hems-one-appliance.js";
import {
    type HemsOneDataBusBatteryValuesUpdateV1,
    type HemsOneDataBusMessage,
    HemsOneDataBusMessageEnum
} from "../../types/hems-one-data-bus-value.js";
import {HemsOneSourceEnum} from "../../types/hems-one-source.enum.js";

import {
    type EnergyAppModbusDevice,
    type IRegisterMapper,
    type EnergyAppModbusBatteryConfig,
    EnergyAppModbusConfigurationError,
    type IEnergyAppModbusInverter
} from './interfaces.js';
import {EnergyAppModbusRegisterMapper} from './EnergyAppModbusRegisterMapper.js';
import {EnergyAppModbusFaultTolerantReader} from './EnergyAppModbusFaultTolerantReader.js';
import {EnergyApp} from "../../index.js";

export class EnergyAppModbusBattery implements EnergyAppModbusDevice {
    public readonly inverter?: IEnergyAppModbusInverter;
    private readonly _registerMapper: IRegisterMapper;

    private _appliance?: HemsOneAppliance;

    constructor(readonly client: EnergyApp, readonly config: EnergyAppModbusBatteryConfig) {
        this.config = config;
        this.client = client;
        this.inverter = config.inverter;
        this._registerMapper = new EnergyAppModbusRegisterMapper();

        // Validate configuration
        const validation = this._registerMapper.validateRegisterMap(config.registers);
        if (!validation.valid) {
            throw new EnergyAppModbusConfigurationError(`Invalid battery configuration: ${validation.errors.join(', ')}`);
        }

        if (!config.inverter) {
            throw new EnergyAppModbusConfigurationError('Battery requires an inverter reference');
        }
    }

    get appliance(): HemsOneAppliance {
        if (!this._appliance) {
            throw new Error('Battery appliance not initialized. Call connect() first.');
        }
        return this._appliance;
    }

    get networkDevice() {
        if (!this.inverter) {
            throw new Error('Battery requires an inverter reference');
        }
        return this.inverter.networkDevice;
    }

    async connect(): Promise<void> {
        if (!this.inverter) {
            throw new Error('Battery requires an inverter reference');
        }

        if (!this.inverter.isConnected()) {
            throw new Error('Inverter must be connected before connecting battery');
        }

        console.log(`Connecting battery to inverter ${this.config.name[0]?.name}...`);

        // Initialize appliance
        await this._initializeAppliance();

        console.log(`Successfully connected battery ${this.config.name[0]?.name}`);
    }

    async disconnect(): Promise<void> {
        try {
            await this.inverter?.disconnect()
            console.log(`Disconnected from battery at ${this.networkDevice.hostname}`);
        } catch (error) {
            console.warn(`Error disconnecting from battery: ${(error as Error).message}`);
        }
    }

    isConnected(): boolean {
        return this.inverter?.isConnected() || false;
    }

    async updateData(): Promise<HemsOneDataBusMessage[]> {
        if (!this.inverter || !this.inverter.isConnected() || !this._appliance) {
            throw new Error('Battery not connected. Call connect() first.');
        }

        // Use the inverter's modbus instance
        const modbusInstance = (this.inverter as any)._modbusInstance;
        const connectionHealth = (this.inverter as any)._connectionHealth;

        if (!modbusInstance) {
            throw new Error('Inverter modbus instance not available');
        }

        const reader = new EnergyAppModbusFaultTolerantReader(modbusInstance, connectionHealth);
        const registerData = await this._registerMapper.readMultipleRegisters(reader, this.config.registers);

        // Extract battery data
        const batteryCurrent = registerData.current || 0;
        const batteryVoltage = registerData.voltage || 0;
        const batterySoC = registerData.soc || 0;
        const batteryPowerW = registerData.power || (batteryCurrent * batteryVoltage);

        const message: HemsOneDataBusBatteryValuesUpdateV1 = {
            type: 'message',
            source: HemsOneSourceEnum.Device,
            id: randomUUID(),
            timestampIso: new Date().toISOString(),
            message: HemsOneDataBusMessageEnum.BatteryValuesUpdateV1,
            applianceId: this._appliance.id,
            data: {
                batteryPowerW,
                batterySoC
            },
            resolution: '10s'
        };

        console.log(`Battery Data (${this.config.name[0]?.name}): Power=${batteryPowerW}W, SoC=${batterySoC}%, Current=${batteryCurrent}A, Voltage=${batteryVoltage}V`);

        return [message];
    }

    // Convenience methods for accessing specific register values
    async getSoc(): Promise<number | null> {
        if (!this.inverter || !this.config.registers.soc) {
            return null;
        }

        const modbusInstance = (this.inverter as any)._modbusInstance;
        const connectionHealth = (this.inverter as any)._connectionHealth;

        if (!modbusInstance) {
            return null;
        }

        const reader = new EnergyAppModbusFaultTolerantReader(modbusInstance, connectionHealth);
        const result = await this._registerMapper.readRegister<number>(reader, this.config.registers.soc);

        return result.success ? result.value! : null;
    }

    async getCurrent(): Promise<number | null> {
        if (!this.inverter || !this.config.registers.current) {
            return null;
        }

        const modbusInstance = (this.inverter as any)._modbusInstance;
        const connectionHealth = (this.inverter as any)._connectionHealth;

        if (!modbusInstance) {
            return null;
        }

        const reader = new EnergyAppModbusFaultTolerantReader(modbusInstance, connectionHealth);
        const result = await this._registerMapper.readRegister<number>(reader, this.config.registers.current);

        return result.success ? result.value! : null;
    }

    async getPower(): Promise<number | null> {
        if (!this.inverter) {
            return null;
        }

        if (this.config.registers.power) {
            // Direct power register
            const modbusInstance = (this.inverter as any)._modbusInstance;
            const connectionHealth = (this.inverter as any)._connectionHealth;

            if (!modbusInstance) {
                return null;
            }

            const reader = new EnergyAppModbusFaultTolerantReader(modbusInstance, connectionHealth);
            const result = await this._registerMapper.readRegister<number>(reader, this.config.registers.power);

            return result.success ? result.value! : null;
        } else {
            // Calculate from current and voltage
            const current = await this.getCurrent();
            const voltage = await this.getVoltage();

            if (current !== null && voltage !== null) {
                return current * voltage;
            }
        }

        return null;
    }

    async getVoltage(): Promise<number | null> {
        if (!this.inverter || !this.config.registers.voltage) {
            return null;
        }

        const modbusInstance = (this.inverter as any)._modbusInstance;
        const connectionHealth = (this.inverter as any)._connectionHealth;

        if (!modbusInstance) {
            return null;
        }

        const reader = new EnergyAppModbusFaultTolerantReader(modbusInstance, connectionHealth);
        const result = await this._registerMapper.readRegister<number>(reader, this.config.registers.voltage);

        return result.success ? result.value! : null;
    }

    private async _initializeAppliance(): Promise<void> {
        if (!this.inverter) {
            throw new Error('Battery requires an inverter reference');
        }

        const appliances = await this.client.useAppliances().list();
        let existingAppliance = appliances.find(a =>
            a.networkDeviceIds.includes(this.inverter!.networkDevice.id) &&
            a.type === HemsOneApplianceTypeEnum.Storage
        );

        if (!existingAppliance) {
            // Create new appliance
            existingAppliance = {
                id: randomUUID(),
                type: HemsOneApplianceTypeEnum.Storage,
                networkDeviceIds: [this.inverter.networkDevice.id],
                name: this.config.name,
                metadata: {
                    state: HemsOneApplianceStateEnum.Connected,
                    ...this.config.options?.topology && {topology: this.config.options.topology}
                }
            };
            await this.client.useAppliances().save(existingAppliance, undefined);
            console.log(`Created new battery appliance: ${this.config.name[0]?.name}`);
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
            console.log(`Updated existing battery appliance: ${this.config.name[0]?.name}`);
        }

        this._appliance = existingAppliance;
    }
}