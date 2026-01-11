import {randomUUID} from "node:crypto";
import type {EnergyAppModbusInstance} from "../../packages/energy-app-modbus.js";
import type {HemsOneAppliance} from "../../types/hems-one-appliance.js";
import {HemsOneApplianceStateEnum, HemsOneApplianceTypeEnum} from "../../types/hems-one-appliance.js";
import type {HemsOneNetworkDevice} from "../../types/hems-one-network-device.js";
import {
    HemsOneDataBusInverterValuesV1,
    HemsOneDataBusMessage,
    HemsOneDataBusMessageEnum,
    HemsOneInverterStateEnum
} from "../../types/hems-one-data-bus-value.js";
import {HemsOneSourceEnum} from "../../types/hems-one-source.enum.js";
import type {HemsOneInverterApplianceMetadata} from "../../types/hems-one-inverter-appliance.js";

import {
    EnergyAppModbusConfigurationError,
    EnergyAppModbusConnectionError,
    type EnergyAppModbusDevice,
    type EnergyAppModbusInverterConfig,
    type EnergyAppInverterStateValueMapping,
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
    private _inverterMetadata?: HemsOneInverterApplianceMetadata;

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

            // Discover inverter metadata during connection
            this._inverterMetadata = await this._discoverInverterMetadata();

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
        const pvPowerW = registerData.power || 0; // Required field, default to 0 if not available
        const voltageL1 = registerData.voltageL1 || 0; // Required field, default to 0 if not available
        const voltageL2 = registerData.voltageL2 || undefined;
        const voltageL3 = registerData.voltageL3 || undefined;

        // Read current inverter state if available
        let inverterState: HemsOneInverterStateEnum | undefined;
        try {
            inverterState = await this.getInverterState() || undefined;
        } catch (error) {
            console.warn(`Failed to read inverter state: ${(error as Error).message}`);
        }

        // Read active power limitation if available
        let activePowerLimitationW: number | undefined;
        try {
            activePowerLimitationW = await this.getActivePowerLimitation() || undefined;
        } catch (error) {
            console.warn(`Failed to read active power limitation: ${(error as Error).message}`);
        }

        // Read string data if available
        const strings: Array<{ index: number; voltage?: number; powerW?: number }> = [];
        for (let stringIndex = 1; stringIndex <= 4; stringIndex++) {
            let stringPower: number | undefined;
            let stringVoltage: number | undefined;
            let hasData = false;

            // Try to read string power
            try {
                const power = await this.getStringPower(stringIndex);
                if (power !== null) {
                    stringPower = power;
                    hasData = true;
                }
            } catch (error) {
                console.warn(`Failed to read string${stringIndex} power: ${(error as Error).message}`);
            }

            // Try to read string voltage
            try {
                const voltage = await this.getStringVoltage(stringIndex);
                if (voltage !== null) {
                    stringVoltage = voltage;
                    hasData = true;
                }
            } catch (error) {
                console.warn(`Failed to read string${stringIndex} voltage: ${(error as Error).message}`);
            }

            // Only add string to array if we have at least one value
            if (hasData) {
                strings.push({
                    index: stringIndex,
                    ...(stringVoltage !== undefined && { voltage: stringVoltage }),
                    ...(stringPower !== undefined && { powerW: stringPower })
                });
            }
        }

        const message: HemsOneDataBusInverterValuesV1 = {
            type: 'message',
            source: HemsOneSourceEnum.Device,
            id: randomUUID(),
            timestampIso: new Date().toISOString(),
            message: HemsOneDataBusMessageEnum.InverterValuesUpdateV1,
            applianceId: this._appliance.id,
            data: {
                state: inverterState,
                pvPowerW,
                voltageL1,
                voltageL2,
                voltageL3,
                activePowerLimitationW,
                ...(strings.length > 0 && { strings })
            },
            resolution: '10s'
        };

        // Create logging info with string data if available
        const stringInfo = strings.length > 0
            ? `, Strings=[${strings.map(s => `${s.index}:${s.powerW || 'N/A'}W/${s.voltage || 'N/A'}V`).join(',')}]`
            : '';

        console.log(`Inverter Data (${this.config.name[0]?.name}): State=${inverterState || 'N/A'}, Power=${pvPowerW}W, Voltage=${voltageL1}V, PowerLimit=${activePowerLimitationW || 'N/A'}W${stringInfo}`);

        return [message];
    }

    // Convenience methods for accessing specific register values
    async getSerialNumber(): Promise<string | null> {
        if (!this._modbusInstance || !this.config.registers.serialNumber) {
            return null;
        }

        const reader = new EnergyAppModbusFaultTolerantReader(this._modbusInstance, this._connectionHealth);
        const result = await this._registerMapper.readRegister<string>(reader, this.config.registers.serialNumber);

        return result.success ? result.value! : null;
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

    /**
     * Reads the current inverter state from modbus registers.
     * Maps the register value to HemsOneInverterStateEnum using the configured value mapping.
     */
    async getInverterState(): Promise<HemsOneInverterStateEnum | null> {
        if (!this._modbusInstance || !this.config.registers.state) {
            return null;
        }

        try {
            const reader = new EnergyAppModbusFaultTolerantReader(this._modbusInstance, this._connectionHealth);
            const result = await this._registerMapper.readRegister<number>(reader, this.config.registers.state);

            if (!result.success || result.value === undefined) {
                return null;
            }

            // Use configured value mapping if available
            if (this.config.registers.state.valueMapping) {
                const mapping = (this.config.registers.state.valueMapping as EnergyAppInverterStateValueMapping[])
                    .find(m => m.value === result.value);
                if (mapping) {
                    return mapping.mappedState as HemsOneInverterStateEnum;
                } else {
                    console.warn(`No mapping found for inverter state value: ${result.value} (Address ${this.config.registers.state.address}, ${this.config.registers.state.dataType}). Available mappings: ${this.config.registers.state.valueMapping.map(m => m.value).join(', ')}`);
                    return null;
                }
            } else {
                console.warn('Inverter state register configured without value mapping. Please configure valueMapping in register config.');
                return null;
            }
        } catch (error) {
            console.warn(`Failed to read inverter state: ${(error as Error).message}`);
            return null;
        }
    }

    /**
     * Reads the current active power limitation from modbus registers.
     */
    async getActivePowerLimitation(): Promise<number | null> {
        if (!this._modbusInstance || !this.config.registers.activePowerLimitationW) {
            return null;
        }

        const reader = new EnergyAppModbusFaultTolerantReader(this._modbusInstance, this._connectionHealth);
        const result = await this._registerMapper.readRegister<number>(reader, this.config.registers.activePowerLimitationW);

        return result.success ? result.value! : null;
    }

    /**
     * Reads the power value for a specific string from modbus registers.
     *
     * @param stringIndex - The string index (1-4)
     * @returns Promise resolving to power value in Watts or null if not available
     */
    async getStringPower(stringIndex: number): Promise<number | null> {
        if (!this._modbusInstance || stringIndex < 1 || stringIndex > 4) {
            return null;
        }

        const registerKey = `string${stringIndex}Power` as keyof typeof this.config.registers;
        const registerConfig = this.config.registers[registerKey];

        if (!registerConfig) {
            return null;
        }

        const reader = new EnergyAppModbusFaultTolerantReader(this._modbusInstance, this._connectionHealth);
        const result = await this._registerMapper.readRegister<number>(reader, registerConfig);

        return result.success ? result.value! : null;
    }

    /**
     * Reads the voltage value for a specific string from modbus registers.
     *
     * @param stringIndex - The string index (1-4)
     * @returns Promise resolving to voltage value in Volts or null if not available
     */
    async getStringVoltage(stringIndex: number): Promise<number | null> {
        if (!this._modbusInstance || stringIndex < 1 || stringIndex > 4) {
            return null;
        }

        const registerKey = `string${stringIndex}Voltage` as keyof typeof this.config.registers;
        const registerConfig = this.config.registers[registerKey];

        if (!registerConfig) {
            return null;
        }

        const reader = new EnergyAppModbusFaultTolerantReader(this._modbusInstance, this._connectionHealth);
        const result = await this._registerMapper.readRegister<number>(reader, registerConfig);

        return result.success ? result.value! : null;
    }

    /**
     * Discovers and caches inverter metadata from modbus registers during connection.
     * This method reads static metadata like max PV production once
     * and stores them for later use in appliance creation.
     */
    private async _discoverInverterMetadata(): Promise<HemsOneInverterApplianceMetadata> {
        if (!this._modbusInstance) {
            throw new Error('Modbus instance not available');
        }

        const reader = new EnergyAppModbusFaultTolerantReader(this._modbusInstance, this._connectionHealth);
        const metadata: HemsOneInverterApplianceMetadata = {};

        try {
            // Read max PV production if configured
            if (this.config.registers.maxPvProductionW) {
                const result = await this._registerMapper.readRegister<number>(reader, this.config.registers.maxPvProductionW);
                if (result.success && result.value !== undefined) {
                    metadata.maxPvProductionW = result.value;
                    console.log(`Discovered inverter max PV production: ${result.value} W`);
                }
            }
        } catch (error) {
            console.warn(`Warning: Failed to discover some inverter metadata: ${(error as Error).message}`);
        }

        return metadata;
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
                },
                inverter: this._inverterMetadata
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
                },
                inverter: this._inverterMetadata
            };
            await this.client.useAppliances().save(existingAppliance, existingAppliance.id);
            console.log(`Updated existing inverter appliance: ${this.config.name[0]?.name}`);
        }

        this._appliance = existingAppliance;
    }

    modbusClient() {
        return this._modbusInstance
    }
}